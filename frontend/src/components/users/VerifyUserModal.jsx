import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Select } from '../ui/Select.jsx';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import useAuthStore from '../../store/authStore.js';

export function VerifyUserModal({ isOpen, onClose, user, onVerified }) {
  const { isAdmin } = useAuthStore();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyId: user?.companyId || '',
    isAdmin: user?.isAdmin || false,
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
      
      // Only send companyId and isAdmin if the requester is an admin
      const payload = isAdmin() ? {
        companyId: formData.companyId || null,
        isAdmin: formData.isAdmin,
      } : {};

      await api.verifyUser(user.id, payload);
      
      toast.success('User verified successfully');
      onVerified?.();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to verify user');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Verify User"
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
            Verify User
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            <strong>Email:</strong> {user.email}
          </p>
          {user.company && (
            <p className="text-sm text-gray-600">
              <strong>Current Company:</strong> {user.company.name}
            </p>
          )}
        </div>

        {isAdmin() && (
          <>
            <Select
              label="Assign to Company"
              id="companyId"
              value={formData.companyId}
              onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
              placeholder="No company (leave unassigned)"
              options={companies.map(company => ({
                value: company.id,
                label: company.name,
              }))}
              helperText="Optionally assign this user to a company during verification"
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
                Make this user an administrator
              </label>
            </div>
            <p className="text-xs text-gray-500 -mt-2">
              Admin users will retain their admin status even when the server restarts
            </p>
          </>
        )}

        {!isAdmin() && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              {user.companyId 
                ? 'You can verify this user. Only administrators can assign companies or grant admin privileges.'
                : 'Verifying this user will automatically assign them to your company. Only administrators can grant admin privileges.'}
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
}

