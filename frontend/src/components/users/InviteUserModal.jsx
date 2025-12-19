import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { Select } from '../ui/Select.jsx';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import useAuthStore from '../../store/authStore.js';

export function InviteUserModal({ isOpen, onClose, onInvited }) {
  const { isAdmin, user: currentUser } = useAuthStore();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    companyId: '',
    isAdmin: false,
  });
  const [invitationUrl, setInvitationUrl] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (isAdmin()) {
        loadCompanies();
      }
      // For company members, set their company ID
      if (!isAdmin() && currentUser?.companyId) {
        setFormData({ email: '', companyId: currentUser.companyId, isAdmin: false });
      } else {
        setFormData({ email: '', companyId: '', isAdmin: false });
      }
      setInvitationUrl('');
    }
  }, [isOpen, isAdmin, currentUser]);

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
    
    if (!formData.email) {
      toast.error('Email is required');
      return;
    }

    try {
      setLoading(true);
      
      // Build payload based on user role
      const payload = {
        email: formData.email,
      };

      // Only admins can set company and admin status
      if (isAdmin()) {
        payload.companyId = formData.companyId || null;
        payload.isAdmin = formData.isAdmin;
      }
      // Company members - backend will automatically use their company

      const result = await api.inviteUser(payload);
      
      toast.success('Invitation created successfully');
      setInvitationUrl(result.invitationUrl);
      onInvited?.();
      
      // Don't close modal yet - show the invitation URL
    } catch (error) {
      toast.error(error.message || 'Failed to create invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(invitationUrl);
    toast.success('Invitation URL copied to clipboard');
  };

  const handleClose = () => {
    setInvitationUrl('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={invitationUrl ? "Invitation Created" : "Invite User"}
      size="md"
      footer={
        invitationUrl ? (
          <>
            <Button
              variant="secondary"
              onClick={handleClose}
            >
              Close
            </Button>
            <Button
              variant="primary"
              onClick={handleCopyUrl}
            >
              Copy Link
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={handleClose}
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
              Send Invitation
            </Button>
          </>
        )
      }
    >
      {invitationUrl ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-green-900 mb-1">
                  Invitation Created Successfully
                </h3>
                <p className="text-sm text-green-800">
                  Invitation has been created for <strong>{formData.email}</strong>. Share the link below with them to complete their account setup.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
            <label className="block text-sm font-semibold text-blue-900 mb-2">
              Invitation Link
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={invitationUrl}
                readOnly
                className="flex-1 px-4 py-3 text-sm font-mono border-2 border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={(e) => e.target.select()}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleCopyUrl}
                className="whitespace-nowrap"
              >
                Copy Link
              </Button>
            </div>
            <p className="text-xs text-blue-700">
              Click the input field to select all, or use the copy button. Share this link with the user so they can set their password and complete their account setup.
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs text-yellow-800">
              <strong>Note:</strong> This invitation link expires in 7 days. The user will appear in the users list as "Pending" until they accept the invitation.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            id="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="user@example.com"
            required
            helperText="The user will receive an invitation link to this email"
          />

          {isAdmin() ? (
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
                helperText="Optionally assign this user to a company"
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
            </>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                This user will be invited to <strong>{currentUser?.company?.name || 'your company'}</strong>.
                Only administrators can assign users to different companies or grant admin privileges.
              </p>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}

