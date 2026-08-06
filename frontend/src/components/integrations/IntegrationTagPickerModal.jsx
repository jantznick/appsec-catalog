import { useMemo, useState, useEffect } from 'react';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { Modal } from '../ui/Modal.jsx';

/**
 * @param {string} text
 * @param {string} query
 */
function highlightParts(text, query) {
  const q = query.trim();
  if (!q || !text) {
    return [{ text: text || '', match: false }];
  }
  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  const parts = [];
  let from = 0;
  let idx = lower.indexOf(qLower, from);
  if (idx === -1) {
    return [{ text, match: false }];
  }
  while (idx !== -1) {
    if (idx > from) {
      parts.push({ text: text.slice(from, idx), match: false });
    }
    parts.push({ text: text.slice(idx, idx + q.length), match: true });
    from = idx + q.length;
    idx = lower.indexOf(qLower, from);
  }
  if (from < text.length) {
    parts.push({ text: text.slice(from), match: false });
  }
  return parts;
}

/**
 * Tenable / Wiz tag or folder picker: debounced search, category-style primary line, scrollable list.
 */
export function IntegrationTagPickerModal({
  isOpen,
  onClose,
  title,
  isWiz,
  tags,
  loading,
  selectedUuid,
  onSelectUuid,
  onSave,
  saving,
  /** @param {{ uuid: string, value?: string, display_label?: string, category_name?: string }} t */
  getLabel = (t) =>
    t.display_label || t.value || (t.uuid ? `${t.uuid.slice(0, 8)}…` : '') || '',
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(h);
  }, [search]);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setDebouncedSearch('');
    }
  }, [isOpen]);

  const q = debouncedSearch.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return tags;
    return tags.filter((t) => {
      const label = getLabel(t);
      return (
        (label && label.toLowerCase().includes(q)) ||
        (t.uuid && t.uuid.toLowerCase().includes(q)) ||
        (t.value && t.value.toLowerCase().includes(q)) ||
        (t.category_name && t.category_name.toLowerCase().includes(q))
      );
    });
  }, [tags, q, getLabel]);

  const sorted = useMemo(() => {
    const out = [...filtered];
    out.sort((a, b) =>
      (getLabel(a) || '').localeCompare(getLabel(b) || '', undefined, { sensitivity: 'base' }),
    );
    return out;
  }, [filtered, getLabel]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title={title}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} loading={saving} disabled={loading}>
            Save link
          </Button>
        </>
      }
    >
      {loading ? (
        <p className="text-sm text-gray-600">{isWiz ? 'Loading folders…' : 'Loading tags…'}</p>
      ) : tags.length === 0 ? (
        <p className="text-sm text-gray-600">
          {isWiz
            ? 'No folders returned. Check API permissions and the GraphQL endpoint for this integration.'
            : 'No tags returned. Check API permissions for this tool.'}
        </p>
      ) : (
        <div className="space-y-3">
          <Input
            type="search"
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              isWiz ? 'Filter by folder name or id…' : 'Filter by category, name, or id…'
            }
            autoComplete="off"
            autoFocus
          />
          <p className="text-xs text-gray-500">
            {sorted.length} of {tags.length} {isWiz ? 'folders' : 'tags'}
            {search.trim() ? ' (search updates as you type)' : ''}
          </p>
          {sorted.length === 0 ? (
            <p className="text-sm text-gray-600">No matching results. Try a different search.</p>
          ) : (
            <ul
              className="max-h-72 overflow-y-auto rounded-md border border-gray-200 bg-surface shadow-inner divide-y divide-gray-100"
              role="listbox"
            >
              {sorted.map((t) => {
                const label = getLabel(t);
                const secondary =
                  t.category_name && t.value
                    ? `Category: ${t.category_name} · UUID ${t.uuid?.slice(0, 8) ?? ''}…`
                    : t.uuid
                      ? `ID ${t.uuid.slice(0, 8)}…`
                      : null;
                const isSelected = selectedUuid === t.uuid;
                return (
                  <li key={t.uuid}>
                    <button
                      type="button"
                      onClick={() => onSelectUuid(t.uuid)}
                      className={`w-full text-left px-3 py-2.5 text-sm flex gap-2 transition-colors ${
                        isSelected ? 'bg-blue-50 border-l-2 border-l-blue-600' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                        }`}
                        aria-hidden
                      >
                        {isSelected ? <span className="h-1.5 w-1.5 rounded-full bg-surface" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-gray-900 break-words">
                          {highlightParts(label, debouncedSearch).map((p, i) =>
                            p.match ? (
                              <mark key={i} className="bg-amber-200 text-gray-900 font-medium">
                                {p.text}
                              </mark>
                            ) : (
                              <span key={i}>{p.text}</span>
                            ),
                          )}
                        </span>
                        {secondary ? (
                          <span className="mt-0.5 block text-xs text-gray-500 line-clamp-1">
                            {secondary}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
