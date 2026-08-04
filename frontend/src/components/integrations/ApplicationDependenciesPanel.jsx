import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../ui/Card.jsx';
import { Input } from '../ui/Input.jsx';
import { Select } from '../ui/Select.jsx';

const ECOSYSTEM_LABELS = {
  npm: 'npm',
  pypi: 'PyPI',
  maven: 'Maven',
  go: 'Go',
  rubygems: 'RubyGems',
  nuget: 'NuGet',
  composer: 'Composer',
};

function SortIcon({ dir }) {
  if (!dir) return <span className="text-gray-300 ml-1">↕</span>;
  return <span className="text-gray-700 ml-1">{dir === 'asc' ? '↑' : '↓'}</span>;
}

/**
 * Read-only dependency inventory for a single application's linked GitHub repo. Uses the data
 * already present on the application payload (githubRepoLink.repo) — no extra fetch.
 */
export function ApplicationDependenciesPanel({ application }) {
  const repo = application?.githubRepoLink?.repo || null;
  const allDeps = repo?.dependencies || [];

  const [query, setQuery] = useState('');
  const [ecosystem, setEcosystem] = useState('');
  const [frameworksOnly, setFrameworksOnly] = useState(false);
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });

  const ecosystems = useMemo(
    () => [...new Set(allDeps.map((d) => d.ecosystem))].sort(),
    [allDeps],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = allDeps.filter((d) => {
      if (ecosystem && d.ecosystem !== ecosystem) return false;
      if (frameworksOnly && !d.isFramework) return false;
      if (q && !d.name.toLowerCase().includes(q) && !(d.framework || '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    out = [...out].sort((a, b) => {
      let av;
      let bv;
      if (sort.key === 'version') {
        av = a.version || a.versionRange || '';
        bv = b.version || b.versionRange || '';
      } else {
        av = a[sort.key] ?? '';
        bv = b[sort.key] ?? '';
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
    return out;
  }, [allDeps, query, ecosystem, frameworksOnly, sort]);

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  if (!repo) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-gray-600">No GitHub repository linked to this application.</p>
          <p className="text-sm text-gray-500 mt-2">
            Link one in the <span className="font-medium">Integrations</span> tab to pull its
            dependency inventory.
          </p>
        </CardContent>
      </Card>
    );
  }

  const frameworkCount = allDeps.filter((d) => d.isFramework).length;
  const ecosystemOptions = [
    { value: '', label: 'All ecosystems' },
    ...ecosystems.map((e) => ({ value: e, label: ECOSYSTEM_LABELS[e] || e })),
  ];

  const columns = [
    { key: 'name', label: 'Package' },
    { key: 'version', label: 'Version' },
    { key: 'ecosystem', label: 'Ecosystem' },
    { key: 'source', label: 'Source' },
  ];

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-blue-600 hover:underline break-all"
            >
              {repo.fullName}
            </a>
            <p className="text-xs text-gray-500 mt-0.5">
              {allDeps.length} dependenc{allDeps.length === 1 ? 'y' : 'ies'} · {frameworkCount} framework
              {frameworkCount === 1 ? '' : 's'}
              {repo.lastSyncedAt ? ` · synced ${new Date(repo.lastSyncedAt).toLocaleDateString()}` : ''}
            </p>
          </div>
          <Link to="/dependencies" className="text-xs text-blue-600 hover:underline">
            View catalog-wide inventory →
          </Link>
        </div>

        {allDeps.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 text-center text-sm text-gray-600">
            No dependencies detected. Only root-level manifests are parsed (package.json,
            requirements.txt, pyproject.toml, go.mod, pom.xml, build.gradle, composer.json, Gemfile).
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3 mb-3">
              <div className="flex-1 min-w-[180px]">
                <Input
                  placeholder="Search package…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="w-40">
                <Select
                  options={ecosystemOptions}
                  value={ecosystem}
                  onChange={(e) => setEcosystem(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 h-10">
                <input
                  type="checkbox"
                  checked={frameworksOnly}
                  onChange={(e) => setFrameworksOnly(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Frameworks only
              </label>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => toggleSort(col.key)}
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
                      >
                        {col.label}
                        <SortIcon dir={sort.key === col.key ? sort.dir : null} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-3 py-6 text-center text-gray-500">
                        No dependencies match the current filters.
                      </td>
                    </tr>
                  ) : (
                    rows.map((d) => (
                      <tr key={`${d.ecosystem}-${d.name}`} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5">
                          <span className="font-mono text-xs text-gray-900 break-all">{d.name}</span>
                          {d.isFramework ? (
                            <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 align-middle">
                              {d.framework || 'framework'}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs text-gray-600">
                          {d.version || d.versionRange || '—'}
                        </td>
                        <td className="px-3 py-1.5 text-gray-600">
                          {ECOSYSTEM_LABELS[d.ecosystem] || d.ecosystem}
                        </td>
                        <td className="px-3 py-1.5 text-gray-500 text-xs">{d.source}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {rows.length} of {allDeps.length} shown
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
