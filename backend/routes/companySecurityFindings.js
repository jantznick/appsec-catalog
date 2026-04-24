import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth } from '../middleware/auth.js';
import {
  getExportPreviewList,
  parseTimeRange,
  parseExportProviders,
  assertAtLeastOneProvider,
} from '../services/securityFindingsExportService.js';
import { createSecurityFindingsJob } from '../services/securityFindingsJobRunner.js';

const router = express.Router();

function canAccess(req, companyId) {
  return req.session.isAdmin || req.session.companyId === companyId;
}

/**
 * /api/companies/:companyId/security-findings/...
 * Mounted before the generic :id company router
 */
router.get('/:companyId/security-findings/preview', requireAuth, async (req, res) => {
  const { companyId } = req.params;
  if (!canAccess(req, companyId)) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  try {
    const companies = await getExportPreviewList(prisma, { companyIds: [companyId] });
    res.json({ companies });
  } catch (e) {
    console.error('company security findings preview', e);
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/:companyId/security-findings/jobs', requireAuth, async (req, res) => {
  const { companyId } = req.params;
  if (!canAccess(req, companyId)) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  try {
    const { separateByApp, time, providers: providersBody } = req.body || {};
    parseTimeRange(time);
    const providers = parseExportProviders(providersBody);
    assertAtLeastOneProvider(providers);
    const userId = req.session.userId;
    const jobId = await createSecurityFindingsJob({
      prisma,
      userId,
      scope: 'SINGLE_COMPANY',
      companyId,
      requestPayload: { separateByApp: separateByApp !== false, time, providers },
    });
    res.status(202).json({ jobId, message: 'Export started' });
  } catch (e) {
    const err = /** @type {Error & { statusCode?: number }} */(e);
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message || 'Invalid request' });
    }
    return res.status(500).json({ error: 'Failed to start' });
  }
});

/** Poll job status; must own the job and company must match. */
router.get('/:companyId/security-findings/jobs/:id', requireAuth, async (req, res) => {
  if (!canAccess(req, req.params.companyId)) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  const j = await prisma.securityFindingsJob.findFirst({
    where: {
      id: req.params.id,
      userId: req.session.userId,
      companyId: req.params.companyId,
    },
    select: { status: true, message: true, error: true },
  });
  if (!j) {
    return res.status(404).json({ error: 'Job not found' });
  }
  return res.json({
    status: j.status,
    message: j.message,
    error: j.error,
  });
});

router.get('/:companyId/security-findings/jobs/:id/csv', requireAuth, async (req, res) => {
  if (!canAccess(req, req.params.companyId)) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  const j = await prisma.securityFindingsJob.findFirst({
    where: {
      id: req.params.id,
      userId: req.session.userId,
      companyId: req.params.companyId,
    },
    select: { status: true, resultCsv: true },
  });
  if (!j) {
    return res.status(404).json({ error: 'Job not found' });
  }
  if (j.status !== 'complete' || !j.resultCsv) {
    return res.status(409).json({ error: 'Not ready' });
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="security-findings-${req.params.id}.csv"`);
  return res.send(j.resultCsv);
});

export default router;
