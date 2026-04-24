import { useState, useEffect, useCallback } from 'react';
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
  /** Company export is always "by application" (company row + per-app + app subtotal). */
  const [separateByApp, setSeparateByApp] = useState(true);
  const [timeMode, setTimeMode] = useState('all');
  const [customDays, setCustomDays] = useState('30');
  const [jobId, setJobId] = useState(/** @type {string | null} */ (null));
  const [jobStatus, setJobStatus] = useState(/** @type {string} */ (''));
  const [exporting, setExporting] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

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
      } else {
        const d = await api.getCompanySecurityFindingsPreview(companyId);
        setCompanies(d.companies || []);
        if (d.companies?.[0]) {
          setSelected({ [d.companies[0].id]: true });
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load companies for export');
    } finally {
      setLoadingPreview(false);
    }
  }, [open, mode, companyId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!open) {
      setJobId(null);
      setJobStatus('');
      setExporting(false);
      setDownloaded(false);
    }
  }, [open]);

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

  const startExport = async () => {
    if (exporting) {
      return;
    }
    setExporting(true);
    setDownloaded(false);
    try {
      if (mode === 'admin') {
        const companyIds = companies.filter((c) => selected[c.id]).map((c) => c.id);
        if (companyIds.length === 0) {
          toast.error('Select at least one company');
          setExporting(false);
          return;
        }
        const t = buildTimeBody();
        const d = await api.startAdminSecurityFindingsJob({ companyIds, separateByApp, time: t });
        setJobId(d.jobId);
        setJobStatus('queued');
        poll(
          d.jobId,
          (j) => `/api/admin/security-findings/jobs/${j}/csv`,
        );
      } else {
        const t = buildTimeBody();
        const d = await api.startCompanySecurityFindingsJob(companyId, { separateByApp: true, time: t });
        setJobId(d.jobId);
        setJobStatus('queued');
        poll(
          d.jobId,
          (j) => `/api/companies/${encodeURIComponent(companyId)}/security-findings/jobs/${j}/csv`,
        );
      }
    } catch (e) {
      const err = /** @type {Error} */ (e);
      console.error(e);
      setExporting(false);
      toast.error(err.message || 'Export failed');
    }
  };

  const poll = (jid, getCsvPath) => {
    let int = 0;
    let finished = false;
    const run = async () => {
      if (finished) {
        return;
      }
      try {
        let s;
        if (mode === 'admin') {
          s = await api.getAdminSecurityFindingsJob(jid);
        } else {
          s = await api.getCompanySecurityFindingsJob(companyId, jid);
        }
        setJobStatus(s.message || s.status || '…');
        if (s.status === 'error') {
          if (int) {
            clearInterval(int);
          }
          finished = true;
          setExporting(false);
          toast.error(s.error || 'Export error');
          return;
        }
        if (s.status === 'complete') {
          if (int) {
            clearInterval(int);
          }
          finished = true;
          setExporting(false);
          setDownloaded(true);
          const p = getCsvPath(jid);
          const text = await api.fetchSecurityFindingsCsv(p);
          const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
          const u = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = u;
          a.download = `security-findings-${jid.slice(0, 8)}.csv`;
          a.click();
          URL.revokeObjectURL(u);
          toast.success('Download started');
        }
      } catch (e) {
        console.error(e);
        if (int) {
          clearInterval(int);
        }
        finished = true;
        setExporting(false);
        toast.error(/** @type {Error} */(e).message);
      }
    };
    void run();
    int = window.setInterval(() => {
      void run();
    }, 2000);
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={mode === 'admin' ? 'Export security findings' : 'Export security findings'}
      size="lg"
    >
      <p className="text-sm text-gray-600 mb-3">
        Pulls <strong className="font-medium">Tenable.io WAS</strong> and{' '}
        <strong className="font-medium">Wiz SAST</strong> in real time (may take a while). No deduplication
        between tools: critical/high/etc. are summed. First line of the file is JSON metadata, then a footer total.
      </p>
      {mode === 'company' && companyName && (
        <p className="text-sm text-gray-800 mb-2">
          <span className="font-medium">Company: </span>
          {companyName}. Rows are: company-scoped tag/folder (if any), one line per app, a subtotal of
          app lines (compare to the company line if you like), then the file footer total.
        </p>
      )}

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
          This export includes only <strong>this</strong> company&apos;s applications. Integrations:{' '}
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
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button type="button" variant="primary" onClick={startExport} disabled={exporting || loadingPreview}>
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>
    </Modal>
  );
}
