import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { Checkbox } from '../ui/Checkbox.jsx';
import { RadioGroup, Radio } from '../ui/Radio.jsx';
import { toast } from '../ui/Toast.jsx';
import { api } from '../../lib/api.js';

// Metadata that a split can carry over to the new application. Mirrors
// backend/utils/applicationSplitFields.js — keep the two in sync.
const SPLIT_FIELD_GROUPS = [
  {
    title: 'Basic Information',
    fields: [
      { key: 'description', label: 'Description' },
      { key: 'owner', label: 'Owner' },
      { key: 'repoUrl', label: 'Repository URL' },
      { key: 'language', label: 'Language' },
      { key: 'framework', label: 'Framework' },
      { key: 'serverEnvironment', label: 'Server Environment' },
      { key: 'facing', label: 'Facing' },
      { key: 'deploymentType', label: 'Deployment Type' },
      { key: 'authProfiles', label: 'Auth Profiles' },
      { key: 'dataTypes', label: 'Data Types' },
    ],
  },
  {
    title: 'Business Context',
    fields: [
      { key: 'businessCriticality', label: 'Business Criticality' },
      { key: 'criticalAspects', label: 'Critical Aspects' },
      { key: 'devTeamContact', label: 'Dev Team Contact' },
    ],
  },
  {
    title: 'Security Testing & Tooling',
    fields: [
      { key: 'securityTestingDescription', label: 'Security Testing Description' },
      { key: 'sastTool', label: 'SAST Tool' },
      { key: 'sastIntegrationLevel', label: 'SAST Integration Level' },
      { key: 'sastIncludesSca', label: 'SAST includes SCA' },
      { key: 'dastTool', label: 'DAST Tool' },
      { key: 'dastIntegrationLevel', label: 'DAST Integration Level' },
      { key: 'scaTool', label: 'SCA Tool' },
      { key: 'scaIntegrationLevel', label: 'SCA Integration Level' },
      { key: 'appFirewallTool', label: 'App Firewall Tool' },
      { key: 'appFirewallIntegrationLevel', label: 'App Firewall Integration Level' },
      { key: 'appFirewallNA', label: 'App Firewall N/A' },
      { key: 'apiSecurityTool', label: 'API Security Tool' },
      { key: 'apiSecurityIntegrationLevel', label: 'API Security Integration Level' },
      { key: 'apiSecurityNA', label: 'API Security N/A' },
    ],
  },
  {
    title: 'Deployment',
    fields: [
      { key: 'currentVersion', label: 'Current Version' },
      { key: 'deploymentEnvironment', label: 'Deployment Environment' },
      { key: 'gitBranch', label: 'Git Branch' },
      { key: 'lastDastScanDate', label: 'Last DAST Scan Date' },
      { key: 'lastSastScanDate', label: 'Last SAST Scan Date' },
      { key: 'lastScaScanDate', label: 'Last SCA Scan Date' },
    ],
  },
  {
    title: 'Notes',
    fields: [{ key: 'additionalNotes', label: 'Additional Notes' }],
  },
];

const ALL_SPLIT_FIELDS = SPLIT_FIELD_GROUPS.flatMap((group) => group.fields.map((f) => f.key));

// A field is worth pre-selecting only if the source application actually has a value
// for it — copying blanks is a no-op.
function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'boolean') return value === true;
  return true;
}

