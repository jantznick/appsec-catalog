import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useReactTable, getCoreRowModel, getPaginationRowModel, getSortedRowModel, getFilteredRowModel, flexRender } from '@tanstack/react-table';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { BulkImportApplicationsModal } from '../components/applications/BulkImportApplicationsModal.jsx';
import useAuthStore from '../store/authStore.js';
import { calculateCompleteness } from '../utils/applicationCompleteness.js';
import { copyToClipboard, isClipboardAvailable } from '../utils/clipboard.js';

export function Applications() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdmin, user } = useAuthStore();
  const [applications, setApplications] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState({}); // Cache scores by application ID
  const [filters, setFilters] = useState({
    companyId: searchParams.get('companyId') || '',
    status: '',
    search: '',
  });

  // Table state
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [technicalFormModalOpen, setTechnicalFormModalOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [technicalFormUrl, setTechnicalFormUrl] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [applicationToDelete, setApplicationToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isAdmin()) {
      loadCompanies();
    }
    loadApplications();
  }, []);

  useEffect(() => {
    // Only reload when filters change if admin (regular users don't have filters)
    if (isAdmin()) {
      loadApplications();
    }
  }, [filters]);

  // Update filter when companyId changes in URL
  useEffect(() => {
    const companyIdFromUrl = searchParams.get('companyId');
    if (companyIdFromUrl && isAdmin()) {
      setFilters(prev => ({ ...prev, companyId: companyIdFromUrl }));
    }
  }, [searchParams, isAdmin]);

  const loadCompanies = async () => {
    try {
      const data = await api.getCompanies();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const loadApplications = async () => {
    try {
      setLoading(true);
      let data;
      
      if (isAdmin()) {
        // Use admin endpoint with server-side filtering
        data = await api.getAdminApplications(filters);
      } else {
        // Use regular endpoint (backend filters by user's company)
        data = await api.getApplications();
      }
      
      setApplications(Array.isArray(data) ? data : []);
      
      // Load scores for all applications
      if (data && Array.isArray(data) && data.length > 0) {
        loadScoresForApplications(data);
      }
    } catch (error) {
      toast.error('Failed to load applications');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadScoresForApplications = async (apps) => {
    // Load scores in parallel for better performance
    const scorePromises = apps.map(async (app) => {
      try {
        const scoreData = await api.getApplicationScore(app.id);
        return { id: app.id, score: scoreData.totalScore };
      } catch (error) {
        console.error(`Failed to load score for app ${app.id}:`, error);
        return { id: app.id, score: null };
      }
    });

    const scoreResults = await Promise.all(scorePromises);
    const scoresMap = {};
    scoreResults.forEach(({ id, score }) => {
      scoresMap[id] = score;
    });
    setScores(scoresMap);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleShowTechnicalForm = (app, e) => {
    e.stopPropagation(); // Prevent row click
    setSelectedApplication(app);
    setTechnicalFormUrl(''); // Reset URL
    setTechnicalFormModalOpen(true);
  };

  const handleGenerateTechnicalFormLink = async () => {
    if (!selectedApplication) return;

    setGeneratingLink(true);
    try {
      const result = await api.generateTechnicalFormLink(selectedApplication.id);
      setTechnicalFormUrl(result.technicalFormUrl);
      
      // Update the application in the list with the new company slug if it was generated
      if (result.companySlug && selectedApplication.company) {
        setApplications(prev => prev.map(app => 
          app.id === selectedApplication.id 
            ? { ...app, company: { ...app.company, slug: result.companySlug } }
            : app
        ));
        setSelectedApplication(prev => ({
          ...prev,
          company: { ...prev.company, slug: result.companySlug }
        }));
      }
      
      toast.success('Technical form link generated successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to generate technical form link');
      console.error('Error generating link:', error);
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleGenerateLinkInList = async (app, e) => {
    e.stopPropagation(); // Prevent row click
    setSelectedApplication(app);
    setTechnicalFormUrl(''); // Reset URL
    setTechnicalFormModalOpen(true);
    // Auto-generate the link immediately
    setGeneratingLink(true);
    try {
      const result = await api.generateTechnicalFormLink(app.id);
      setTechnicalFormUrl(result.technicalFormUrl);
      
      // Update the application in the list with the new company slug if it was generated
      if (result.companySlug && app.company) {
        setApplications(prev => prev.map(application => 
          application.id === app.id 
            ? { ...application, company: { ...application.company, slug: result.companySlug } }
            : application
        ));
        setSelectedApplication(prev => ({
          ...prev,
          company: { ...prev.company, slug: result.companySlug }
        }));
      }
      
      toast.success('Technical form link generated successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to generate technical form link');
      console.error('Error generating link:', error);
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleDeleteApplication = async () => {
    if (!applicationToDelete) return;
    if (deleteConfirmText !== `delete ${applicationToDelete.name}`) {
      return;
    }

    setDeleting(true);
    try {
      await api.deleteApplication(applicationToDelete.id);
      toast.success(`Application "${applicationToDelete.name}" deleted successfully`);
      setDeleteModalOpen(false);
      setApplicationToDelete(null);
      setDeleteConfirmText('');
      // Reload applications list
      loadApplications();
    } catch (error) {
      toast.error(error.message || 'Failed to delete application');
      console.error('Error deleting application:', error);
    } finally {
      setDeleting(false);
    }
  };

  const getTechnicalFormUrl = (app) => {
    if (!app.company?.slug || !app.id) return null;
    return `${window.location.origin}/onboard/${app.company.slug}/application/${app.id}`;
  };

  // Define columns
  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-blue-600 hover:text-blue-700">
            {row.original.name}
          </span>
          <button
            onClick={(e) => handleGenerateLinkInList(row.original, e)}
            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Get Technical Form Link"
            aria-label="Get Technical Form Link"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        </div>
      ),
    },
    {
      accessorKey: 'company',
      header: 'Company',
      cell: ({ row }) => {
        const app = row.original;
        if (isAdmin() && app.companyId) {
          return (
            <span
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/companies/${app.companyId}`);
              }}
              className="text-gray-700 hover:text-blue-600 cursor-pointer"
            >
              {app.company?.name || '—'}
            </span>
          );
        }
        return <span>{app.company?.name || '—'}</span>;
      },
      enableSorting: isAdmin(),
    },
    {
      accessorKey: 'owner',
      header: 'Owner',
      cell: ({ row }) => row.original.owner || '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const app = row.original;
        const completeness = calculateCompleteness(app);
        return (
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs font-medium rounded ${
              app.status === 'onboarded' 
                ? 'bg-green-100 text-green-800'
                : app.status === 'pending_technical'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {app.status || 'onboarded'}
            </span>
            <span className="text-xs text-gray-500">
              {completeness.filled}/{completeness.total} ({completeness.percentage}%)
            </span>
          </div>
        );
      },
      filterFn: (row, id, value) => {
        if (!value || value === '') return true;
        return row.original.status === value;
      },
    },
    {
      accessorKey: 'score',
      header: 'Score',
      cell: ({ row }) => {
        const score = scores[row.original.id];
        if (score !== undefined) {
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
        const scoreA = scores[rowA.original.id] ?? -1;
        const scoreB = scores[rowB.original.id] ?? -1;
        return scoreA - scoreB;
      },
    },
    {
      accessorKey: 'metadataLastReviewed',
      header: 'Last Reviewed',
      cell: ({ row }) => {
        const app = row.original;
        if (app.metadataLastReviewed) {
          return (
            <span className="text-sm text-gray-600">
              {new Date(app.metadataLastReviewed).toLocaleDateString()}
            </span>
          );
        }
        return <span className="text-xs text-gray-400">Never</span>;
      },
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const dateA = rowA.original.metadataLastReviewed 
          ? new Date(rowA.original.metadataLastReviewed).getTime() 
          : 0;
        const dateB = rowB.original.metadataLastReviewed 
          ? new Date(rowB.original.metadataLastReviewed).getTime() 
          : 0;
        return dateA - dateB;
      },
    },
    ...(isAdmin() ? [{
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="danger"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setApplicationToDelete(row.original);
              setDeleteModalOpen(true);
              setDeleteConfirmText('');
            }}
            className="text-xs"
          >
            Delete
          </Button>
        </div>
      ),
    }] : []),
  ], [isAdmin, scores, navigate]);

  // Filter data based on admin filters and global filter
  const filteredData = useMemo(() => {
    let data = [...applications];

    // Apply admin filters (server-side already applied, but we can filter client-side too for consistency)
    if (isAdmin()) {
      if (filters.status) {
        data = data.filter(app => app.status === filters.status);
      }
      if (filters.companyId) {
        data = data.filter(app => app.companyId === filters.companyId);
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        data = data.filter(app => 
          app.name?.toLowerCase().includes(searchLower) ||
          app.description?.toLowerCase().includes(searchLower)
        );
      }
    }

    // Apply global filter (for client-side search)
    if (globalFilter) {
      const filterLower = globalFilter.toLowerCase();
      data = data.filter(app =>
        app.name?.toLowerCase().includes(filterLower) ||
        app.description?.toLowerCase().includes(filterLower) ||
        app.owner?.toLowerCase().includes(filterLower)
      );
    }

    return data;
  }, [applications, filters, globalFilter, isAdmin]);

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
    return <LoadingPage message="Loading applications..." />;
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Applications</h1>
          <p className="text-gray-600">
            {isAdmin() ? 'Manage applications across all companies' : 'View your company applications'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setBulkImportModalOpen(true)}>
            Bulk Add Applications
          </Button>
          <Link to="/applications/new">
            <Button variant="primary">New Application</Button>
          </Link>
        </div>
      </div>

      {/* Admin Filters */}
      {isAdmin() && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Search"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search by name or description..."
              />
              <Select
                label="Company"
                value={filters.companyId}
                onChange={(e) => handleFilterChange('companyId', e.target.value)}
                options={[
                  { value: '', label: 'All Companies' },
                  ...companies.map(c => ({ value: c.id, label: c.name })),
                ]}
              />
              <Select
                label="Status"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'onboarded', label: 'Onboarded' },
                  { value: 'pending_technical', label: 'Pending Technical' },
                  { value: 'pending_executive', label: 'Pending Executive' },
                ]}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Applications Table */}
      {filteredData.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                {isAdmin() 
                  ? 'No applications found. Create your first application to get started.'
                  : 'No applications found in your company.'}
              </p>
              <Link to="/applications/new">
                <Button variant="primary">Create Application</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent padding="none">
            {/* Global Search (if not using admin filters) */}
            {!isAdmin() && (
              <div className="p-4 border-b">
                <Input
                  label="Search"
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  placeholder="Search applications..."
                />
              </div>
            )}

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
                    <tr
                      key={row.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => navigate(`/applications/${row.original.id}`)}
                    >
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

      {/* Technical Form Link Modal */}
      <Modal
        isOpen={technicalFormModalOpen}
        onClose={() => {
          setTechnicalFormModalOpen(false);
          setSelectedApplication(null);
          setTechnicalFormUrl('');
        }}
        title="Technical Onboarding Form Link"
      >
        {selectedApplication && (
          <div className="space-y-4">
            {generatingLink ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-sm text-gray-600">Generating technical form link...</p>
              </div>
            ) : technicalFormUrl ? (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-green-900 mb-1">
                        Link Generated Successfully
                      </h3>
                      <p className="text-sm text-green-800">
                        Share this link with the technical team to complete the onboarding form for <strong>{selectedApplication.name}</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                  <label className="block text-sm font-semibold text-blue-900 mb-2">
                    Technical Onboarding Form Link
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <Input
                      value={technicalFormUrl}
                      readOnly
                      className="font-mono text-sm flex-1"
                      onClick={(e) => e.target.select()}
                    />
                    {isClipboardAvailable() && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          copyToClipboard(
                            technicalFormUrl,
                            () => toast.success('Link copied to clipboard'),
                            (error) => toast.error(error)
                          );
                        }}
                        className="whitespace-nowrap"
                      >
                        Copy Link
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-blue-700">
                    Click the input field to select all, or use the copy button. Share this link with the technical team.
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-600 mb-4">
                  Failed to generate link. Please try again.
                </p>
                <Button
                  variant="primary"
                  onClick={handleGenerateTechnicalFormLink}
                  disabled={generatingLink}
                  className="w-full"
                >
                  {generatingLink ? 'Generating Link...' : 'Generate Technical Form Link'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <BulkImportApplicationsModal
        isOpen={bulkImportModalOpen}
        onClose={() => setBulkImportModalOpen(false)}
        companies={isAdmin() ? companies : (user?.companyId ? companies.filter(c => c.id === user.companyId) : [])}
        onSuccess={() => {
          // Reload applications to refresh data
          loadApplications();
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setApplicationToDelete(null);
          setDeleteConfirmText('');
        }}
        title="Delete Application"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteModalOpen(false);
                setApplicationToDelete(null);
                setDeleteConfirmText('');
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteApplication}
              disabled={deleteConfirmText !== `delete ${applicationToDelete?.name || ''}` || deleting}
              loading={deleting}
            >
              Delete
            </Button>
          </>
        }
      >
        {applicationToDelete && (
          <div className="space-y-4">
            <p className="text-gray-700">
              Are you sure you want to delete <strong>{applicationToDelete.name}</strong>?
            </p>
            <p className="text-sm text-red-600">
              This action cannot be undone. All data associated with this application will be permanently deleted.
            </p>
            <div className="mt-4">
              <Input
                label={`Type "delete ${applicationToDelete.name}" to confirm`}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={`delete ${applicationToDelete.name}`}
                className="font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                You must type the exact text above to confirm deletion
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
