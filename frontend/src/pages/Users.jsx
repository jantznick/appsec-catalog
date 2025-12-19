import { useState, useEffect, useMemo } from 'react';
import { useReactTable, getCoreRowModel, getPaginationRowModel, getSortedRowModel, getFilteredRowModel, flexRender } from '@tanstack/react-table';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { VerifyUserModal } from '../components/users/VerifyUserModal.jsx';
import { EditUserModal } from '../components/users/EditUserModal.jsx';
import { DeleteUserModal } from '../components/users/DeleteUserModal.jsx';
import { InviteUserModal } from '../components/users/InviteUserModal.jsx';
import { ChangePasswordModal } from '../components/users/ChangePasswordModal.jsx';
import useAuthStore from '../store/authStore.js';

export function Users() {
  const { isAdmin, user: currentUser, isAuthenticated } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Table state
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('all'); // 'all', 'verified', 'unverified'

  useEffect(() => {
    if (isAuthenticated()) {
      loadUsers();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getAllUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to load users');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyClick = (user) => {
    setSelectedUser(user);
    setVerifyModalOpen(true);
  };

  const handleVerified = async () => {
    await loadUsers();
    // Refresh current user if they verified themselves
    const authStore = useAuthStore.getState();
    await authStore.init();
  };

  const handleEditClick = (user) => {
    setSelectedUser(user);
    setEditModalOpen(true);
  };

  const handleUpdated = async () => {
    await loadUsers();
    // Refresh current user if they updated themselves
    const authStore = useAuthStore.getState();
    await authStore.init();
  };

  const handleDeleteClick = (user) => {
    setSelectedUser(user);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedUser) return;

    try {
      await api.deleteUser(selectedUser.id);
      toast.success('User deleted successfully');
      await loadUsers();
      setDeleteConfirmOpen(false);
      setSelectedUser(null);
    } catch (error) {
      toast.error(error.message || 'Failed to delete user');
    }
  };

  const handleChangePasswordClick = (user) => {
    setSelectedUser(user);
    setChangePasswordModalOpen(true);
  };

  const handlePasswordChanged = async () => {
    await loadUsers();
  };

  // Define columns
  const columns = useMemo(() => [
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <span className="font-medium text-gray-900">{row.original.email}</span>
      ),
    },
    {
      accessorKey: 'company',
      header: 'Company',
      cell: ({ row }) => {
        const company = row.original.company;
        if (company) {
          return <span>{company.name}</span>;
        }
        return <span className="text-yellow-600 font-medium">No company</span>;
      },
    },
    {
      accessorKey: 'verifiedAccount',
      header: 'Status',
      cell: ({ row }) => {
        const verified = row.original.verifiedAccount;
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            verified 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {verified ? 'Verified' : 'Pending'}
          </span>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: 'isAdmin',
      header: 'Role',
      cell: ({ row }) => {
        const isAdmin = row.original.isAdmin;
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isAdmin 
              ? 'bg-purple-100 text-purple-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {isAdmin ? 'Admin' : 'User'}
          </span>
        );
      },
      enableSorting: true,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const user = row.original;
        const verified = user.verifiedAccount;
        const isCurrentUser = currentUser?.id === user.id;
        
        return (
          <div className="flex items-center gap-2">
            {!verified && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleVerifyClick(user)}
              >
                Verify
              </Button>
            )}
            {isCurrentUser && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleChangePasswordClick(user)}
                title={user.hasPassword ? "Change password" : "Set password"}
              >
                {user.hasPassword ? "Change Password" : "Set Password"}
              </Button>
            )}
            {isAdmin() && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditClick(user)}
                >
                  Edit
                </Button>
                <button
                  onClick={() => handleDeleteClick(user)}
                  className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                  title="Delete user"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
  ], [currentUser]);

  // Filter data based on global filter and verification filter
  const filteredData = useMemo(() => {
    let data = [...users];

    // Apply verification filter
    if (verificationFilter === 'verified') {
      data = data.filter(user => user.verifiedAccount === true);
    } else if (verificationFilter === 'unverified') {
      data = data.filter(user => user.verifiedAccount === false);
    }

    // Apply global filter
    if (globalFilter) {
      const filterLower = globalFilter.toLowerCase();
      data = data.filter(user =>
        user.email?.toLowerCase().includes(filterLower) ||
        user.company?.name?.toLowerCase().includes(filterLower)
      );
    }

    return data;
  }, [users, globalFilter, verificationFilter]);

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

  if (!isAuthenticated()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent>
            <p className="text-gray-600">You must be logged in to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <LoadingPage message="Loading users..." />;
  }

  // Check if non-admin user has a company
  if (!isAdmin() && !currentUser?.companyId) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Users</h1>
          <p className="text-gray-600">
            View and manage users in your company
          </p>
        </div>
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                You are not assigned to a company. Please contact an administrator to be assigned to a company.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Users</h1>
          <p className="text-gray-600">
            {isAdmin() 
              ? 'Manage all users, verify accounts, and view permissions'
              : 'View and manage users in your company'}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setInviteModalOpen(true)}
        >
          Invite User
        </Button>
      </div>

      {users.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No users found.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent padding="none">
            {/* Filters */}
            <div className="p-4 border-b space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Input
                    label="Search"
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    placeholder="Search by email or company..."
                  />
                </div>
                <div className="w-48">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Verification Status
                  </label>
                  <select
                    value={verificationFilter}
                    onChange={(e) => setVerificationFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Users</option>
                    <option value="verified">Verified Only</option>
                    <option value="unverified">Pending Only</option>
                  </select>
                </div>
              </div>
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

      <VerifyUserModal
        isOpen={verifyModalOpen}
        onClose={() => {
          setVerifyModalOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        onVerified={handleVerified}
      />

      <EditUserModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        onUpdated={handleUpdated}
      />

      <DeleteUserModal
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        onConfirm={handleDeleteConfirm}
      />

      <InviteUserModal
        isOpen={inviteModalOpen}
        onClose={async () => {
          setInviteModalOpen(false);
          // Reload users when modal closes (in case a user was created)
          await loadUsers();
        }}
        onInvited={async () => {
          // Reload users immediately after invitation is created
          await loadUsers();
        }}
      />

      <ChangePasswordModal
        isOpen={changePasswordModalOpen}
        onClose={() => {
          setChangePasswordModalOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        onPasswordChanged={handlePasswordChanged}
      />
    </div>
  );
}

