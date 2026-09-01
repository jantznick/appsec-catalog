import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { Textarea } from '../ui/Textarea.jsx';
import { Checkbox } from '../ui/Checkbox.jsx';
import { api } from '../../lib/api.js';

/**
 * "Request more information" form, opened from the public documentation site.
 *
 * Submitted by people who don't have access to the platform yet, so it asks for
 * as little as possible: an email to reply to, which programs they want to hear
 * about (pre-selected from whatever page they were reading), and an optional
 * message.
 */
export function RequestInfoModal({ isOpen, onClose, sourcePage }) {
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Load the program list and pre-select whichever one covers the current page.
  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    api
      .getProgramRequestOptions()
      .then((data) => {
        if (cancelled) return;
        const programs = data.programs || [];
        setOptions(programs);
        const match = programs.find((p) => (p.docPage || []).includes(sourcePage));
        setSelected(match ? [match.key] : ['exposure-management']);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the request form. Please try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, sourcePage]);

  // Reset back to a clean form whenever the modal is reopened.
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setMessage('');
      setError('');
      setDone(false);
      setSubmitting(false);
    }
  }, [isOpen]);

  const toggle = (key) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleSubmit = async () => {
    setError('');
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (selected.length === 0) {
      setError('Select at least one program you would like to hear about.');
      return;
    }
    try {
      setSubmitting(true);
      await api.submitProgramRequest({
        email: email.trim(),
        message: message.trim(),
        programs: selected,
        sourcePage: sourcePage || '',
      });
      setDone(true);
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={done ? 'Request sent' : 'Request more information'}
      size="lg"
      footer={
        done ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={submitting}>
              Send request
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p className="text-sm text-gray-700">
          Thanks — we&apos;ve got your request and the AppSec team will be in touch at{' '}
          <span className="font-medium text-gray-900">{email.trim()}</span>.
        </p>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-gray-600">
            Tell us how to reach you and what you&apos;d like to hear about. Someone from Hearst&apos;s AppSec
            team will follow up.
          </p>

          <Input
            id="request-info-email"
            type="email"
            label="Your email"
            required
            placeholder="you@yourcompany.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">
              What are you interested in?<span className="text-red-500 ml-1">*</span>
            </p>
            <div className="space-y-2 rounded-lg border border-gray-200 p-3">
              {options.map((option) => (
                <div key={option.key}>
                  <Checkbox
                    id={`request-info-${option.key}`}
                    label={option.label}
                    checked={selected.includes(option.key)}
                    onChange={() => toggle(option.key)}
                  />
                  {option.description && (
                    <p className="ml-6 text-xs text-gray-500">{option.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Textarea
            id="request-info-message"
            label="Anything else? (optional)"
            placeholder="Questions, context about your team, or what prompted you to reach out."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
