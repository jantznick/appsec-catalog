import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Button } from '../components/ui/Button.jsx';
import useAuthStore from '../store/authStore.js';
import useScopeStore from '../store/scopeStore.js';

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

export function Dependencies() {
  const { isAdmin } = useAuthStore();
  const admin = isAdmin();
  // The global scope selector is the baseline (scopes the fetch); the local
  // Company facet refines within the returned rows.
  const scopeCompanyId = useScopeStore((s) => (s.mode === 'company' ? s.companyId : ''));
  const scopeDivisionId = useScopeStore((s) => (s.mode === 'division' ? s.divisionId : ''));

  const [rows, setRows] = useState([]);
  const [facets, setFacets] = useState({ ecosystems: [], companies: [] });
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);

  const [globalFilter, setGlobalFilter] = useState('');
  const [ecosystem, setEcosystem] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [frameworksOnly, setFrameworksOnly] = useState(false);
  const [sorting, setSorting] = useState([{ id: 'name', desc: false }]);

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.getScmSbom(
        admin
          ? { companyId: scopeCompanyId || undefined, divisionId: scopeDivisionId || undefined }
          : {}
      );
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setFacets(data.facets || { ecosystems: [], companies: [] });
      setTruncated(Boolean(data.truncated));
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Failed to load dependency inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeCompanyId, scopeDivisionId]);

  // Pre-filter by the faceted controls; react-table handles global search + sort + paging.
  const filteredData = useMemo(() => {
    return rows.filter((r) => {
      if (ecosystem && r.ecosystem !== ecosystem) return false;
      if (companyId && r.companyId !== companyId) return false;
      if (frameworksOnly && !r.isFramework) return false;
      return true;
    });
  }, [rows, ecosystem, companyId, frameworksOnly]);

  const stats = useMemo(() => {
    const uniquePkgs = new Set(filteredData.map((r) => `${r.ecosystem}:${r.name}`));
    const apps = new Set(filteredData.map((r) => r.applicationId));
    const frameworks = new Set(
      filteredData.filter((r) => r.isFramework).map((r) => r.framework || r.name),
    );
    return {
      rows: filteredData.length,
      packages: uniquePkgs.size,
      apps: apps.size,
      frameworks: frameworks.size,
    };
  }, [filteredData]);

  const columns = useMemo(() => {
    const cols = [
      {
        accessorKey: 'name',
        header: 'Package',
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="font-mono text-sm text-gray-900 break-all">{row.original.name}</span>
            {row.original.isFramework ? (
              <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 align-middle">
                {row.original.framework || 'framework'}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'version',
        accessorFn: (r) => r.version || r.versionRange || '',
        header: 'Version',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-gray-600">
            {row.original.version || row.original.versionRange || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'ecosystem',
        header: 'Ecosystem',
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-600">{ECOSYSTEM_LABELS[getValue()] || getValue()}</span>
        ),
      },
      {
        accessorKey: 'applicationName',
        header: 'Application',
        cell: ({ row }) => (
          <Link
            to={`/applications/${row.original.applicationId}`}
            className="text-sm text-blue-600 hover:underline"
          >
            {row.original.applicationName}
          </Link>
        ),
      },
    ];
    if (admin) {
      cols.push({
        accessorKey: 'companyName',
        header: 'Company',
        cell: ({ getValue }) => <span className="text-sm text-gray-600">{getValue() || '—'}</span>,
      });
    }
    cols.push({
      accessorKey: 'repoFullName',
      header: 'Repository',
      cell: ({ row }) => (
        <a
          href={row.original.repoHtmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline break-all"
        >
          {row.original.repoFullName}
        </a>
      ),
    });
    return cols;
  }, [admin]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getRowId: (r) => r.id,
    globalFilterFn: (row, _columnId, value) => {
      const q = String(value).toLowerCase();
      const o = row.original;
      return (
        o.name.toLowerCase().includes(q) ||
        (o.applicationName || '').toLowerCase().includes(q) ||
        (o.framework || '').toLowerCase().includes(q) ||
        (o.repoFullName || '').toLowerCase().includes(q)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const ecosystemOptions = [
    { value: '', label: 'All ecosystems' },
    ...facets.ecosystems.map((e) => ({ value: e, label: ECOSYSTEM_LABELS[e] || e })),
  ];
  const companyOptions = [
    { value: '', label: 'All companies' },
    ...facets.companies.map((c) => ({ value: c.id, label: c.name })),
  ];

  const resetFilters = () => {
    setGlobalFilter('');
    setEcosystem('');
    setCompanyId('');
    setFrameworksOnly(false);
  };

  if (loading) {
    return <LoadingPage message="Loading dependencies…" />;
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/dashboard" className="text-sm text-blue-600 hover:text-blue-700 mb-2 inline-block">
          ← Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-800">Dependencies</h1>
        <p className="text-gray-600 mt-1 max-w-2xl">
          Software bill of materials across {admin ? 'all applications' : 'your applications'} with a
          linked source-control repository. Search by package to find where a vulnerable dependency is used.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Dependency rows', value: stats.rows },
          { label: 'Unique packages', value: stats.packages },
          { label: 'Applications', value: stats.apps },
          { label: 'Frameworks', value: stats.frameworks },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="py-4">
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-4 py-12 text-center">
              <p className="text-sm text-gray-600">No dependencies yet.</p>
              <p className="text-sm text-gray-500 mt-2">
                Link a repository to an application (Application → Integrations tab) to populate
                its dependency inventory.
              </p>
            </div>
          ) : (
            <>
              {truncated && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Showing the first 10,000 rows. Narrow with filters to see the rest.
                </div>
              )}

              {/* Filters */}
              <div className="flex flex-wrap items-end gap-3 mb-4">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    placeholder="Search package, app, repo…"
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                  />
                </div>
                <div className="w-44">
                  <Select
                    options={ecosystemOptions}
                    value={ecosystem}
                    onChange={(e) => setEcosystem(e.target.value)}
                  />
                </div>
                {admin && facets.companies.length > 0 && (
                  <div className="w-52">
                    <Select
                      options={companyOptions}
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                    />
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm text-gray-700 h-10">
                  <input
                    type="checkbox"
                    checked={frameworksOnly}
                    onChange={(e) => setFrameworksOnly(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Frameworks only
                </label>
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Reset
                </Button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    {table.getHeaderGroups().map((hg) => (
                      <tr key={hg.id}>
                        {hg.headers.map((header) => (
                          <th
                            key={header.id}
                            onClick={header.column.getToggleSortingHandler()}
                            className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <SortIcon dir={header.column.getIsSorted()} />
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-surface">
                    {table.getRowModel().rows.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-500">
                          No dependencies match the current filters.
                        </td>
                      </tr>
                    ) : (
                      table.getRowModel().rows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50">
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="px-4 py-2 align-top">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                <p className="text-sm text-gray-500">
                  {table.getFilteredRowModel().rows.length} row
                  {table.getFilteredRowModel().rows.length === 1 ? '' : 's'}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    Next
                  </Button>
                  <Select
                    options={[10, 25, 50, 100].map((n) => ({ value: String(n), label: `${n} / page` }))}
                    value={String(table.getState().pagination.pageSize)}
                    onChange={(e) => table.setPageSize(Number(e.target.value))}
                    className="!w-auto"
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
