import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth } from '../middleware/auth.js';
import { securityOverviewCsvFilename } from '../utils/securityOverviewFilename.js';

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

/** GET /api/security-findings/jobs - list current user's jobs (newest first) */
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

/** POST /api/security-findings/jobs/:id/cancel - best-effort stop; worker checks between steps */
router.post('/jobs/:id/cancel', async (req, res) => {
  try {
    const userId = req.session.userId;
    const id = req.params.id;
    const job = await prisma.securityFindingsJob.findFirst({
      where: { id, userId },
      select: { id: true, status: true, runStartedAt: true, createdAt: true },
    });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (job.status !== 'running') {
      return res.status(409).json({ error: 'Job is not running', status: job.status });
    }
    const t0 = job.runStartedAt ? job.runStartedAt.getTime() : job.createdAt.getTime();
    const durationMs = Math.max(0, Date.now() - t0);
    await prisma.securityFindingsJob.update({
      where: { id: job.id },
      data: {
        status: 'cancelled',
        message: 'Cancelled by user',
        completedAt: new Date(),
        durationMs,
        error: null,
      },
    });
    const full = await prisma.securityFindingsJob.findFirst({
      where: { id, userId },
      select: listSelect,
    });
    if (!full) {
      return res.status(404).json({ error: 'Job not found' });
    }
    const companyName = full.companyId
      ? (await prisma.company.findUnique({ where: { id: full.companyId }, select: { name: true } }))?.name ?? null
      : null;
    return res.json({ job: jobToJson(full, companyName) });
  } catch (e) {
    console.error('security findings job cancel', e);
    return res.status(500).json({ error: 'Failed to cancel job' });
  }
});

/** DELETE /api/security-findings/jobs/:id - own jobs only; not while running (cancel first) */
router.delete('/jobs/:id', async (req, res) => {
  try {
    const userId = req.session.userId;
    const id = req.params.id;
    const existing = await prisma.securityFindingsJob.findFirst({
      where: { id, userId },
      select: { status: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (existing.status === 'running') {
      return res.status(409).json({ error: 'Cancel the job first, or wait until it finishes' });
    }
    await prisma.securityFindingsJob.deleteMany({ where: { id, userId } });
    return res.status(204).send();
  } catch (e) {
    console.error('security findings job delete', e);
    return res.status(500).json({ error: 'Failed to delete job' });
  }
});

/** GET /api/security-findings/jobs/:id/csv */
router.get('/jobs/:id/csv', async (req, res) => {
  try {
    const userId = req.session.userId;
    const job = await prisma.securityFindingsJob.findFirst({
      where: { id: req.params.id, userId },
      select: { status: true, resultCsv: true, scope: true, companyId: true },
    });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (job.status !== 'complete' || !job.resultCsv) {
      return res.status(409).json({ error: 'Not ready' });
    }
    let companyName = null;
    if (job.scope === 'SINGLE_COMPANY' && job.companyId) {
      companyName = (await prisma.company.findUnique({ where: { id: job.companyId }, select: { name: true } }))?.name ?? null;
    }
    const filename = securityOverviewCsvFilename({ scope: job.scope, companyName });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(job.resultCsv);
  } catch (e) {
    console.error('security findings job csv', e);
    return res.status(500).json({ error: 'Failed to download' });
  }
});

export default router;
