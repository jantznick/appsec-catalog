import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Checkbox } from '../ui/Checkbox.jsx';
import { Input } from '../ui/Input.jsx';
import { Select } from '../ui/Select.jsx';

const TIME_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom (days)…' },
];

const TOAST_EXPORT_GENERIC =
  'Something went wrong. If this continues, ask an administrator to check server logs.';

/** Resumes in-flight or completed jobs when the modal reopens. */
const PENDING_EXPORT_JOB_ID_KEY = 'appsec:securityFindings:pendingJobId';

/**
 * @param {string} jobId
 */
async function downloadCsvForJobId(jobId) {
  const p = `/api/security-findings/jobs/${encodeURIComponent(jobId)}/csv`;
  const text = await api.fetchSecurityFindingsCsv(p);
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = `security-findings-${jobId.slice(0, 8)}.csv`;
  a.click();
  URL.revokeObjectURL(u);
}

/**
 * @param {object} p
 * @param {boolean} p.open
 * @param {() => void} p.onClose
 * @param { 'admin' | 'company' } p.mode
 * @param {string} [p.companyId] for company mode
 * @param {string} [p.companyName] label for company mode
 */
export function SecurityFindingsExportModal({ open, onClose, mode, companyId, companyName }) {
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [companies, setCompanies] = useState(/** @type {Array<{ id: string, name: string, applicationCount: number, integrations: string[] }>} */ ([]));
  const [selected, setSelected] = useState(/** @type {Record<string, boolean>} */ ({}));
  const [separateByApp, setSeparateByApp] = useState(true);
  const [includeTenable, setIncludeTenable] = useState(true);
  const [includeWiz, setIncludeWiz] = useState(true);
  const [timeMode, setTimeMode] = useState('all');
  const [customDays, setCustomDays] = useState('30');
  const [jobId, setJobId] = useState(/** @type {string | null} */ (null));
  const [jobStatus, setJobStatus] = useState(/** @type {string} */ (''));
  const [exporting, setExporting] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const pollIntervalRef = useRef(/** @type {ReturnType<typeof setInterval> | null} */ (null));
  const pollSessionRef = useRef(0);

  const buildProvidersBody = useCallback(
    () => ({
      TENABLE_IO: includeTenable,
      WIZ: includeWiz,
    }),
    [includeTenable, includeWiz],
  );

  const load = useCallback(async () => {
    if (!open) {
      return;
    }
    setLoadingPreview(true);
    try {
      if (mode === 'admin') {
        const d = await api.getAdminSecurityFindingsPreview();
        setCompanies(d.companies || []);
        setSelected(
          (d.companies || []).reduce((a, c) => {
            a[c.id] = true;
            return a;
          }, /** @type {Record<string, boolean>} */ ({})),
        );
        setIncludeTenable(true);
        setIncludeWiz(true);
      } else {
        const d = await api.getCompanySecurityFindingsPreview(companyId);
        setCompanies(d.companies || []);
        if (d.companies?.[0]) {
          setSelected({ [d.companies[0].id]: true });
          const int = d.companies[0].integrations || [];
          if (int.length > 0) {
            setIncludeTenable(int.includes('Tenable WAS'));
            setIncludeWiz(int.includes('Wiz SAST'));
          } else {
            setIncludeTenable(true);
            setIncludeWiz(true);
          }
        }
      }
    } catch (e) {
      console.error('[SecurityFindingsExportModal] load preview failed', e);
      toast.error(TOAST_EXPORT_GENERIC);
    } finally {
      setLoadingPreview(false);
    }
  }, [open, mode, companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const clearPoll = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollSessionRef.current += 1;
  }, []);

  const handleRequestClose = useCallback(() => {
    if (exporting && !downloaded) {
      toast.info(
        'Closing stops auto-download. The job keeps running; open Export jobs to download when it finishes.',
        7000,
      );
    }
    clearPoll();
    onClose();
  }, [clearPoll, onClose, exporting, downloaded]);

  useEffect(() => {
    if (!open) {
      clearPoll();
      setJobId(null);
      setJobStatus('');
      setExporting(false);
      setDownloaded(false);
    }
  }, [open, clearPoll]);

  useEffect(() => () => clearPoll(), [clearPoll]);

  const buildTimeBody = () => {
    if (timeMode === 'all') {
      return { type: 'all' };
    }
    if (timeMode === 'custom') {
      const d = Math.max(1, Math.min(3650, parseInt(String(customDays), 10) || 30));
      return { type: 'lastDays', days: d };
    }
    return { type: 'lastDays', days: parseInt(timeMode, 10) };
  };

  /**
   * @param {string} jid
   * @param {{ skipSetStorage?: boolean }} [opts]
   */
  const poll = useCallback(
    (jid, opts = {}) => {
      if (!opts.skipSetStorage) {
        sessionStorage.setItem(PENDING_EXPORT_JOB_ID_KEY, jid);
      }
      clearPoll();
      const session = pollSessionRef.current;
      const run = async () => {
        if (session !== pollSessionRef.current) {
          return;
        }
        try {
          const s = await api.getMySecurityFindingsJob(jid);
          if (session !== pollSessionRef.current) {
            return;
          }
          setJobStatus(s.message || s.status || '…');
          if (s.status === 'error') {
            clearPoll();
            setExporting(false);
            sessionStorage.removeItem(PENDING_EXPORT_JOB_ID_KEY);
            console.error('[SecurityFindingsExportModal] job failed', {
              jobId: jid,
              error: s.error,
              message: s.message,
            });
            toast.error(TOAST_EXPORT_GENERIC);
            return;
          }
          if (s.status === 'complete') {
            clearPoll();
            if (session !== pollSessionRef.current) {
              return;
            }
            setExporting(false);
            setDownloaded(true);
            try {
              await downloadCsvForJobId(jid);
              if (session !== pollSessionRef.current) {
                return;
              }
              sessionStorage.removeItem(PENDING_EXPORT_JOB_ID_KEY);
              toast.success('Download started');
            } catch (e) {
              console.error('[SecurityFindingsExportModal] poll or download failed', e);
              if (session !== pollSessionRef.current) {
                return;
              }
              setDownloaded(false);
              toast.error(TOAST_EXPORT_GENERIC);
            }
          }
        } catch (e) {
          console.error('[SecurityFindingsExportModal] poll or download failed', e);
          if (session !== pollSessionRef.current) {
            return;
          }
          clearPoll();
          setExporting(false);
          sessionStorage.removeItem(PENDING_EXPORT_JOB_ID_KEY);
          toast.error(TOAST_EXPORT_GENERIC);
        }
      };
      void run();
      pollIntervalRef.current = window.setInterval(() => {
        void run();
      }, 2000);
    },
    [clearPoll],
  );

  /** Reopen: resume completed job (auto-download) or running job (poll), using session key. */
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const pending = sessionStorage.getItem(PENDING_EXPORT_JOB_ID_KEY);
      if (!pending) {
        return;
      }
      if (pollIntervalRef.current) {
        return;
      }
      try {
        const s = await api.getMySecurityFindingsJob(pending);
        if (cancelled) {
          return;
        }
        if (s.status === 'complete') {
          if (sessionStorage.getItem(PENDING_EXPORT_JOB_ID_KEY) !== pending) {
            return;
          }
          sessionStorage.removeItem(PENDING_EXPORT_JOB_ID_KEY);
          try {
            await downloadCsvForJobId(pending);
            if (cancelled) {
              return;
            }
            setJobId(pending);
            setJobStatus('Complete');
            setDownloaded(true);
            toast.success('Report downloaded');
          } catch (e) {
            console.error('[SecurityFindingsExportModal] resume download failed', e);
            toast.error(TOAST_EXPORT_GENERIC);
          }
        } else if (s.status === 'error' || s.status === 'cancelled') {
          sessionStorage.removeItem(PENDING_EXPORT_JOB_ID_KEY);
        } else if (s.status === 'running') {
          setJobId(pending);
          setExporting(true);
          setJobStatus(s.message || s.status);
          void poll(pending, { skipSetStorage: true });
        }
      } catch (e) {
        console.error('[SecurityFindingsExportModal] resume job check', e);
        sessionStorage.removeItem(PENDING_EXPORT_JOB_ID_KEY);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, poll]);

  const startExport = async () => {
    if (exporting) {
      return;
    }
    if (!includeTenable && !includeWiz) {
      toast.error('Select at least one integration');
      return;
    }
    setExporting(true);
    setDownloaded(false);
    const providers = buildProvidersBody();
    try {
      if (mode === 'admin') {
        const companyIds = companies.filter((c) => selected[c.id]).map((c) => c.id);
        if (companyIds.length === 0) {
          toast.error('Select at least one company');
          setExporting(false);
          return;
        }
        const t = buildTimeBody();
        const d = await api.startAdminSecurityFindingsJob({ companyIds, separateByApp, time: t, providers });
        setJobId(d.jobId);
        setJobStatus('queued');
        void poll(d.jobId);
      } else {
        const t = buildTimeBody();
        const d = await api.startCompanySecurityFindingsJob(companyId, { separateByApp: true, time: t, providers });
        setJobId(d.jobId);
        setJobStatus('queued');
        void poll(d.jobId);
      }
    } catch (e) {
      console.error('[SecurityFindingsExportModal] start job failed', e);
      setExporting(false);
      toast.error(TOAST_EXPORT_GENERIC);
    }
  };

  const atLeastOneIntegration = includeTenable || includeWiz;

  return (
    <Modal
      isOpen={open}
      onClose={handleRequestClose}
      title={mode === 'admin' ? 'Export security findings' : 'Export security findings'}
      size="lg"
    >
      <p className="text-sm text-gray-600 mb-2">
        Pulls selected tools in real time (may take a while). No deduplication between tools: critical/high/etc. are
        summed when both are included. The first line of the file is JSON metadata.{' '}
        <Link to="/export-jobs" className="text-blue-700 hover:underline font-medium">
          Export jobs
        </Link>
        {` `}lists past runs; completed reports can download automatically when you return to this window.
      </p>
      {mode === 'company' && companyName && (
        <p className="text-sm text-gray-800 mb-2">
          <span className="font-medium">Company: </span>
          {companyName}. Rows: company line (if configured), one line per app, then &quot;Applications total&quot; when
          breaking down by app.
        </p>
      )}

      <div className="mb-3 p-3 rounded-md border border-gray-200 bg-gray-50">
        <p className="text-sm font-medium text-gray-800 mb-2">Include in this export</p>
        <label className="flex items-start gap-2 text-sm text-gray-800 cursor-pointer">
          <Checkbox
            checked={includeTenable}
            onChange={(e) => setIncludeTenable(e.target.checked)}
          />
          <span>
            <span className="font-medium">Tenable.io WAS</span> (tag-based counts)
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-gray-800 cursor-pointer mt-1.5">
          <Checkbox checked={includeWiz} onChange={(e) => setIncludeWiz(e.target.checked)} />
          <span>
            <span className="font-medium">Wiz SAST</span> (per linked folder)
          </span>
        </label>
      </div>

      <div className="mb-3">
        <Select
          label="Time range"
          value={timeMode}
          onChange={(e) => setTimeMode(e.target.value)}
          options={TIME_OPTIONS}
        />
        {timeMode === 'custom' && (
          <div className="mt-2">
            <Input
              label="Days (1–3650)"
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              type="number"
            />
          </div>
        )}
      </div>

      {mode === 'admin' && (
        <div className="mb-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-800">
            <Checkbox
              checked={separateByApp}
              onChange={(e) => setSeparateByApp(e.target.checked)}
            />
            <span>Separate by application (company row, each app, app subtotal; off = one line per company)</span>
          </label>
        </div>
      )}

      {loadingPreview ? (
        <p className="text-sm text-gray-500 py-4">Loading companies…</p>
      ) : mode === 'admin' ? (
        <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-md divide-y">
          {companies.map((c) => (
            <label
              key={c.id}
              className="flex items-start gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
            >
              <Checkbox
                checked={!!selected[c.id]}
                onChange={() => {
                  setSelected((s) => ({ ...s, [c.id]: !s[c.id] }));
                }}
              />
              <span>
                <span className="font-medium text-gray-900">{c.name}</span>
                <span className="text-gray-500">
                  {' '}
                  — {c.applicationCount} app{c.applicationCount !== 1 ? 's' : ''}
                </span>
                <span className="text-gray-600"> — {c.integrations.length ? c.integrations.join(', ') : '—'}</span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-600 py-1">
          This export includes only <strong>this</strong> company&apos;s applications. Configured tools:{' '}
          {companies[0]?.integrations?.length ? companies[0].integrations.join(', ') : '—'}
        </div>
      )}

      {exporting && (
        <p className="text-sm text-blue-800 mt-3" role="status">
          {jobStatus || 'Preparing…'}
        </p>
      )}
      {downloaded && (
        <p className="text-sm text-green-700 mt-1">File saved. You can close this window.</p>
      )}

      <div className="flex justify-end gap-2 mt-6">
        <Button type="button" variant="ghost" onClick={handleRequestClose}>
          Close
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={startExport}
          disabled={exporting || loadingPreview || !atLeastOneIntegration}
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>
    </Modal>
  );
}
