import { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card.jsx';
import { NoteInput } from './NoteInput.jsx';
import { NotesTimeline } from './NotesTimeline.jsx';
import { LoadingPage } from '../ui/Loading.jsx';
import { Button } from '../ui/Button.jsx';
import { Checkbox } from '../ui/Checkbox.jsx';

export function NotesSection({ entityType, entityId, showApplicationLabels = false, refreshTrigger = 0 }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [showApplicationNotes, setShowApplicationNotes] = useState(true);

  useEffect(() => {
    if (entityId) {
      loadNotes();
    }
  }, [entityId, entityType, refreshTrigger]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      let data;
      if (entityType === 'company') {
        data = await api.getCompanyNotes(entityId);
      } else if (entityType === 'application') {
        data = await api.getApplicationNotes(entityId);
      } else {
        throw new Error('Invalid entity type');
      }
      setNotes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load notes:', error);
      toast.error('Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async (content) => {
    try {
      setCreating(true);
      let newNote;
      if (entityType === 'company') {
        newNote = await api.createCompanyNote(entityId, content);
      } else if (entityType === 'application') {
        newNote = await api.createApplicationNote(entityId, content);
      } else {
        throw new Error('Invalid entity type');
      }

      // Reload notes to get the full list with proper ordering
      await loadNotes();
      toast.success('Note added successfully');
    } catch (error) {
      console.error('Failed to create note:', error);
      toast.error(error.message || 'Failed to create note');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateNote = async (noteId, content) => {
    try {
      await api.updateNote(noteId, content);
      await loadNotes();
      setEditingNoteId(null);
      setEditContent('');
      toast.success('Note updated successfully');
    } catch (error) {
      console.error('Failed to update note:', error);
      toast.error(error.message || 'Failed to update note');
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await api.deleteNote(noteId);
      await loadNotes();
      toast.success('Note deleted successfully');
    } catch (error) {
      console.error('Failed to delete note:', error);
      toast.error(error.message || 'Failed to delete note');
    }
  };

  const startEditing = (note) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const cancelEditing = () => {
    setEditingNoteId(null);
    setEditContent('');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notes & Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingPage message="Loading notes..." />
        </CardContent>
      </Card>
    );
  }

  // Filter notes based on toggle
  const filteredNotes = showApplicationLabels && !showApplicationNotes
    ? notes.filter(note => !note.applicationId) // Only company notes
    : notes; // Show all notes

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes & Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Note Input */}
          <NoteInput
            onSubmit={handleCreateNote}
            loading={creating}
            placeholder={`Add a note about this ${entityType}...`}
          />

          {/* Notes Timeline - Horizontal Scroll */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-700">Timeline</h4>
              {showApplicationLabels && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showApplicationNotes}
                    onChange={(e) => setShowApplicationNotes(e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-xs text-gray-600">Show application notes</span>
                </label>
              )}
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
                      {editingNoteId === note.id ? (
                        <div className="border-t-4 border-blue-500 px-3 pt-2 pb-3 bg-gray-50 rounded-lg h-full flex flex-col">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[80px] mb-2 flex-1 text-sm"
                            rows={3}
                            maxLength={5000}
                          />
                          <div className="flex gap-2 mt-auto">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleUpdateNote(note.id, editContent)}
                              disabled={!editContent.trim() || editContent.length > 5000}
                            >
                              Save
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={cancelEditing}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="border-t-4 border-blue-500 px-3 pt-2 pb-3 bg-gray-50 rounded-lg h-full flex flex-col">
                          <div className="flex-1">
                            {/* Header with date and application label */}
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="text-xs text-gray-600">
                                {formatDate(note.createdAt)}
                              </span>
                              {showApplicationLabels && note.application && (
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
                              onClick={() => startEditing(note)}
                              className="flex-1 text-xs"
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this note?')) {
                                  handleDeleteNote(note.id);
                                }
                              }}
                              className="flex-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      )}
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

