import { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Select } from '../ui/Select.jsx';
import { integrationProviderLabel } from '../../lib/integrationLabels.js';

/**
 * Add or rotate API keys for an integration (enterprise catalog-wide or company-scoped).
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   scope: 'ENTERPRISE' | 'COMPANY',
 *   companyId?: string,
 *   onSaved: () => void | Promise<void>,
 *   title?: string,
 *   providerOptions: Array<{ value: string, label: string }>,
 *   defaultProvider?: string,
 *   description?: string,
 * }} props
 */
export function AddIntegrationModal({
  isOpen,
  onClose,
  scope,
  companyId,
  onSaved,
  title,
  providerOptions,
  defaultProvider,
  description,
}) {
  const [provider, setProvider] = useState(defaultProvider || providerOptions[0]?.value || '');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setProvider(defaultProvider || providerOptions[0]?.value || '');
      setAccessKey('');
      setSecretKey('');
      setBaseUrl('');
    }
  }, [isOpen, defaultProvider, providerOptions]);

  const isWiz = provider === 'WIZ';

  const handleSave = async () => {
    if (!accessKey.trim() || !secretKey.trim()) {
      toast.error(isWiz ? 'Client ID and client secret are required' : 'Access key and secret key are required');
      return;
    }
    if (isWiz && !baseUrl.trim()) {
      toast.error('GraphQL endpoint is required for Wiz');
      return;
    }
    if (scope === 'COMPANY' && !companyId) {
      toast.error('Missing company');
      return;
    }
    setSaving(true);
    try {
      const body = {
        scope,
        accessKey: accessKey.trim(),
        secretKey: secretKey.trim(),
        baseUrl: baseUrl.trim() || undefined,
      };
      if (scope === 'COMPANY') {
        body.companyId = companyId;
      }
      await api.putIntegrationCredentials(provider, body);
      toast.success('Integration saved');
      await onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const modalTitle =
    title ||
    (scope === 'ENTERPRISE' ? 'Add catalog-wide integration' : 'Add company integration');

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title={modalTitle}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {description ? (
          <p className="text-sm text-gray-600">{description}</p>
        ) : null}
        <Select
          label="Integration"
          options={providerOptions.map((o) => ({
            ...o,
            label: o.label || integrationProviderLabel(o.value),
          }))}
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        />
        <Input
          label={isWiz ? 'Client ID' : 'Access key'}
          type="password"
          autoComplete="off"
          value={accessKey}
          onChange={(e) => setAccessKey(e.target.value)}
        />
        <Input
          label={isWiz ? 'Client secret' : 'Secret key'}
          type="password"
          autoComplete="off"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
        />
        <Input
          label={isWiz ? 'GraphQL endpoint' : 'API base URL (optional)'}
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={
            isWiz
              ? 'https://api.<tenant>.app.wiz.io/graphql'
              : 'https://cloud.tenable.com'
          }
        />
        {!isWiz ? (
          <p className="text-xs text-gray-500">Leave base URL empty to use the vendor default.</p>
        ) : (
          <p className="text-xs text-gray-500">
            Your tenant&apos;s Wiz GraphQL API URL (stored as the integration base URL). OAuth uses Wiz&apos;s
            global token endpoint.
          </p>
        )}
      </div>
    </Modal>
  );
}
