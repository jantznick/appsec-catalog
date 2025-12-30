import { useState } from 'react';
import { Textarea } from '../ui/Textarea.jsx';
import { Button } from '../ui/Button.jsx';

const MAX_LENGTH = 5000;

export function NoteInput({ onSubmit, loading, placeholder = 'Enter your note...' }) {
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // Validate
    if (!content.trim()) {
      setError('Note content is required');
      return;
    }

    if (content.length > MAX_LENGTH) {
      setError(`Note cannot exceed ${MAX_LENGTH} characters`);
      return;
    }

    // Submit
    onSubmit(content.trim());
    setContent(''); // Clear input after successful submission
  };

  const remainingChars = MAX_LENGTH - content.length;
  const isNearLimit = remainingChars < 100;

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        label="Add Note"
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setError('');
        }}
        placeholder={placeholder}
        rows={3}
        disabled={loading}
        error={error}
        helperText={
          isNearLimit
            ? `${remainingChars} characters remaining`
            : `Maximum ${MAX_LENGTH} characters`
        }
        maxLength={MAX_LENGTH}
      />
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={loading || !content.trim()}
          loading={loading}
        >
          Add Note
        </Button>
      </div>
    </form>
  );
}

