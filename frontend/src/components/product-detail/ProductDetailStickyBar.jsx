import { Button } from '../ui/Button.jsx';

export function ProductDetailStickyBar({
  hasUnsavedChanges,
  handleCancel,
  handleSaveMetadata,
  savingMeta,
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hasUnsavedChanges ? (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span>You have unsaved changes</span>
              </div>
            ) : (
              <div className="text-sm text-gray-500">No changes made</div>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSaveMetadata} loading={savingMeta} disabled={!hasUnsavedChanges}>
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
