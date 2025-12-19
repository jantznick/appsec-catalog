import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useReactTable, getCoreRowModel, getPaginationRowModel, getSortedRowModel, getFilteredRowModel, flexRender } from '@tanstack/react-table';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import useAuthStore from '../store/authStore.js';

export function Companies() {
  const { isAdmin } = useAuthStore();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [averageScores, setAverageScores] = useState({}); // Cache average scores by company ID
  
  // Table state
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const data = await api.getCompanies();
      setCompanies(Array.isArray(data) ? data : []);
      
      // Load average scores for all companies
      if (data && Array.isArray(data) && data.length > 0) {
        loadAverageScores(data);
      }
    } catch (error) {
      toast.error('Failed to load companies');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadAverageScores = async (companiesList) => {
    const scorePromises = companiesList.map(async (company) => {
      try {
        const data = await api.getCompanyAverageScore(company.id);
        return { id: company.id, score: data.averageScore };
      } catch (error) {
        console.error(`Failed to load average score for company ${company.id}:`, error);
        return { id: company.id, score: null };
      }
    });

    const scoreResults = await Promise.all(scorePromises);
    const scoresMap = {};
    scoreResults.forEach(({ id, score }) => {
      scoresMap[id] = score;
    });
    setAverageScores(scoresMap);
  };

  // Define columns
  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <Link
          to={`/companies/${row.original.id}`}
          className="font-medium text-blue-600 hover:text-blue-700"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: 'domains',
      header: 'Domains',
      cell: ({ row }) => row.original.domains || <span className="text-gray-400">—</span>,
    },
    {
      accessorKey: 'users',
      header: 'Users',
      cell: ({ row }) => row.original._count?.users || 0,
    },
    {
      accessorKey: 'applications',
      header: 'Applications',
      cell: ({ row }) => row.original._count?.applications || 0,
    },
    {
      accessorKey: 'score',
      header: 'Avg Score',
      cell: ({ row }) => {
        const score = averageScores[row.original.id];
        if (score !== undefined && score !== null) {
          return (
            <span className={`text-sm font-medium ${
              score >= 76 ? 'text-green-600' :
              score >= 51 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {score}/100
            </span>
          );
        }
        return <span className="text-xs text-gray-400">—</span>;
      },
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const scoreA = averageScores[rowA.original.id] ?? -1;
        const scoreB = averageScores[rowB.original.id] ?? -1;
        return scoreA - scoreB;
      },
    },
    ...(isAdmin() ? [{
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Link to={`/companies/${row.original.id}`}>
          <Button variant="ghost" size="sm">
            View
          </Button>
        </Link>
      ),
      enableSorting: false,
    }] : []),
  ], [isAdmin, averageScores]);

  // Filter data based on global filter
  const filteredData = useMemo(() => {
    let data = [...companies];

    // Apply global filter
    if (globalFilter) {
      const filterLower = globalFilter.toLowerCase();
      data = data.filter(company =>
        company.name?.toLowerCase().includes(filterLower) ||
        company.domains?.toLowerCase().includes(filterLower)
      );
    }

    return data;
  }, [companies, globalFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  if (loading) {
    return <LoadingPage message="Loading companies..." />;
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Companies</h1>
          <p className="text-gray-600">
            {isAdmin() ? 'Manage all companies' : 'View your company'}
          </p>
        </div>
        {isAdmin() && (
          <Link to="/companies/new">
            <Button variant="primary">Create Company</Button>
          </Link>
        )}
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                {isAdmin() ? 'No companies found. Create your first company to get started.' : 'You are not assigned to any company.'}
              </p>
              {isAdmin() && (
                <Link to="/companies/new">
                  <Button variant="primary">Create Company</Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent padding="none">
            {/* Global Search */}
            <div className="p-4 border-b">
              <Input
                label="Search"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Search companies..."
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {header.isPlaceholder ? null : (
                            <div
                              className={`flex items-center gap-2 ${
                                header.column.getCanSort() ? 'cursor-pointer select-none' : ''
                              }`}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              {header.column.getCanSort() && (
                                <span className="text-gray-400">
                                  {{
                                    asc: ' ↑',
                                    desc: ' ↓',
                                  }[header.column.getIsSorted()] ?? ' ⇅'}
                                </span>
                              )}
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  {'<<'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  {'<'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  {'>'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  {'>>'}
                </Button>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-700">
                  Page{' '}
                  <strong>
                    {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                  </strong>
                </span>
                <span className="text-sm text-gray-700">
                  Showing {table.getRowModel().rows.length} of {filteredData.length} results
                </span>
                <select
                  value={table.getState().pagination.pageSize}
                  onChange={(e) => table.setPageSize(Number(e.target.value))}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

