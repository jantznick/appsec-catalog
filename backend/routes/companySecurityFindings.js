import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth } from '../middleware/auth.js';
import {
  getExportPreviewList,
  buildSecurityFindingsCsv,
  parseTimeRange,
} from '../services/securityFindingsExportService.js';
import { createJob, updateJob, getJob } from '../jobs/securityFindingsJobStore.js';

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
    const { separateByApp, time } = req.body || {};
    const tr = parseTimeRange(time);
    const jobId = createJob();
    updateJob(jobId, { status: 'running', message: 'Starting…' });
    setImmediate(async () => {
      try {
        const csv = await buildSecurityFindingsCsv(
          prisma,
          {
            companyIds: [companyId],
            timeRange: tr,
            separateByApp: Boolean(separateByApp),
            onProgress: (msg) => {
              updateJob(jobId, { message: msg });
            },
          },
        );
        updateJob(jobId, { status: 'complete', message: 'Done', csv });
      } catch (e) {
        console.error('company security findings job', e);
        updateJob(jobId, { status: 'error', error: (e && e.message) || 'Export failed' });
      }
    });
    res.status(202).json({ jobId, message: 'Export started' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to start' });
  }
});

/** Same job store; poll by job id. Optional company check could verify job owner — omitted for PoC. */
router.get('/:companyId/security-findings/jobs/:id', requireAuth, async (req, res) => {
  if (!canAccess(req, req.params.companyId)) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  const j = getJob(req.params.id);
  if (!j) {
    return res.status(404).json({ error: 'Job not found' });
  }
  return res.json({
    status: j.status,
    message: j.message,
    error: j.error,
  });
});

router.get('/:companyId/security-findings/jobs/:id/csv', requireAuth, (req, res) => {
  if (!canAccess(req, req.params.companyId)) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  const j = getJob(req.params.id);
  if (!j) {
    return res.status(404).json({ error: 'Job not found' });
  }
  if (j.status !== 'complete' || !j.csv) {
    return res.status(409).json({ error: 'Not ready' });
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="security-findings-${req.params.id}.csv"`);
  return res.send(j.csv);
});

export default router;