export function SplitApplicationModal({ isOpen, onClose, application, onSplit }) {
  const [originalName, setOriginalName] = useState('');
  const [newName, setNewName] = useState('');
  const [metadataMode, setMetadataMode] = useState('all');
  const [selectedFields, setSelectedFields] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const populatedFields = useMemo(() => {
    if (!application) return [];
    return ALL_SPLIT_FIELDS.filter((field) => hasValue(application[field]));
  }, [application]);

  // Reset the form each time the modal opens so a cancelled split leaves nothing behind
  useEffect(() => {
    if (!isOpen) return;
    setOriginalName(application?.name || '');
    setNewName('');
    setMetadataMode('all');
    setSelectedFields([]);
    setSubmitting(false);
  }, [isOpen, application?.name]);

  const handleModeChange = (mode) => {
    setMetadataMode(mode);
    // Pre-select whatever the original actually has filled in — it's the useful default
    if (mode === 'selected' && selectedFields.length === 0) {
      setSelectedFields(populatedFields);
    }
  };

  const toggleField = (field) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const trimmedOriginalName = originalName.trim();
  const trimmedNewName = newName.trim();

  let validationError = '';
  if (!trimmedOriginalName) {
    validationError = 'The original application still needs a name.';
  } else if (!trimmedNewName) {
    validationError = 'Give the new application a name.';
  } else if (trimmedOriginalName.toLowerCase() === trimmedNewName.toLowerCase()) {
    validationError = 'The two applications need different names.';
  }

  const handleSubmit = async () => {
    if (validationError || !application) return;

    try {
      setSubmitting(true);
      const result = await api.splitApplication(application.id, {
        originalName: trimmedOriginalName,
        newName: trimmedNewName,
        metadataMode,
        fields: metadataMode === 'selected' ? selectedFields : [],
      });
      toast.success(`Split complete — created "${result.newApplication.name}"`);
      onSplit?.(result);
    } catch (error) {
      toast.error(error.message || 'Failed to split application');
    } finally {
      setSubmitting(false);
    }
  };

  if (!application) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Split Application"
      size="xl"
      closeOnOverlayClick={!submitting}
      closeOnEscape={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!!validationError || submitting} loading={submitting}>
            Split Application
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <p className="text-sm text-gray-600">
          Splitting creates a second application alongside this one. Name the new application, then
          choose how much of this application's metadata it starts with.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Original application name"
            value={originalName}
            onChange={(e) => setOriginalName(e.target.value)}
            helperText="Optional — leave as-is to keep the current name"
          />
          <Input
            label="New application name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Checkout API"
            required
          />
        </div>

        <RadioGroup label="Metadata for the new application">
          <Radio
            name="split-metadata-mode"
            value="all"
            label="Keep all metadata"
            checked={metadataMode === 'all'}
            onChange={() => handleModeChange('all')}
          />
          <Radio
            name="split-metadata-mode"
            value="none"
            label="Keep no metadata — start from a blank record"
            checked={metadataMode === 'none'}
            onChange={() => handleModeChange('none')}
          />
          <Radio
            name="split-metadata-mode"
            value="selected"
            label="Keep selected metadata"
            checked={metadataMode === 'selected'}
            onChange={() => handleModeChange('selected')}
          />
        </RadioGroup>

        {metadataMode === 'selected' && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">
                {selectedFields.length} of {ALL_SPLIT_FIELDS.length} fields selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFields(populatedFields)}
                  disabled={populatedFields.length === 0}
                >
                  Select filled-in
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedFields(ALL_SPLIT_FIELDS)}>
                  Select all
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedFields([])}>
                  Clear
                </Button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto pr-1 space-y-4">
              {SPLIT_FIELD_GROUPS.map((group) => (
                <div key={group.title}>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    {group.title}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                    {group.fields.map((field) => {
                      const isEmpty = !hasValue(application[field.key]);
                      return (
                        <Checkbox
                          key={field.key}
                          id={`split-field-${field.key}`}
                          label={isEmpty ? `${field.label} (empty)` : field.label}
                          checked={selectedFields.includes(field.key)}
                          onChange={() => toggleField(field.key)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-sm text-gray-500">
          Only metadata is copied. Domains, deployments, deployment tokens, product links, interfaces,
          contacts, notes, the threat model and the API schema all stay with{' '}
          <span className="font-medium text-gray-700">{trimmedOriginalName || application.name}</span>.
        </p>

        {validationError && <p className="text-sm text-red-600">{validationError}</p>}
      </div>
    </Modal>
  );
}
