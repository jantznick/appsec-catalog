import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Select } from '../ui/Select.jsx';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import useAuthStore from '../../store/authStore.js';

export function EditUserModal({ isOpen, onClose, user, onUpdated }) {
  const { isAdmin } = useAuthStore();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyId: '',
    isAdmin: false,
  });

  useEffect(() => {
    if (isOpen && isAdmin()) {
      loadCompanies();
    }
  }, [isOpen, isAdmin]);

  useEffect(() => {
    if (user) {
      setFormData({
        companyId: user.companyId || '',
        isAdmin: user.isAdmin || false,
      });
    }
  }, [user]);

  const loadCompanies = async () => {
    try {
      const data = await api.getCompanies();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) return;

    try {
      setLoading(true);
      
      const payload = {
        companyId: formData.companyId || null,
        isAdmin: formData.isAdmin,
      };

      await api.updateUser(user.id, payload);
      
      toast.success('User updated successfully');
      onUpdated?.();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit User"
      size="md"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loading}
            loading={loading}
          >
            Save Changes
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            <strong>Email:</strong> {user.email}
          </p>
          <p className="text-sm text-gray-600">
            <strong>Status:</strong>{' '}
            <span className={user.verifiedAccount ? 'text-green-600' : 'text-yellow-600'}>
              {user.verifiedAccount ? 'Verified' : 'Pending'}
            </span>
          </p>
        </div>

        <Select
          label="Company"
          id="companyId"
          value={formData.companyId}
          onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
          placeholder="No company (unassigned)"
          options={companies.map(company => ({
            value: company.id,
            label: company.name,
          }))}
          helperText="Assign this user to a company or leave unassigned"
        />

        <div className="flex items-center space-x-3 pt-2">
          <input
            type="checkbox"
            id="isAdmin"
            checked={formData.isAdmin}
            onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="isAdmin" className="text-sm font-medium text-gray-700">
            Administrator
          </label>
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Admin users have full access to manage all companies, applications, and users
        </p>
      </form>
    </Modal>
  );
}



