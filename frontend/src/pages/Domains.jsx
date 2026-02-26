import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useReactTable, getCoreRowModel, getPaginationRowModel, getSortedRowModel, getFilteredRowModel, flexRender } from '@tanstack/react-table';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import useAuthStore from '../store/authStore.js';

function getStatusBadgeClasses(status) {
  const normalized = (status || 'unknown').toLowerCase();
  if (normalized === 'active') return 'bg-green-100 text-green-800';
  if (normalized === 'parked') return 'bg-yellow-100 text-yellow-800';
  if (normalized === 'deprecated') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
}

export function Domains() {
  const { isAdmin, user } = useAuthStore();
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [newDomainForm, setNewDomainForm] = useState({
    name: '',
    companyId: '',
    owner: '',
    status: 'unknown',
    description: '',
  });

  // Table state
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');

  useEffect(() => {
    loadDomains();
  }, []);

  const loadDomains = async () => {
    try {
      setLoading(true);
      const data = await api.getDomains();
      setDomains(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to load domains');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    if (!isAdmin()) return;
    try {
      setLoadingCompanies(true);
      const data = await api.getCompanies();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to load companies');
      console.error(error);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const openCreateModal = async () => {
    if (isAdmin()) {
      await loadCompanies();
    }
    setNewDomainForm({
      name: '',
      companyId: isAdmin() ? '' : user?.companyId || '',
      owner: '',
      status: 'unknown',
      description: '',
    });
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (creating) return;
    setShowCreateModal(false);
  };

  const handleCreateDomain = async () => {
    if (!newDomainForm.name.trim()) {
      toast.error('Domain name is required');
      return;
    }
    if (isAdmin() && !newDomainForm.companyId) {
      toast.error('Please select a company');
      return;
    }

    try {
      setCreating(true);
      await api.createDomain({
        name: newDomainForm.name,
        companyId: isAdmin() ? newDomainForm.companyId : undefined,
        owner: newDomainForm.owner,
        status: newDomainForm.status,
        description: newDomainForm.description,
      });
      toast.success('Domain created successfully');
      setShowCreateModal(false);
      await loadDomains();
    } catch (error) {
      toast.error(error.message || 'Failed to create domain');
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  // Define columns
  const columns = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Domain Name',
      cell: ({ row }) => (
        <Link
          to={`/domains/${row.original.id}`}
          className="font-medium text-blue-600 hover:text-blue-700"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: 'company',
      header: 'Company',
      cell: ({ row }) => {
        const domain = row.original;
        if (isAdmin() && domain.companyId) {
          return (
            <Link
              to={`/companies/${domain.companyId}`}
              className="text-gray-700 hover:text-blue-600"
            >
              {domain.company?.name || '—'}
            </Link>
          );
        }
        return <span>{domain.company?.name || '—'}</span>;
      },
      enableSorting: isAdmin(),
    },
    {
      accessorKey: 'applicationCount',
      header: 'Applications',
      cell: ({ row }) => row.original._count?.applicationDomains || 0,
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
        const status = row.original.status || 'unknown';
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadgeClasses(status)}`}>
            {status}
          </span>
        );
      },
    },
    {
      accessorKey: 'apexDomain',
      header: 'Apex Group',
      cell: ({ row }) => row.original.apexDomain || '—',
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt);
        return date.toLocaleDateString();
      },
    },
  ], [isAdmin]);

  const table = useReactTable({
    data: domains,
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
    return <LoadingPage message="Loading domains..." />;
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Domains</h1>
            <p className="text-gray-600">
              {isAdmin() ? 'All domains across all companies' : 'Domains where your company\'s applications are hosted'}
            </p>
          </div>
          <Button variant="primary" onClick={openCreateModal}>
            Add Domain
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>All Domains</CardTitle>
            <div className="w-64">
              <Input
                placeholder="Search domains..."
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-6 py-4 text-center text-gray-500">
                      No domains found
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-700">
              Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                table.getFilteredRowModel().rows.length
              )}{' '}
              of {table.getFilteredRowModel().rows.length} domains
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={showCreateModal}
        onClose={closeCreateModal}
        title="Add Domain"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeCreateModal} disabled={creating}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateDomain} loading={creating}>
              Create Domain
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Domain Name"
            placeholder="example.com or api.example.com"
            value={newDomainForm.name}
            onChange={(e) => setNewDomainForm(prev => ({ ...prev, name: e.target.value }))}
          />

          {isAdmin() && (
            <Select
              label="Company"
              value={newDomainForm.companyId}
              onChange={(e) => setNewDomainForm(prev => ({ ...prev, companyId: e.target.value }))}
              disabled={loadingCompanies}
              options={[
                { value: '', label: loadingCompanies ? 'Loading companies...' : 'Select a company' },
                ...companies.map(company => ({
                  value: company.id,
                  label: company.name,
                })),
              ]}
            />
          )}

          <Input
            label="Owner"
            placeholder="Owner/team/contact details"
            value={newDomainForm.owner}
            onChange={(e) => setNewDomainForm(prev => ({ ...prev, owner: e.target.value }))}
          />

          <Select
            label="Status"
            value={newDomainForm.status}
            onChange={(e) => setNewDomainForm(prev => ({ ...prev, status: e.target.value }))}
            options={[
              { value: 'unknown', label: 'unknown' },
              { value: 'active', label: 'active' },
              { value: 'parked', label: 'parked' },
              { value: 'deprecated', label: 'deprecated' },
            ]}
          />

          <Textarea
            label="Description"
            placeholder="Optional domain context"
            value={newDomainForm.description}
            onChange={(e) => setNewDomainForm(prev => ({ ...prev, description: e.target.value }))}
            rows={4}
          />
        </div>
      </Modal>
    </div>
  );
}

