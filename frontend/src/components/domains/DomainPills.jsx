import { useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { toast } from '../ui/Toast.jsx';

export function DomainPills({ domains = [], onAdd, onRemove, disabled = false }) {
  const [newDomain, setNewDomain] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddDomain = async () => {
    const trimmed = newDomain.trim();
    
    if (!trimmed) {
      toast.error('Please enter a hosting domain name');
      return;
    }

    // Basic client-side validation (backend will do full validation)
    if (trimmed.toLowerCase().startsWith('http://') || trimmed.toLowerCase().startsWith('https://')) {
      toast.error('Hosting domain should not include http:// or https://');
      return;
    }

    if (trimmed.includes('://') || trimmed.includes('/')) {
      toast.error('Invalid hosting domain format');
      return;
    }

    // Check if domain already exists
    if (domains.some(d => d.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('This hosting domain is already associated with this application');
      return;
    }

    try {
      setIsAdding(true);
      await onAdd(trimmed);
      setNewDomain('');
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setIsAdding(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddDomain();
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Hosting Domains
      </label>
      
      {/* Existing domains as pills */}
      {domains.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {domains.map((domain) => (
            <div
              key={domain.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium shadow-sm hover:bg-blue-100 hover:border-blue-300 transition-colors"
            >
              <span className="text-blue-900">{domain.name}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onRemove(domain.id)}
                  className="ml-0.5 p-0.5 rounded hover:bg-blue-200 text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
                  aria-label={`Remove ${domain.name}`}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add domain input */}
      {!disabled && (
        <div className="flex gap-2">
          <div className="flex-1 [&>div]:mb-0 [&_input]:h-[42px]">
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="example.com or subdomain.example.com (where application is hosted)"
              className="w-full"
            />
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={handleAddDomain}
            disabled={isAdding || !newDomain.trim()}
            loading={isAdding}
            className="whitespace-nowrap h-[42px]"
          >
            Add Hosting Domain
          </Button>
        </div>
      )}

      {domains.length === 0 && disabled && (
        <p className="text-sm text-gray-500 italic">No hosting domains associated</p>
      )}
    </div>
  );
}

