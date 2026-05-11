import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import useAuthStore from '../../store/authStore.js';

export function ChangePasswordModal({ isOpen, onClose, user, onPasswordChanged }) {
  const { user: currentUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const hasPassword = user?.hasPassword === true;
  const isCurrentUser = currentUser?.id === user?.id;

  useEffect(() => {
    if (!isOpen) {
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isCurrentUser) {
      toast.error('You can only change your own password');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (formData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    try {
      setLoading(true);

      const payload = {
        newPassword: formData.newPassword,
      };

      // Only include current password if user has one
      if (hasPassword) {
        if (!formData.currentPassword) {
          toast.error('Current password is required');
          setLoading(false);
          return;
        }
        payload.currentPassword = formData.currentPassword;
      }

      await api.changePassword(payload);

      toast.success(hasPassword ? 'Password updated successfully' : 'Password set successfully');
      onPasswordChanged?.();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  if (!user || !isCurrentUser) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={hasPassword ? "Change Password" : "Set Password"}
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
            {hasPassword ? 'Update Password' : 'Set Password'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            <strong>Email:</strong> {user.email}
          </p>
          {!hasPassword && (
            <p className="text-sm text-yellow-600 mt-2">
              You don't have a password set. Setting one will allow you to log in with email and password.
            </p>
          )}
        </div>

        {hasPassword && (
          <Input
            label="Current Password"
            type="password"
            id="currentPassword"
            value={formData.currentPassword}
            onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
            placeholder="••••••••"
            required
            helperText="Enter your current password to verify your identity"
          />
        )}

        <Input
          label={hasPassword ? "New Password" : "Password"}
          type="password"
          id="newPassword"
          value={formData.newPassword}
          onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
          placeholder="••••••••"
          required
          minLength={8}
          helperText="Must be at least 8 characters long"
        />

        <Input
          label={hasPassword ? "Confirm New Password" : "Confirm Password"}
          type="password"
          id="confirmPassword"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          placeholder="••••••••"
          required
          minLength={8}
          error={
            formData.confirmPassword && formData.newPassword !== formData.confirmPassword
              ? 'Passwords do not match'
              : undefined
          }
        />
      </form>
    </Modal>
  );
}

