import { buildSecurityFindingsCsv, parseTimeRange } from './securityFindingsExportService.js';

const LOG = 'securityFindingsJob';

function logInfo(payload) {
  console.log(`[${LOG}]`, JSON.stringify({ ...payload, t: new Date().toISOString() }));
}

/** @typedef {'ADMIN_MULTI' | 'SINGLE_COMPANY'} JobScope */

/**
 * @param {object} o
 * @param {import('@prisma/client').PrismaClient} o.prisma
 * @param {string} o.userId
 * @param {JobScope} o.scope
 * @param {string | null} o.companyId
 * @param {object} o.requestPayload
 */
export async function createSecurityFindingsJob({ prisma, userId, scope, companyId, requestPayload }) {
  const job = await prisma.securityFindingsJob.create({
    data: {
      userId,
      scope,
      companyId,
      requestPayload,
      status: 'running',
      message: 'Queued — starting…',
    },
  });
  logInfo({
    event: 'created',
    jobId: job.id,
    userId,
    scope,
    companyId,
  });
  setImmediate(() => runSecurityFindingsJob({ prisma, jobId: job.id }).catch((e) => {
    console.error(`[${LOG}] run async failure`, e);
  }));
  return job.id;
}

/**
 * @param {object} o
 * @param {import('@prisma/client').PrismaClient} o.prisma
 * @param {string} o.jobId
 */
export async function runSecurityFindingsJob({ prisma, jobId }) {
  const job = await prisma.securityFindingsJob.findUnique({ where: { id: jobId } });
  if (!job) {
    logInfo({ event: 'aborted_no_row', jobId });
    return;
  }
  const workStart = Date.now();
  await prisma.securityFindingsJob.update({
    where: { id: jobId },
    data: { runStartedAt: new Date() },
  });
  const { separateByApp, time } = /** @type {{ separateByApp?: boolean, time?: object }} */ (job.requestPayload);
  let companyIds;
  if (job.scope === 'SINGLE_COMPANY') {
    if (!job.companyId) {
      await failJob(
        prisma,
        jobId,
        workStart,
        new Error('Missing companyId for job'),
      );
      return;
    }
    companyIds = [job.companyId];
  } else {
    const payload = /** @type {{ companyIds?: string[] }} */ (job.requestPayload);
    const ids = payload.companyIds;
    if (!Array.isArray(ids) || ids.length === 0) {
      await failJob(
        prisma,
        jobId,
        workStart,
        new Error('Invalid companyIds in job'),
      );
      return;
    }
    companyIds = ids;
  }
  let tr;
  try {
    tr = parseTimeRange(time);
  } catch (e) {
    await failJob(
      prisma,
      jobId,
      workStart,
      /** @type {Error} */ (e),
    );
    return;
  }
  logInfo({
    event: 'run_start',
    jobId,
    userId: job.userId,
    scope: job.scope,
    companyId: job.companyId,
    companyCount: companyIds.length,
    separateByApp: Boolean(separateByApp),
  });

  const setMsg = (message) => {
    return prisma.securityFindingsJob.update({
      where: { id: jobId },
      data: { message },
    });
  };

  try {
    await setMsg('Running — contacting vendor APIs (this can take several minutes)…');
    const csv = await buildSecurityFindingsCsv(prisma, {
      companyIds,
      timeRange: tr,
      separateByApp: Boolean(separateByApp),
      onProgress: async (msg) => {
        const cur = await prisma.securityFindingsJob.findUnique({
          where: { id: jobId },
          select: { status: true },
        });
        if (cur?.status === 'cancelled') {
          const e = new Error('JOB_CANCELLED');
          e.code = 'JOB_CANCELLED';
          throw e;
        }
        logInfo({ event: 'progress', jobId, message: String(msg).slice(0, 200) });
        await setMsg(msg);
      },
    });
    const durationMs = Date.now() - workStart;
    const byteLen = Buffer.byteLength(csv, 'utf8');
    const saved = await prisma.securityFindingsJob.updateMany({
      where: { id: jobId, status: 'running' },
      data: {
        status: 'complete',
        message: 'Complete',
        resultCsv: csv,
        completedAt: new Date(),
        error: null,
        durationMs,
      },
    });
    if (saved.count === 0) {
      logInfo({ event: 'complete_skipped', jobId, reason: 'job not in running state (e.g. cancelled)' });
      return;
    }
    logInfo({
      event: 'complete',
      jobId,
      userId: job.userId,
      durationMs,
      csvBytes: byteLen,
    });
  } catch (e) {
    const err = /** @type {Error & { code?: string }} */ (e);
    if (err.code === 'JOB_CANCELLED' || err.message === 'JOB_CANCELLED') {
      const cur = await prisma.securityFindingsJob.findUnique({
        where: { id: jobId },
        select: { status: true },
      });
      if (cur?.status === 'cancelled') {
        logInfo({ event: 'run_stopped_cancelled', jobId });
        return;
      }
    }
    logInfo({
      event: 'error',
      jobId,
      userId: job.userId,
      err: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
    await failJob(prisma, jobId, workStart, err, { alreadyLogged: true });
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} jobId
 * @param {number} workStart
 * @param {Error} err
 * @param {{ alreadyLogged?: boolean }} [o]
 */
async function failJob(prisma, jobId, workStart, err, o = {}) {
  if (err?.code === 'JOB_CANCELLED' || err?.message === 'JOB_CANCELLED') {
    return;
  }
  const durationMs = Date.now() - workStart;
  if (!o.alreadyLogged) {
    logInfo({ event: 'error', jobId, err: err.message });
  }
  console.error(`[${LOG}] job ${jobId} failed:`, err);
  const u = await prisma.securityFindingsJob.updateMany({
    where: { id: jobId, status: 'running' },
    data: {
      status: 'error',
      error: err.message || 'Export failed',
      message: 'Failed',
      completedAt: new Date(),
      durationMs,
    },
  });
  if (u.count === 0) {
    logInfo({ event: 'failJob_skipped', jobId, reason: 'not running' });
  }
}
