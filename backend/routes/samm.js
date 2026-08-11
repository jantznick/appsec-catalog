import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getAuthContext } from '../middleware/authContext.js';
import {
  ensureSammFramework,
  flattenSammPractices,
  scoreAtlasSammPractice,
  summarizeSammAssessment,
} from '../services/samm.js';

const router = express.Router();

function canAccessCompany(req, companyId) {
  const auth = getAuthContext(req);
  return Boolean(auth?.isAdmin || (auth?.companyId && auth.companyId === companyId));
}

function assessmentInclude() {
  return {
    framework: {
      include: {
        domains: {
          orderBy: { displayOrder: 'asc' },
          include: { practices: { orderBy: { displayOrder: 'asc' } } },
        },
      },
    },
    company: { select: { id: true, name: true } },
    createdBy: { select: { id: true, email: true } },
    reviewer: { select: { id: true, email: true } },
    responses: { orderBy: { createdAt: 'asc' } },
  };
}

function serializeAssessment(assessment) {
  return {
    ...assessment,
    summary: summarizeSammAssessment(assessment),
  };
}

router.get('/framework', requireAuth, async (req, res) => {
  try {
    const framework = await ensureSammFramework();
    res.json({
      id: framework.id,
      name: framework.name,
      version: framework.version,
      questionBankVersion: flattenSammPractices(framework)[0]?.questionBankVersion || null,
      source: framework.source,
      domains: framework.domains.map((domain) => ({
        ...domain,
        practices: domain.practices.map((practice) => ({
          ...practice,
          questions: flattenSammPractices(framework).find((item) => item.id === practice.id)?.questions || [],
        })),
      })),
      practices: flattenSammPractices(framework),
      scoring: 'Each practice score is the average of its two Atlas SAMM-aligned question responses.',
    });
  } catch (error) {
    console.error('Error fetching SAMM framework:', error);
    res.status(500).json({ error: 'Failed to fetch SAMM framework' });
  }
});

router.get('/assessments', requireAuth, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const requestedCompanyId = typeof req.query.companyId === 'string' ? req.query.companyId : null;
    const companyId = auth?.isAdmin ? requestedCompanyId : auth?.companyId;
    if (!auth?.isAdmin && !companyId) return res.status(403).json({ error: 'Company context is required' });

    const assessments = await prisma.sammAssessment.findMany({
      where: companyId ? { companyId } : {},
      include: assessmentInclude(),
      orderBy: { createdAt: 'desc' },
    });
    res.json(assessments.map(serializeAssessment));
  } catch (error) {
    console.error('Error listing SAMM assessments:', error);
    res.status(500).json({ error: 'Failed to list SAMM assessments' });
  }
});

router.get('/assessments/:id', requireAuth, async (req, res) => {
  try {
    const assessment = await prisma.sammAssessment.findUnique({
      where: { id: req.params.id },
      include: assessmentInclude(),
    });
    if (!assessment) return res.status(404).json({ error: 'SAMM assessment not found' });
    if (!canAccessCompany(req, assessment.companyId)) return res.status(403).json({ error: 'Permission denied' });
    res.json(serializeAssessment(assessment));
  } catch (error) {
    console.error('Error fetching SAMM assessment:', error);
    res.status(500).json({ error: 'Failed to fetch SAMM assessment' });
  }
});

router.post('/assessments', requireAuth, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const companyId = typeof req.body?.companyId === 'string' ? req.body.companyId : auth?.companyId;
    if (!companyId || !canAccessCompany(req, companyId)) return res.status(403).json({ error: 'Permission denied' });
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const framework = await ensureSammFramework();
    const assessment = await prisma.sammAssessment.create({
      data: {
        companyId,
        frameworkId: framework.id,
        createdById: auth.userId,
        ownerName: typeof req.body?.ownerName === 'string' ? req.body.ownerName.trim() || null : null,
      },
      include: assessmentInclude(),
    });
    res.status(201).json(serializeAssessment(assessment));
  } catch (error) {
    console.error('Error creating SAMM assessment:', error);
    res.status(500).json({ error: 'Failed to create SAMM assessment' });
  }
});

