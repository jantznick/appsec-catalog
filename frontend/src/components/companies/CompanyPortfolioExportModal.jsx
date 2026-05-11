import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Checkbox } from '../ui/Checkbox.jsx';

/**
 * @param {object} p
 * @param {boolean} p.open
 * @param {() => void} p.onClose
 * @param {Array<{ id: string, name: string, _count?: { applications?: number } }>} p.companies
 * @param {boolean} p.isAdmin
 */
export function CompanyPortfolioExportModal({ open, onClose, companies, isAdmin }) {
  const [selected, setSelected] = useState(/** @type {Record<string, boolean>} */ ({}));
  const [exporting, setExporting] = useState(false);

  const resetSelection = useCallback(() => {
    setSelected(
      companies.reduce((acc, c) => {
        acc[c.id] = true;
        return acc;
      }, /** @type {Record<string, boolean>} */ ({})),
    );
  }, [companies]);

  useEffect(() => {
    if (open) {
      resetSelection();
    }
  }, [open, resetSelection]);

  const selectedIds = companies.filter((c) => selected[c.id]).map((c) => c.id);

  const selectAll = () => {
    setSelected(
      companies.reduce((acc, c) => {
        acc[c.id] = true;
        return acc;
      }, {}),
    );
  };

  const selectNone = () => {
    setSelected(
      companies.reduce((acc, c) => {
        acc[c.id] = false;
        return acc;
      }, {}),
    );
  };

  const handleExport = async () => {
    if (selectedIds.length === 0) {
      toast.error('Select at least one company');
      return;
    }
    setExporting(true);
    try {
      const { text, filename } = await api.exportCompaniesPortfolioCsv(selectedIds);
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(u);
      toast.success('Download started');
      onClose();
    } catch (e) {
      console.error('[CompanyPortfolioExportModal] export failed', e);
      toast.error(e?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Export company portfolio" size="lg">
      <p className="text-sm text-gray-600 mb-4">
        One row per company: products and applications (comma-separated names plus counts), then{' '}
        <span className="font-medium text-gray-800">metadataCompleteness</span> and{' '}
        <span className="font-medium text-gray-800">securityCompleteness</span> as values like{' '}
        <span className="font-mono text-gray-800">27%</span>: each is the company-wide average of per-application
        completeness (Basic + Technical vs security-tool fields; NA excludes a field), same rules as the Applications
        list.
      </p>

      {isAdmin && companies.length > 0 && (
        <div className="flex gap-2 mb-3">
          <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
            Select all
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={selectNone}>
            Clear
          </Button>
        </div>
      )}

      {companies.length === 0 ? (
        <p className="text-sm text-gray-500 py-2">No companies to export.</p>
      ) : (
        <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-md divide-y">
          {companies.map((c) => (
            <label
              key={c.id}
              className={`flex items-start gap-3 px-3 py-2 text-sm max-w-full ${
                isAdmin ? 'hover:bg-gray-50 cursor-pointer' : ''
              }`}
            >
              <Checkbox
                checked={!!selected[c.id]}
                disabled={!isAdmin}
                onChange={() => {
                  if (!isAdmin) return;
                  setSelected((s) => ({ ...s, [c.id]: !s[c.id] }));
                }}
              />
              <span className="min-w-0 flex-1 leading-snug">
                <span className="font-medium text-gray-900">{c.name}</span>
                <span className="text-gray-500">
                  {' '}
                  — {c._count?.applications ?? 0} app{c._count?.applications !== 1 ? 's' : ''}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-6">
        <Button type="button" variant="ghost" onClick={onClose} disabled={exporting}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleExport}
          disabled={exporting || companies.length === 0 || selectedIds.length === 0}
          loading={exporting}
        >
          Download CSV
        </Button>
      </div>
    </Modal>
  );
}
