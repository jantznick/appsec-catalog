import { Button } from '../ui/Button.jsx';

/**
 * Format a date to a readable string
 * Shows relative time for recent dates, absolute date for older ones
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

export function NotesTimeline({
  notes,
  onDeleteNote,
  showApplicationLabel = false,
  isAdmin = false,
}) {
  if (!notes || notes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No notes yet. Add the first note above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notes.map((note) => (
        <div
          key={note.id}
          className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 rounded-r-lg"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Header with date and application label */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-sm text-gray-600">
                  {formatDate(note.createdAt)}
                </span>
                {showApplicationLabel && note.application && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {note.application.name} Note
                  </span>
                )}
                {note.updatedAt && note.updatedAt !== note.createdAt && (
                  <span className="text-xs text-gray-400">(edited)</span>
                )}
              </div>

              {/* Author */}
              <div className="text-xs text-gray-500 mb-2">
                by {note.user?.email || 'Unknown'}
              </div>

              {/* Content */}
              <div className="text-gray-900 whitespace-pre-wrap break-words">
                {note.content}
              </div>
            </div>

            {/* Delete button */}
            {isAdmin && onDeleteNote && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this note?')) {
                    onDeleteNote(note.id);
                  }
                }}
                className="flex-shrink-0"
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