router.put('/assessments/:id', requireAuth, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const existing = await prisma.sammAssessment.findUnique({
      where: { id: req.params.id },
      include: { framework: { include: { domains: { include: { practices: true } } } } },
    });
    if (!existing) return res.status(404).json({ error: 'SAMM assessment not found' });
    if (!canAccessCompany(req, existing.companyId)) return res.status(403).json({ error: 'Permission denied' });
    if (existing.status !== 'draft') return res.status(409).json({ error: 'Completed assessments are immutable' });

    const practices = flattenSammPractices(existing.framework);
    const practicesById = new Map(practices.map((practice) => [practice.id, practice]));
    const responses = Array.isArray(req.body?.responses) ? req.body.responses : [];
    const seen = new Set();
    for (const response of responses) {
      if (!practicesById.has(response.practiceId) || seen.has(response.practiceId)) {
        return res.status(400).json({ error: 'Each response must reference a unique practice in this framework' });
      }
      if (response.answers !== null && response.answers !== undefined
        && (typeof response.answers !== 'object' || Array.isArray(response.answers))) {
        return res.status(400).json({ error: 'SAMM answers must be keyed by stream ID' });
      }
      seen.add(response.practiceId);
    }
    const complete = req.body?.status === 'completed';
    const scoredResponses = responses.map((response) => ({
      ...response,
      score: scoreAtlasSammPractice(practicesById.get(response.practiceId).key, response.answers),
    }));
    if (complete && (scoredResponses.length !== practices.length || scoredResponses.some((response) => response.score === null))) {
      return res.status(400).json({ error: 'Answer both questions for all 15 practices before submitting' });
    }

    const now = new Date();
    const assessment = await prisma.$transaction(async (tx) => {
      for (const response of scoredResponses) {
        await tx.sammAssessmentResponse.upsert({
          where: { assessmentId_practiceId: { assessmentId: existing.id, practiceId: response.practiceId } },
          create: {
            assessmentId: existing.id,
            practiceId: response.practiceId,
            score: response.score,
            answers: response.answers || {},
            rationale: typeof response.rationale === 'string' ? response.rationale.trim() || null : null,
            evidenceReference: typeof response.evidenceReference === 'string' ? response.evidenceReference.trim() || null : null,
          },
          update: {
            score: response.score,
            answers: response.answers || {},
            rationale: typeof response.rationale === 'string' ? response.rationale.trim() || null : null,
            evidenceReference: typeof response.evidenceReference === 'string' ? response.evidenceReference.trim() || null : null,
          },
        });
      }
      return tx.sammAssessment.update({
        where: { id: existing.id },
        data: {
          ownerName: typeof req.body?.ownerName === 'string' ? req.body.ownerName.trim() || null : existing.ownerName,
          notes: typeof req.body?.notes === 'string' ? req.body.notes.trim() || null : existing.notes,
          status: complete ? 'completed' : 'draft',
          submittedAt: complete ? now : existing.submittedAt,
          nextDueAt: complete ? new Date(new Date(now).setMonth(now.getMonth() + 6)) : existing.nextDueAt,
        },
        include: assessmentInclude(),
      });
    });
    res.json(serializeAssessment(assessment));
  } catch (error) {
    console.error('Error saving SAMM assessment:', error);
    res.status(500).json({ error: 'Failed to save SAMM assessment' });
  }
});

router.post('/assessments/:id/review', requireAuth, requireAdmin, async (req, res) => {
  try {
    const assessment = await prisma.sammAssessment.findUnique({ where: { id: req.params.id }, select: { id: true, status: true } });
    if (!assessment) return res.status(404).json({ error: 'SAMM assessment not found' });
    if (assessment.status !== 'completed') return res.status(409).json({ error: 'Only completed assessments can be reviewed' });
    const reviewed = await prisma.sammAssessment.update({
      where: { id: assessment.id },
      data: { reviewerId: getAuthContext(req).userId, reviewedAt: new Date() },
      include: assessmentInclude(),
    });
    res.json(serializeAssessment(reviewed));
  } catch (error) {
    console.error('Error reviewing SAMM assessment:', error);
    res.status(500).json({ error: 'Failed to review SAMM assessment' });
  }
});

export default router;
