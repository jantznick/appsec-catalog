import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card.jsx';
import { api } from '../../lib/api.js';

/** Fixed width (~9rem) so every category row’s bar aligns. */
const BAR_W = 'w-36 shrink-0';

const GRID_SCAN_INTEGRATION =
  'grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(6.75rem,7.5rem)_minmax(10rem,1fr)] gap-x-3 gap-y-1';

/** Firewall / API – integration column only; cells omitted when empty. */
const GRID_INTEGRATION_ONLY =
  'grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,1fr)] gap-x-3 gap-y-1';

/**
 * Two segments: green = covered fraction; grey = not covered (missing coverage + marked N/A).
 */
function CoverageBar({ covered, total }) {
  if (total <= 0) {
    return <div className={`h-2 ${BAR_W} rounded-full bg-gray-200`} aria-hidden />;
  }
  const pctGreen = Math.min(100, Math.max(0, (covered / total) * 100));
  const rest = Math.max(0, 100 - pctGreen);
  const notCovered = total - covered;
  return (
    <div
      className={`flex h-2 ${BAR_W} overflow-hidden rounded-full bg-gray-300`}
      role="img"
      aria-label={`${covered} covered, ${notCovered} not covered (missing coverage or marked not applicable)`}
    >
      {pctGreen > 0 && (
        <div className="h-full bg-emerald-500 shrink-0" style={{ width: `${pctGreen}%` }} />
      )}
      {rest > 0 && (
        <div className="h-full bg-gray-400 shrink-0" style={{ width: `${rest}%` }} />
      )}
    </div>
  );
}

/** @returns {string|null} */
function scanText(iso) {
  if (iso == null || iso === '') return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return null;
  }
}

/** @returns {string|null} */
function integrationText(level, levelOptions) {
  if (level === null || level === undefined || Number.isNaN(level)) return null;
  const hit = levelOptions.find((o) => String(o.value) === String(level));
  return hit?.label ?? `Level ${level}`;
}

/**
 * @typedef {'namesOnly' | 'scanIntegration' | 'integrationOnly'} AppListLayout
 */

/**
 * @param {{
 *   apps: Array<{ id: string, name: string, lastScanAt?: string|null, integrationLevel?: number|null }>,
 *   levelOptions: Array<{ value: string, label: string }>,
 *   layout: AppListLayout,
 * }} props
 */
