import { useState } from 'react';
import { api } from '../../lib/api.js';
import { Button } from '../ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card.jsx';
import { Input } from '../ui/Input.jsx';
import { Select } from '../ui/Select.jsx';
import { Textarea } from '../ui/Textarea.jsx';
import { toast } from '../ui/Toast.jsx';
import {
  UPDATE_CATEGORIES,
  categoryBadgeClass,
  formatShortDate,
  requestStatusMeta,
  stageMeta,
} from '../../lib/productCommunication.js';

const emptyForm = { title: '', category: 'Feature', details: '' };

function StatusBadge({ status }) {
  const meta = requestStatusMeta(status);
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${meta.badge}`}>{meta.label}</span>;
}

function MyRequestCard({ request }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={request.status} />
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryBadgeClass(request.category)}`}>
          {request.category}
        </span>
        <span className="ml-auto text-xs text-gray-500">{formatShortDate(request.createdAt)}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-gray-900">{request.title}</p>
      <p className="mt-1 whitespace-pre-line text-sm leading-6 text-gray-600">{request.details}</p>

      {request.adminNote && (
        <div className="mt-3 rounded-lg border-l-2 border-blue-500 bg-surface p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Reply from the team</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-6 text-gray-700">{request.adminNote}</p>
        </div>
      )}

      {request.roadmapItem && (
        <p className="mt-3 text-xs text-gray-500">
          On the roadmap as{' '}
          <span className="font-medium text-gray-700">{request.roadmapItem.title}</span> —{' '}
          {stageMeta(request.roadmapItem.stage).label}.
        </p>
      )}
    </div>
  );
}

/**
 * Submit an idea and follow your own.
 *
 * Requests are private: they go to the Orbit admins and nowhere else. The only
 * thing that comes back is the status and whatever reply an admin writes, both
 * of which show up in the list beside the form.
 */
export function FeatureRequestPanel({ myRequests, onSubmitted, error }) {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.details.trim()) {
      toast.error('Add a title and a short description');
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.submitFeatureRequest(form);
      setForm(emptyForm);
      onSubmitted?.(response.request);
      toast.success(response.message || 'Request submitted');
    } catch (err) {
      toast.error(err?.message || 'Failed to submit your request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
      <Card>
        <CardHeader>
          <CardTitle>Request a feature</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-600">
            Tell us what would make Orbit more useful. Requests go straight to the Orbit admins —
            nobody else sees them.
          </p>
          <form className="space-y-4" onSubmit={submit}>
            <Input
              label="What would you like to see?"
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="e.g. Export the dependency list as CSV"
              maxLength={200}
              required
            />
            <Select
              label="Area"
              value={form.category}
              onChange={(event) => updateField('category', event.target.value)}
              options={UPDATE_CATEGORIES.map((category) => ({ value: category, label: category }))}
            />
            <Textarea
              label="Tell us more"
              value={form.details}
              onChange={(event) => updateField('details', event.target.value)}
              placeholder="What are you trying to do, and what gets in the way today?"
              rows={6}
              maxLength={4000}
              required
            />
            <div className="flex justify-end">
              <Button type="submit" loading={submitting}>
                Send request
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your requests</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : myRequests.length === 0 ? (
            <p className="text-sm text-gray-500">
              You haven&apos;t sent any requests yet. Anything you send shows up here with its
              status and any reply from the team.
            </p>
          ) : (
            <div className="space-y-3">
              {myRequests.map((request) => (
                <MyRequestCard key={request.id} request={request} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
