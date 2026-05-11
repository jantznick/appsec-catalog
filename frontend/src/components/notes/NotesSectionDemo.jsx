import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card.jsx';
import { NoteInput } from './NoteInput.jsx';
import { Button } from '../ui/Button.jsx';

// Helper function to format dates
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

// Demo component for NotesSection
export function NotesSectionDemo() {
  const [showApplicationNotes, setShowApplicationNotes] = useState(true);

  // Dummy notes data
  const dummyNotes = [
    {
      id: '1',
      content: 'This is a company-level note. It provides important context about the company and its security posture.',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      updatedAt: null,
      user: { email: 'admin@example.com' },
      application: null,
      applicationId: null,
    },
    {
      id: '2',
      content: 'Application note: This application requires special attention due to its handling of sensitive data. Regular security reviews are recommended.',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
      updatedAt: null,
      user: { email: 'security@example.com' },
      application: { id: 'app1', name: 'Payment API' },
      applicationId: 'app1',
    },
    {
      id: '3',
      content: 'Another company note with some additional details about compliance requirements and upcoming audits.',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // edited 12 hours ago
      user: { email: 'admin@example.com' },
      application: null,
      applicationId: null,
    },
  ];

  const filteredNotes = !showApplicationNotes
    ? dummyNotes.filter(note => !note.applicationId)
    : dummyNotes;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes & Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Note Input */}
          <div className="opacity-50 pointer-events-none">
            <NoteInput
              onSubmit={() => {}}
              loading={false}
              placeholder="Add a note about this company..."
            />
          </div>

          {/* Notes Timeline - Horizontal Scroll */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-700">Timeline</h4>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showApplicationNotes}
                  onChange={(e) => setShowApplicationNotes(e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-xs text-gray-600">Show application notes</span>
              </label>
            </div>
            {filteredNotes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No notes yet. Add the first note above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto pb-4 -mx-2 px-2">
                <div className="flex gap-4 min-w-max">
                  {filteredNotes.map((note) => (
                    <div key={note.id} className="flex-shrink-0 w-80">
                      <div className="border-t-4 border-blue-500 px-3 pt-2 pb-3 bg-gray-50 rounded-lg h-full flex flex-col">
                        <div className="flex-1">
                          {/* Header with date and application label */}
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-xs text-gray-600">
                              {formatDate(note.createdAt)}
                            </span>
                            {note.application && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {note.application.name} Note
                              </span>
                            )}
                            {note.updatedAt && note.updatedAt !== note.createdAt && (
                              <span className="text-xs text-gray-400">(edited)</span>
                            )}
                          </div>

                          {/* Author */}
                          <div className="text-xs text-gray-500 mb-1.5">
                            by {note.user?.email || 'Unknown'}
                          </div>

                          {/* Content */}
                          <div className="text-gray-900 whitespace-pre-wrap break-words text-sm max-h-48 note-content-scroll">
                            {note.content}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 text-xs"
                            disabled
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50"
                            disabled
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

