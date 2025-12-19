import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import useAuthStore from '../../store/authStore.js';

export function DeleteUserModal({ isOpen, onClose, user, onConfirm }) {
  const { isAdmin } = useAuthStore();
  const [confirmText, setConfirmText] = useState('');
  const requiredText = user ? `confirm delete ${user.email}` : '';

  useEffect(() => {
    if (!isOpen) {
      setConfirmText('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (isAdmin() && confirmText !== requiredText) {
      return;
    }
    onConfirm();
  };

  const canDelete = isAdmin() ? confirmText === requiredText : true;

  if (!user) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete User"
      size="sm"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={!canDelete}
            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Delete
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-gray-700">
          Are you sure you want to delete <strong>{user.email}</strong>?
        </p>
        <p className="text-sm text-red-600">
          This action cannot be undone. All data associated with this user will be permanently deleted.
        </p>

        {isAdmin() && (
          <div className="mt-4">
            <Input
              label={`Type "${requiredText}" to confirm`}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={requiredText}
              className="font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              You must type the exact text above to confirm deletion
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

