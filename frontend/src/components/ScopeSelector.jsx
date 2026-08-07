import { useState, useRef, useEffect, useMemo } from 'react';
import { FiFolder, FiChevronDown, FiSearch, FiCheck, FiGlobe, FiBriefcase } from 'react-icons/fi';
import { api } from '../lib/api.js';
import useScopeStore from '../store/scopeStore.js';

/**
 * Global admin scope selector (Wiz-style project-folder picker) for the top nav.
 *
 * Admin-only convenience filter: pick "All companies", a division (folder), or a
 * single company. The selection is held in the persisted scopeStore and read by
 * list pages. Renders nothing for non-admins.
 */
export function ScopeSelector() {
  const { mode, companyId, divisionId, label, setCompanyScope, setDivisionScope, clearScope } =
    useScopeStore();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [companies, setCompanies] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Load the company/division catalog once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [comps, divs] = await Promise.all([api.getCompanies(), api.getDivisions()]);
        if (cancelled) return;
        setCompanies(Array.isArray(comps) ? comps : []);
        setDivisions(Array.isArray(divs) ? divs : []);
      } catch (error) {
        console.error('Failed to load scope catalog:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Self-heal a stale persisted scope (company/division removed since it was
  // saved), and keep the cached label fresh if the entity was renamed.
  useEffect(() => {
    if (!companies.length && !divisions.length) return;
    if (mode === 'company') {
      const c = companies.find((x) => x.id === companyId);
      if (!c) clearScope();
      else if (c.name !== label) setCompanyScope(c.id, c.name);
    } else if (mode === 'division') {
      const d = divisions.find((x) => x.id === divisionId);
      if (!d) clearScope();
      else if (d.name !== label) setDivisionScope(d.id, d.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies, divisions]);

  // Build the division → companies tree, plus ungrouped companies.
  const tree = useMemo(() => {
    const byDivision = new Map();
    const ungrouped = [];
    for (const c of companies) {
      if (c.divisionId) {
        if (!byDivision.has(c.divisionId)) byDivision.set(c.divisionId, []);
        byDivision.get(c.divisionId).push(c);
      } else {
        ungrouped.push(c);
      }
    }
    const appCount = (c) => c?._count?.applications ?? 0;
    const groups = divisions.map((d) => {
      const comps = byDivision.get(d.id) || [];
      return {
        division: d,
        companies: comps,
        appCount: comps.reduce((sum, c) => sum + appCount(c), 0),
      };
    });
    return { groups, ungrouped, appCount };
  }, [companies, divisions]);

  const q = search.trim().toLowerCase();
  const matches = (name) => !q || name.toLowerCase().includes(q);

  const choose = (fn) => {
    fn();
    setIsOpen(false);
    setSearch('');
  };

  const scoped = mode !== 'all';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
          scoped
            ? 'bg-blue-600/20 text-white ring-1 ring-blue-500/50 hover:bg-blue-600/30'
            : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
        title="Change the company or division you're viewing"
      >
        <FiFolder className="w-4 h-4 flex-shrink-0" />
        <span className="max-w-[11rem] truncate">{label}</span>
        <FiChevronDown className="w-4 h-4 opacity-70 flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl shadow-xl shadow-black/40 bg-surface ring-1 ring-white/10 z-50 overflow-hidden">
          <div className="p-2">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10">
              <FiSearch className="w-4 h-4 text-white/40 flex-shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search companies or divisions"
                className="w-full bg-transparent text-sm text-white placeholder-white/40 focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto pb-2">
            {/* All companies */}
            {matches('all companies') && (
              <button
                type="button"
                onClick={() => choose(clearScope)}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-white/85 hover:bg-white/5 transition-colors"
              >
                <FiGlobe className="w-4 h-4 text-white/50 flex-shrink-0" />
                <span>All companies</span>
                {mode === 'all' && <FiCheck className="ml-auto w-4 h-4 text-blue-400" />}
              </button>
            )}

            <div className="border-t border-white/10 my-1" />

            {/* Divisions (folders) with nested companies */}
            {tree.groups.map(({ division, companies: comps, appCount }) => {
              const visibleComps = comps.filter((c) => matches(c.name));
              const divisionMatches = matches(division.name);
              if (!divisionMatches && visibleComps.length === 0) return null;
              return (
                <div key={division.id}>
                  <button
                    type="button"
                    onClick={() => choose(() => setDivisionScope(division.id, division.name))}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-white/85 hover:bg-white/5 transition-colors"
                  >
                    <FiFolder className="w-4 h-4 text-blue-300/80 flex-shrink-0" />
                    <span className="truncate">{division.name}</span>
                    {mode === 'division' && divisionId === division.id ? (
                      <FiCheck className="ml-auto w-4 h-4 text-blue-400" />
                    ) : (
                      <span className="ml-auto text-xs text-white/30">{appCount} apps</span>
                    )}
                  </button>
                  {(divisionMatches ? comps : visibleComps).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => choose(() => setCompanyScope(c.id, c.name))}
                      className="flex w-full items-center gap-2.5 py-1.5 pl-11 pr-4 text-sm text-white/70 hover:bg-white/5 transition-colors"
                    >
                      <FiBriefcase className="w-3.5 h-3.5 text-white/35 flex-shrink-0" />
                      <span className="truncate">{c.name}</span>
                      {mode === 'company' && companyId === c.id ? (
                        <FiCheck className="ml-auto w-4 h-4 text-blue-400" />
                      ) : (
                        <span className="ml-auto text-xs text-white/25">{tree.appCount(c)}</span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}

            {/* Companies with no division */}
            {tree.ungrouped.filter((c) => matches(c.name)).length > 0 && (
              <>
                <div className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-white/40">
                  Ungrouped
                </div>
                {tree.ungrouped
                  .filter((c) => matches(c.name))
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => choose(() => setCompanyScope(c.id, c.name))}
                      className="flex w-full items-center gap-2.5 py-1.5 pl-11 pr-4 text-sm text-white/70 hover:bg-white/5 transition-colors"
                    >
                      <FiBriefcase className="w-3.5 h-3.5 text-white/35 flex-shrink-0" />
                      <span className="truncate">{c.name}</span>
                      {mode === 'company' && companyId === c.id ? (
                        <FiCheck className="ml-auto w-4 h-4 text-blue-400" />
                      ) : (
                        <span className="ml-auto text-xs text-white/25">{tree.appCount(c)}</span>
                      )}
                    </button>
                  ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
