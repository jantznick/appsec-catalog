import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import useAuthStore from '../store/authStore.js';

export function Divisions() {
  const { isAdmin } = useAuthStore();
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDivision, setEditingDivision] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (isAdmin()) {
      loadDivisions();
    }
  }, [isAdmin]);

  const loadDivisions = async () => {
    try {
      setLoading(true);
      const data = await api.getDivisions();
      setDivisions(data);
    } catch (error) {
      toast.error('Failed to load divisions');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingDivision(null);
    setFormData({ name: '', description: '' });
    setShowModal(true);
  };

  const handleEdit = (division) => {
    setEditingDivision(division);
    setFormData({
      name: division.name,
      description: division.description || '',
    });
    setShowModal(true);
  };

  const handleDelete = (division) => {
    setDeleteTarget(division);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await api.deleteDivision(deleteTarget.id);
      toast.success('Division deleted successfully');
      setDeleteTarget(null);
      await loadDivisions();
    } catch (error) {
      toast.error(error.message || 'Failed to delete division');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Division name is required');
      return;
    }

    try {
      setSaving(true);
      if (editingDivision) {
        await api.updateDivision(editingDivision.id, formData);
        toast.success('Division updated successfully');
      } else {
        await api.createDivision(formData);
        toast.success('Division created successfully');
      }
      setShowModal(false);
      setFormData({ name: '', description: '' });
      setEditingDivision(null);
      await loadDivisions();
    } catch (error) {
      toast.error(error.message || `Failed to ${editingDivision ? 'update' : 'create'} division`);
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin()) {
    return (
      <div>
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-500">You do not have permission to view this page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <LoadingPage message="Loading divisions..." />;
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Divisions</h1>
          <p className="text-gray-600">Manage company divisions</p>
        </div>
        <Button variant="primary" onClick={handleCreate}>
          Create Division
        </Button>
      </div>

      {divisions.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No divisions found. Create your first division to get started.</p>
              <Button variant="primary" onClick={handleCreate}>
                Create Division
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {divisions.map((division) => (
            <Card key={division.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <Link to={`/divisions/${division.id}`} className="flex-1">
                    <CardTitle className="hover:text-blue-600">{division.name}</CardTitle>
                  </Link>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleEdit(division);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(division);
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Link to={`/divisions/${division.id}`} className="block">
                  <div className="space-y-2">
                    {division.description && (
                      <p className="text-sm text-gray-600">{division.description}</p>
                    )}
                    <div className="text-xs text-gray-500">
                      {division._count?.companies || 0} {division._count?.companies === 1 ? 'company' : 'companies'}
                    </div>
                  </div>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setFormData({ name: '', description: '' });
            setEditingDivision(null);
          }}
          title={editingDivision ? 'Edit Division' : 'Create Division'}
        >
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <Input
                label="Division Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Engineering, Sales, Operations"
              />
              <Textarea
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Optional description of this division"
              />
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowModal(false);
                    setFormData({ name: '', description: '' });
                    setEditingDivision(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={saving}>
                  {editingDivision ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Delete Division"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
            </p>
            {deleteTarget._count?.companies > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  This division has {deleteTarget._count.companies} {deleteTarget._count.companies === 1 ? 'company' : 'companies'} assigned to it.
                  You must reassign these companies before deleting the division.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                loading={deleting}
                disabled={deleteTarget._count?.companies > 0}
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

