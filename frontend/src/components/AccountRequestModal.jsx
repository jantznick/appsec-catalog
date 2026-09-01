import { useState, useEffect } from 'react';
import { Button, Input, Modal, Textarea } from './ui/index.js';
import { api } from '../lib/api.js';

/**
 * "Request an account" form, opened from the login modal's "Need an account?"
 * link. Since account creation is Okta-only, people without access can't
 * self-register — this lets them ask an admin to provision them. It reuses the
 * program-requests backend, tagged as an ACCOUNT request (sourcePage
 * 'account-request'); admins triage it from the same requests queue.
 */
export function AccountRequestModal({ isOpen, onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Reset to a clean form whenever the modal is reopened.
  useEffect(() => {
    if (isOpen) {
      setName('');
      setEmail('');
      setMessage('');
      setError('');
      setDone(false);
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    try {
      setSubmitting(true);
      await api.submitProgramRequest({
        requestType: 'ACCOUNT',
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
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
      title={done ? 'Request sent' : 'Request an account'}
      size="md"
      footer={
        done ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={submitting}>
              Submit request
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p className="text-sm text-gray-700">
          Thanks — your request has been submitted. An administrator will review it and, if approved,
          provision your access through Okta. We&apos;ll be in touch at{' '}
          <span className="font-medium text-gray-900">{email.trim()}</span>.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Accounts are provisioned through Okta single sign-on. Tell us who you are and an
            administrator will set up your access.
          </p>

          <Input
            id="account-request-name"
            label="Your name"
            required
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input
            id="account-request-email"
            type="email"
            label="Your email"
            required
            placeholder="you@yourcompany.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Textarea
            id="account-request-message"
            label="Anything else? (optional)"
            placeholder="Your team, what you need access for, or who referred you."
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
