import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/Table.jsx';

const JOBS_ERR_TOAST =
  'Could not load jobs. If this continues, ask an administrator to check server logs.';

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function statusClass(status) {
  if (status === 'complete') return 'text-green-700';
  if (status === 'error') return 'text-red-700';
  if (status === 'cancelled') return 'text-gray-600';
  return 'text-amber-800';
}

function formatDurationMs(ms) {
  if (ms == null || Number.isNaN(/** @type {number} */(ms))) return '—';
  const n = Number(ms);
  if (n < 1000) {
    return `${n} ms`;
  }
  if (n < 60_000) {
    return `${(n / 1000).toFixed(1)} s`;
  }
  const m = Math.floor(n / 60_000);
  const s = Math.round((n % 60_000) / 1000);
  return s ? `${m}m ${s}s` : `${m}m`;
}

/**
 * @param {Record<string, unknown>} j
 * @param {string} st
 */
function RunTimeCell({ j, st }) {
  if (st === 'complete' || st === 'error' || st === 'cancelled') {
    return j.durationMs != null ? formatDurationMs(/** @type {number} */(j.durationMs)) : '—';
  }
  if (st === 'running' && j.runStartedAt) {
    return (
      <span
        className="text-amber-900"
        title="Export in progress — this page refreshes status every few seconds while a job is running"
      >
        In progress
        <span className="block text-xs text-gray-600">
          since {formatWhen(/** @type {string} */(j.runStartedAt))}
        </span>
      </span>
    );
  }
  if (st === 'running') {
    return <span className="text-gray-600" title="Waiting for worker to start">Queued</span>;
  }
  return '—';
}

/**
 * Tenable + Wiz CSV export jobs (your account).
 */
export function SecurityFindingsExportJobs() {
  const [jobs, setJobs] = useState(/** @type {Array<Record<string, unknown>>} */ ([]));
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(/** @type {string | null} */ (null));
  const [deletingId, setDeletingId] = useState(/** @type {string | null} */ (null));

  const load = useCallback(async (/** @type {{ silent?: boolean }} */ opts = {}) => {
    const silent = Boolean(opts.silent);
    try {
      if (!silent) {
        setLoading(true);
      }
      const d = await api.listMySecurityFindingsJobs();
      setJobs(d.jobs || []);
    } catch (e) {
      console.error('[SecurityFindingsExportJobs] load failed', e);
      toast.error(JOBS_ERR_TOAST);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasRunning = jobs.some((j) => j.status === 'running');
  useEffect(() => {
    if (!hasRunning) {
      return undefined;
    }
    const t = setInterval(() => {
      void load({ silent: true });
    }, 5000);
    return () => clearInterval(t);
  }, [hasRunning, load]);

  const cancelJob = async (jobId) => {
    try {
      setCancellingId(jobId);
      await api.cancelMySecurityFindingsJob(jobId);
      toast.success('Job cancelled');
      await load({ silent: true });
    } catch (e) {
      console.error('[SecurityFindingsExportJobs] cancel failed', e);
      toast.error('Could not cancel the job. Try again or use server logs to investigate.');
    } finally {
      setCancellingId(null);
    }
  };

  const deleteJob = async (jobId) => {
    if (
      !window.confirm(
        'Delete this job and its stored result from the server? This cannot be undone.',
      )
    ) {
      return;
    }
    try {
      setDeletingId(jobId);
      await api.deleteMySecurityFindingsJob(jobId);
      toast.success('Job removed');
      await load({ silent: true });
    } catch (e) {
      console.error('[SecurityFindingsExportJobs] delete failed', e);
      toast.error('Could not delete the job. Try again or use server logs to investigate.');
    } finally {
      setDeletingId(null);
    }
  };

  const download = async (jobId) => {
    const path = `/api/security-findings/jobs/${encodeURIComponent(jobId)}/csv`;
    try {
      const text = await api.fetchSecurityFindingsCsv(path);
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = `security-findings-${String(jobId).slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(u);
      toast.success('Download started');
    } catch (e) {
      console.error('[SecurityFindingsExportJobs] download failed', e);
      toast.error('Could not download the file. If the job completed, try again; otherwise ask an administrator.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">Security export jobs</h1>
        <Button type="button" variant="secondary" onClick={() => void load({ silent: hasRunning })}>
          Refresh
        </Button>
      </div>
      <p className="text-sm text-gray-600 mb-4 max-w-3xl">
        Tenable and Wiz CSV exports you started. While a job is running, vendor API calls can take many minutes; this
        list refreshes every few seconds until no job is running. You can <strong>Cancel</strong> a running job; the
        worker stops at the next internal step (a long in-flight vendor call may still need to finish).         When status is <span className="text-green-700">complete</span>, use <strong>Download CSV</strong>. You can
        <strong> Delete</strong> finished or failed jobs to free space (not available while a job is still running — use
        <strong> Cancel</strong> first if needed). <strong>Retention:</strong> when you start a new export, we remove your
        completed or failed jobs that are more than 30 days old. Running jobs are never auto-deleted.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Your jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-gray-600">No jobs yet. Start an export from company integrations or admin.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Company / detail</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Run time</TableHead>
                  <TableHead className="w-52 min-w-[12rem]"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => {
                  const id = String(j.id);
                  const st = String(j.status || 'unknown');
                  const companyName = j.companyName;
                  const companyId = j.companyId;
                  const scope = String(j.scope);
                  return (
                    <TableRow key={id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatWhen(/** @type {string | undefined} */ (j.createdAt))}
                      </TableCell>
                      <TableCell className="text-sm">{scope === 'ADMIN_MULTI' ? 'Multi-company' : 'Single company'}</TableCell>
                      <TableCell className="text-sm">
                        {scope === 'ADMIN_MULTI' ? (
                          <span className="text-gray-700">Admin selection (see CSV)</span>
                        ) : companyId && companyName ? (
                          <Link
                            to={`/companies/${encodeURIComponent(companyId)}`}
                            className="text-blue-700 hover:underline"
                          >
                            {companyName}
                          </Link>
                        ) : companyId ? (
                          <span className="text-gray-600 font-mono text-xs">{companyId}</span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm font-medium ${statusClass(st)}`}>
                          {st}
                        </span>
                        {j.message && st !== 'complete' && st !== 'error' && (
                          <div className="text-xs text-gray-600 max-w-sm mt-0.5" title={String(j.message)}>
                            {String(j.message)}
                          </div>
                        )}
                        {st === 'error' && (
                          <div className="text-xs text-red-800 max-w-sm mt-0.5">
                            The export could not be completed. You can try again. Administrators can use server logs
                            to investigate.
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        <RunTimeCell j={j} st={st} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 items-stretch sm:items-end">
                          {st === 'running' && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={cancellingId === id}
                              onClick={() => void cancelJob(id)}
                            >
                              {cancellingId === id ? 'Cancelling…' : 'Cancel'}
                            </Button>
                          )}
                          {st === 'complete' && (
                            <Button type="button" variant="primary" size="sm" onClick={() => void download(id)}>
                              Download CSV
                            </Button>
                          )}
                          {st !== 'running' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-700 hover:text-red-800 hover:bg-red-50"
                              disabled={deletingId === id}
                              onClick={() => void deleteJob(id)}
                            >
                              {deletingId === id ? 'Deleting…' : 'Delete'}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