function AppList({ apps, levelOptions, layout }) {
  if (!apps.length) {
    return <p className="text-sm text-gray-500 py-1">None</p>;
  }

  if (layout === 'namesOnly') {
    return (
      <div className="mt-2 pt-2 border-t border-gray-100 text-sm leading-relaxed text-gray-800">
        {apps.map((app, i) => (
          <span key={app.id}>
            {i > 0 ? ', ' : null}
            <Link
              to={`/applications/${app.id}`}
              className="text-blue-700 hover:underline underline-offset-2"
            >
              {app.name}
            </Link>
          </span>
        ))}
      </div>
    );
  }

  const gridClass =
    layout === 'integrationOnly' ? GRID_INTEGRATION_ONLY : GRID_SCAN_INTEGRATION;

  const showScan = layout === 'scanIntegration';
  const showIntegration = layout !== 'namesOnly';

  return (
    <div className="mt-2 border-t border-gray-100 pt-2 space-y-0">
      <div
        className={`${gridClass} px-0 pb-1.5 mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 border-b border-gray-100 hidden sm:grid`}
        aria-hidden
      >
        <span>Application</span>
        {showScan ? <span className="whitespace-nowrap">Last scan</span> : null}
        {showIntegration ? <span>Integration</span> : null}
      </div>
      <ul className="divide-y divide-gray-100">
        {apps.map((app) => {
          const scan = showScan ? scanText(app.lastScanAt) : null;
          const integ = showIntegration ? integrationText(app.integrationLevel, levelOptions) : null;

          return (
            <li key={app.id} className={`${gridClass} py-2.5 items-start`}>
              <Link
                to={`/applications/${app.id}`}
                className="min-w-0 font-medium text-sm text-blue-700 hover:underline underline-offset-2 truncate"
                title={app.name}
              >
                {app.name}
              </Link>
              {showScan ? (
                <span className="text-xs text-gray-700 tabular-nums sm:whitespace-nowrap min-h-[1.125rem]">
                  {scan ? (
                    <>
                      <span className="sm:hidden text-gray-500">Last scan: </span>
                      {scan}
                    </>
                  ) : null}
                </span>
              ) : null}
              {showIntegration ? (
                <span
                  className="text-xs text-gray-700 leading-snug break-words min-h-[1.125rem]"
                  title={integ ?? undefined}
                >
                  {integ ? (
                    <>
                      <span className="sm:hidden text-gray-500">Integration: </span>
                      {integ}
                    </>
                  ) : null}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** @param {'default' | 'missing' | 'na'} mode — missing / Not applicable lists are names-only (no scan or integration). */
function appListLayout(categoryId, mode = 'default') {
  if (mode === 'missing' || mode === 'na') return 'namesOnly';
  if (categoryId === 'sast' || categoryId === 'sca' || categoryId === 'dast') {
    return 'scanIntegration';
  }
  return 'integrationOnly';
}

function CategoryChevron() {
  return (
    <span
      className="shrink-0 w-5 flex justify-center text-gray-400 text-xs font-semibold leading-none transition-transform duration-150 group-open/category:rotate-90"
      aria-hidden
    >
      ›
    </span>
  );
}

function ToolChevron() {
  return (
    <span
      className="shrink-0 w-5 flex justify-center text-gray-400 text-xs font-semibold leading-none transition-transform duration-150 group-open/tool:rotate-90"
      aria-hidden
    >
      ›
    </span>
  );
}

/** Collapsed row: single-line "Snyk - App A, App B" (ellipsis if long); expanded shows AppList. */
function ToolAccordionSummary({ tool }) {
  const names = tool.apps.map((a) => a.name).join(', ');
  return (
    <span className="min-w-0 flex-1 truncate text-sm">
      <span className="font-medium text-gray-900">{tool.label}</span>
      {names ? (
        <>
          <span className="font-normal text-gray-600"> - </span>
          <span className="font-normal text-gray-700">{names}</span>
        </>
      ) : null}
    </span>
  );
}

function CategoryStats({ counts }) {
  return (
    <span className="text-sm text-gray-600 tabular-nums sm:text-right w-full">
      <span>{counts.covered} covered</span>
      {counts.na > 0 && (
        <>
          {' · '}
          <span>{counts.na} N/A</span>
        </>
      )}
      {' · '}
      <span>{counts.gap} missing</span>{' '}
      <span className="text-gray-500">
        ({counts.applicable > 0 ? `${counts.coveredPct}%` : '—'})
      </span>
    </span>
  );
}

export function CompanySecurityCoverageSection({ loading, error, data }) {
  const [integrationLevels, setIntegrationLevels] = useState([]);
  /** px-4 (16px) + w-5 (20px) + gap-3 (12px) = pl-12 for nested body */
  const NEST_BODY = 'border-t border-gray-100 px-4 py-3 pl-12';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const levels = await api.getIntegrationLevels();
        if (!cancelled && Array.isArray(levels)) setIntegrationLevels(levels);
      } catch (e) {
        console.error('Failed to load integration levels:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security coverage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && <p className="text-sm text-gray-600">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && data && data.totalApplications === 0 && (
          <p className="text-sm text-gray-600">No applications for this company yet.</p>
        )}
        {!loading && !error && data && data.totalApplications > 0 && (
          <div className="rounded-lg border border-gray-200 divide-y divide-gray-200 bg-white">
            {data.categories.map((cat) => {
              const { counts } = cat;
              return (
                <details key={cat.id} className="group/category">
                  <summary
                    className="
                      cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden
                      flex gap-3 items-center px-4 py-3 hover:bg-gray-50 text-left w-full min-w-0
                    "
                  >
                    <CategoryChevron />
                    <div
                      className="
                        grid min-w-0 flex-1 gap-y-2 gap-x-4 items-center w-full
                        grid-cols-1
                        sm:grid-cols-[minmax(0,1fr)_9rem_18rem]
                        sm:gap-y-0
                      "
                    >
                      <span className="font-medium text-gray-800 truncate min-w-0">{cat.label}</span>
                      <CoverageBar covered={counts.covered} total={counts.totalApplications} />
                      <CategoryStats counts={counts} />
                    </div>
                  </summary>

                  <div className={NEST_BODY}>
                    <div className="divide-y divide-gray-200">
                      {cat.tools.map((tool) => (
                        <details
                          key={tool.key}
                          defaultOpen={cat.tools.length === 1}
                          className="group/tool py-3 first:pt-0"
                        >
                          <summary
                            className="
                              cursor-pointer list-none [&::-webkit-details-marker]:hidden
                              flex w-full min-w-0 items-center gap-2 text-sm text-gray-900
                              hover:bg-gray-50 rounded-sm py-1.5 pr-2 -mx-1 px-1
                            "
                            title={
                              tool.apps.length
                                ? `${tool.label} - ${tool.apps.map((a) => a.name).join(', ')}`
                                : tool.label
                            }
                          >
                            <ToolChevron />
                            <ToolAccordionSummary tool={tool} />
                          </summary>
                          <div className="pl-7">
                            <AppList
                              apps={tool.apps}
                              levelOptions={integrationLevels}
                              layout={appListLayout(cat.id)}
                            />
                          </div>
                        </details>
                      ))}

                      <details className="group/tool py-3">
                        <summary
                          className="
                            cursor-pointer list-none [&::-webkit-details-marker]:hidden
                            flex w-full min-w-0 items-center gap-2 text-sm text-gray-900
                            hover:bg-gray-50 rounded-sm py-1.5 pr-2 -mx-1 px-1
                          "
                        >
                          <ToolChevron />
                          <span className="font-medium flex-1 min-w-0">
                            Missing coverage ({cat.uncovered.length})
                          </span>
                        </summary>
                        <div className="pl-7">
                          <AppList
                            apps={cat.uncovered}
                            levelOptions={integrationLevels}
                            layout={appListLayout(cat.id, 'missing')}
                          />
                        </div>
                      </details>

                      {['appFirewall', 'apiSecurity'].includes(cat.id) && (
                        <details className="group/tool py-3 last:pb-0">
                          <summary
                            className="
                              cursor-pointer list-none [&::-webkit-details-marker]:hidden
                              flex w-full min-w-0 items-center gap-2 text-sm text-gray-900
                              hover:bg-gray-50 rounded-sm py-1.5 pr-2 -mx-1 px-1
                            "
                          >
                            <ToolChevron />
                            <span className="font-medium flex-1 min-w-0">
                              Not applicable ({cat.naApps.length})
                            </span>
                          </summary>
                          <div className="pl-7">
                            {cat.naApps.length === 0 ? (
                              <p className="text-sm text-gray-500">
                                No apps are marked not applicable for {cat.label.toLowerCase()}.
                              </p>
                            ) : (
                              <AppList
                                apps={cat.naApps}
                                levelOptions={integrationLevels}
                                layout={appListLayout(cat.id, 'na')}
                              />
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
