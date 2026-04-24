import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

const listSelect = {
  id: true,
  userId: true,
  scope: true,
  companyId: true,
  requestPayload: true,
  status: true,
  message: true,
  error: true,
  runStartedAt: true,
  durationMs: true,
  createdAt: true,
  completedAt: true,
  updatedAt: true,
};

/**
 * @param {import('@prisma/client').SecurityFindingsJob} job
 * @param {string | null} [companyName]
 */
function jobToJson(job, companyName) {
  return {
    id: job.id,
    scope: job.scope,
    companyId: job.companyId,
    companyName: companyName ?? null,
    status: job.status,
    message: job.message,
    error: job.error,
    runStartedAt: job.runStartedAt,
    durationMs: job.durationMs,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  };
}

/** GET /api/security-findings/jobs — list current user's jobs (newest first) */
router.get('/jobs', async (req, res) => {
  try {
    const userId = req.session.userId;
    const jobs = await prisma.securityFindingsJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: listSelect,
    });
    const cids = [...new Set(jobs.map((j) => j.companyId).filter((id) => id != null && id !== ''))];
    const names = cids.length
      ? await prisma.company.findMany({ where: { id: { in: cids } }, select: { id: true, name: true } })
      : [];
    const m = new Map(names.map((c) => [c.id, c.name]));
    return res.json({
      jobs: jobs.map((j) => jobToJson(j, j.companyId ? m.get(j.companyId) ?? null : null)),
    });
  } catch (e) {
    console.error('security findings jobs list', e);
    return res.status(500).json({ error: 'Failed to list jobs' });
  }
});

/** GET /api/security-findings/jobs/:id */
router.get('/jobs/:id', async (req, res) => {
  try {
    const userId = req.session.userId;
    const job = await prisma.securityFindingsJob.findFirst({
      where: { id: req.params.id, userId },
      select: listSelect,
    });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const companyName = job.companyId
      ? (await prisma.company.findUnique({ where: { id: job.companyId }, select: { name: true } }))?.name ?? null
      : null;
    return res.json({ ...jobToJson(job, companyName) });
  } catch (e) {
    console.error('security findings job get', e);
    return res.status(500).json({ error: 'Failed to get job' });
  }
});

/** GET /api/security-findings/jobs/:id/csv */
router.get('/jobs/:id/csv', async (req, res) => {
  try {
    const userId = req.session.userId;
    const job = await prisma.securityFindingsJob.findFirst({
      where: { id: req.params.id, userId },
      select: { status: true, resultCsv: true },
    });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (job.status !== 'complete' || !job.resultCsv) {
      return res.status(409).json({ error: 'Not ready' });
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="security-findings-${req.params.id}.csv"`);
    return res.send(job.resultCsv);
  } catch (e) {
    console.error('security findings job csv', e);
    return res.status(500).json({ error: 'Failed to download' });
  }
});

export default router;
