import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Card, CardContent } from '../components/ui/Card.jsx';

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function renderBody(body) {
  if (!body) return null;
  return String(body)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => (
      <p key={`${paragraph.slice(0, 20)}-${index}`} className="text-sm text-gray-700 leading-6">
        {paragraph}
      </p>
    ));
}

export function WhatsNew() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadUpdates() {
      try {
        setLoading(true);
        setError('');
        const data = await api.getPublishedProductUpdates(50);
        if (!cancelled) {
          setUpdates(data.updates || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load product updates');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadUpdates();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">What&apos;s New</h1>
        <p className="text-sm text-gray-600 mt-1">Recent AppSec Catalog improvements and release notes.</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : error ? (
        <Card>
          <CardContent>
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      ) : updates.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-gray-500">No product updates have been published yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {updates.map((update) => (
            <Card key={update.id}>
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium">
                        {update.category}
                      </span>
                      {update.releaseLabel && (
                        <span className="text-xs font-medium text-gray-500">{update.releaseLabel}</span>
                      )}
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mt-2">{update.title}</h2>
                  </div>
                  <p className="text-sm text-gray-500 shrink-0">{formatDate(update.publishedAt)}</p>
                </div>
                <p className="text-base text-gray-800 leading-7">{update.summary}</p>
                <div className="space-y-3">{renderBody(update.body)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
