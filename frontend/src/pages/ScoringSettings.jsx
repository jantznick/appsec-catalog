import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import useAuthStore from '../store/authStore.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';

const CATEGORY_OPTIONS = [
  { value: 'sast', label: 'SAST' },
  { value: 'dast', label: 'DAST' },
  { value: 'sca', label: 'SCA' },
  { value: 'appFirewall', label: 'Firewall' },
];

const CATEGORY_VALUES = CATEGORY_OPTIONS.map((category) => category.value);
const SEVERITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];

const emptyRow = () => ({ tool: '', weight: '1.0', categories: [] });
const emptySensitiveRule = () => ({
  id: '',
  label: '',
  classification: '',
  severity: 'Medium',
  keyTermsText: '',
  valuePatternsText: '',
  why: '',
  reviewGuidance: '',
});

function splitLines(value) {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeSensitiveRuleForUi(rule = {}) {
  return {
    id: rule.id || '',
    label: rule.label || '',
    classification: rule.classification || '',
    severity: rule.severity || 'Medium',
    keyTermsText: Array.isArray(rule.keyTerms) ? rule.keyTerms.join('\n') : '',
    valuePatternsText: Array.isArray(rule.valuePatterns) ? rule.valuePatterns.join('\n') : '',
    why: rule.why || '',
    reviewGuidance: rule.reviewGuidance || '',
  };
}

function buildSensitiveRulesPayload(rules) {
  return {
    rules: rules.map((rule) => ({
      id: rule.id.trim(),
      label: rule.label.trim(),
      classification: rule.classification.trim(),
      severity: rule.severity,
      keyTerms: splitLines(rule.keyTermsText),
      valuePatterns: splitLines(rule.valuePatternsText),
      why: rule.why.trim(),
      reviewGuidance: rule.reviewGuidance.trim(),
    })),
  };
}

function normalizeToolEntry(entry) {
  if (typeof entry === 'number') {
    return { weight: String(entry), categories: [...CATEGORY_VALUES] };
  }

  return {
    weight: String(entry?.weight ?? 1),
    categories: Array.isArray(entry?.categories) ? entry.categories : [],
  };
}

function mapConfigToRows(config) {
  const toRows = (tools = {}) =>
    Object.entries(tools)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tool, entry]) => ({ tool, ...normalizeToolEntry(entry) }));

  return {
    managed: toRows(config.managed),
    approvedUnmanaged: toRows(config.approvedUnmanaged),
    other: String(config.other ?? 0.8),
  };
}

function rowsToObject(rows) {
  return rows.reduce((acc, row) => {
    const tool = row.tool.trim();
    if (tool) {
      acc[tool] = {
        weight: Number(row.weight),
        categories: row.categories,
      };
    }
    return acc;
  }, {});
}

function buildPayload(rows) {
  return {
    managed: rowsToObject(rows.managed),
    approvedUnmanaged: rowsToObject(rows.approvedUnmanaged),
    other: Number(rows.other),
  };
}

function validateRows(rows) {
  const errors = [];
  const seen = new Set();

  if (!Number.isFinite(Number(rows.other)) || Number(rows.other) < 0 || Number(rows.other) > 1) {
    errors.push('Default weight must be between 0 and 1.');
  }

  for (const section of ['managed', 'approvedUnmanaged']) {
    for (const row of rows[section]) {
      const tool = row.tool.trim();
      const weight = Number(row.weight);

      if (!tool) {
        errors.push('Tool names cannot be blank.');
        continue;
      }
      if (!Number.isFinite(weight) || weight < 0 || weight > 1) {
        errors.push(`${tool} must have a weight between 0 and 1.`);
      }
      if (!Array.isArray(row.categories) || row.categories.length === 0) {
        errors.push(`${tool} must belong to at least one category.`);
      }
      for (const category of row.categories || []) {
        if (!CATEGORY_VALUES.includes(category)) {
          errors.push(`${tool} has an unknown category.`);
        }
      }

      const key = tool.toLowerCase();
      if (seen.has(key)) {
        errors.push(`${tool} appears more than once.`);
      }
      seen.add(key);
    }
  }

  return [...new Set(errors)];
}

function validateSensitiveRules(rules) {
  const errors = [];
  const seen = new Set();

  for (const rule of rules) {
    const id = rule.id.trim();
    const label = rule.label.trim();
    const classification = rule.classification.trim();
    const keyTerms = splitLines(rule.keyTermsText);
    const valuePatterns = splitLines(rule.valuePatternsText);

    if (!id) {
      errors.push('Rule ID cannot be blank.');
    }
    if (!label) {
      errors.push('Rule label cannot be blank.');
    }
    if (!classification) {
      errors.push('Classification cannot be blank.');
    }
    if (!SEVERITY_OPTIONS.includes(rule.severity)) {
      errors.push(`${label || id || 'A rule'} has an unknown severity.`);
    }
    if (keyTerms.length === 0 && valuePatterns.length === 0) {
      errors.push(`${label || id || 'A rule'} needs at least one key term or value pattern.`);
    }

    const duplicateKey = id.toLowerCase();
    if (duplicateKey && seen.has(duplicateKey)) {
      errors.push(`${id} appears more than once.`);
    }
    if (duplicateKey) {
      seen.add(duplicateKey);
    }
  }

  return [...new Set(errors)];
}

function ToolWeightTable({ title, rows, onChange, onAdd, onRemove }) {
  const toggleCategory = (index, category) => {
    const row = rows[index];
    const current = Array.isArray(row.categories) ? row.categories : [];
    const next = current.includes(category)
      ? current.filter((value) => value !== category)
      : [...current, category];
    onChange(index, 'categories', next);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <Button variant="secondary" size="sm" onClick={onAdd}>
          Add tool
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                Tool
              </th>
              <th className="w-36 px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                Weight
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                Categories
              </th>
              <th className="w-24 px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-surface">
            {rows.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-4 py-6 text-center text-sm text-gray-500">
                  No tools configured.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index}>
                  <td className="px-4 py-3">
                    <Input
                      aria-label={`${title} tool name`}
                      value={row.tool}
                      onChange={(event) => onChange(index, 'tool', event.target.value)}
                      placeholder="Tool name"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      aria-label={`${title} tool weight`}
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={row.weight}
                      onChange={(event) => onChange(index, 'weight', event.target.value)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {CATEGORY_OPTIONS.map((category) => {
                        const checked = row.categories?.includes(category.value) ?? false;
                        return (
                          <label
                            key={category.value}
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${
                              checked
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-gray-200 bg-surface text-gray-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                              checked={checked}
                              onChange={() => toggleCategory(index, category.value)}
                            />
                            {category.label}
                          </label>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => onRemove(index)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SensitiveRulesTable({ rules, errors, onAdd, onEdit, onRemove }) {
  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors[0]}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                Rule
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                Classification
              </th>
              <th className="w-32 px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                Severity
              </th>
              <th className="w-36 px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                Matchers
              </th>
              <th className="w-36 px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-surface">
            {rules.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-4 py-6 text-center text-sm text-gray-500">
                  No sensitive field rules configured.
                </td>
              </tr>
            ) : (
              rules.map((rule, index) => {
                const keyTermCount = splitLines(rule.keyTermsText).length;
                const patternCount = splitLines(rule.valuePatternsText).length;

                return (
                  <tr
                    key={index}
                    className="cursor-pointer hover:bg-blue-50/50"
                    onClick={() => onEdit(index)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{rule.label || 'Untitled rule'}</div>
                      <div className="mt-0.5 font-mono text-xs text-gray-500">{rule.id || 'No ID'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {rule.classification || 'Unclassified'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700">
                        {rule.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {keyTermCount} terms, {patternCount} patterns
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEdit(index);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemove(index);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Button variant="secondary" size="sm" onClick={onAdd}>
        Add rule
      </Button>
    </div>
  );
}

function SensitiveRuleModal({ rule, isOpen, onClose, onChange, onSave, saving }) {
  const draftErrors = rule ? validateSensitiveRules([rule]) : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={rule?.id ? `Edit rule: ${rule.label || rule.id}` : 'Add sensitive field rule'}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={saving} disabled={draftErrors.length > 0}>
            Save
          </Button>
        </>
      }
    >
      {rule && (
        <div className="space-y-4">
          {draftErrors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {draftErrors[0]}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Rule ID"
              value={rule.id}
              onChange={(event) => onChange('id', event.target.value)}
              placeholder="ssn"
            />
            <Input
              label="Label"
              value={rule.label}
              onChange={(event) => onChange('label', event.target.value)}
              placeholder="Social Security Number"
            />
            <Input
              label="Classification"
              value={rule.classification}
              onChange={(event) => onChange('classification', event.target.value)}
              placeholder="Personal Data"
            />
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Severity</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                value={rule.severity}
                onChange={(event) => onChange('severity', event.target.value)}
              >
                {SEVERITY_OPTIONS.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Textarea
              label="Key terms"
              value={rule.keyTermsText}
              onChange={(event) => onChange('keyTermsText', event.target.value)}
              helperText="One field-name or path term per line."
              placeholder={'ssn\nsocialSecurityNumber\ntaxId'}
              className="min-h-[150px] font-mono text-xs"
            />
            <Textarea
              label="Value patterns"
              value={rule.valuePatternsText}
              onChange={(event) => onChange('valuePatternsText', event.target.value)}
              helperText="One JavaScript regex per line, matched against examples, defaults, and enum values."
              placeholder={'(?i)^\\d{3}-\\d{2}-\\d{4}$'}
              className="min-h-[150px] font-mono text-xs"
            />
          </div>

          <Textarea
            label="Why this matters"
            value={rule.why}
            onChange={(event) => onChange('why', event.target.value)}
            placeholder="Explain the risk this field introduces."
            className="min-h-[96px]"
          />
          <Textarea
            label="Review guidance"
            value={rule.reviewGuidance}
            onChange={(event) => onChange('reviewGuidance', event.target.value)}
            placeholder="Tell reviewers what to verify when this is found."
            className="min-h-[96px]"
          />
        </div>
      )}
    </Modal>
  );
}

export function ScoringSettings() {
  const { isAdmin, loading: authLoading } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSensitiveFields, setSavingSensitiveFields] = useState(false);
  const [rows, setRows] = useState({ managed: [], approvedUnmanaged: [], other: '0.8' });
  const [sensitiveRules, setSensitiveRules] = useState([]);
  const [sensitiveRuleModal, setSensitiveRuleModal] = useState(null);

  const validationErrors = useMemo(() => validateRows(rows), [rows]);
  const sensitiveRuleErrors = useMemo(() => validateSensitiveRules(sensitiveRules), [sensitiveRules]);

  const load = async () => {
    try {
      setLoading(true);
      const [config, sensitiveFields] = await Promise.all([
        api.getToolQualityConfig(),
        api.getSensitiveFieldsConfig(),
      ]);
      setRows(mapConfigToRows(config));
      setSensitiveRules((sensitiveFields.rules || []).map(normalizeSensitiveRuleForUi));
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Failed to load scoring settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAdmin()) {
      load();
    }
  }, [authLoading, isAdmin]);

  const updateRow = (section, index, field, value) => {
    setRows((current) => ({
      ...current,
      [section]: current[section].map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    }));
  };

  const addRow = (section) => {
    setRows((current) => ({
      ...current,
      [section]: [...current[section], emptyRow()],
    }));
  };

  const removeRow = (section, index) => {
    setRows((current) => ({
      ...current,
      [section]: current[section].filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const openSensitiveRuleModal = (index) => {
    setSensitiveRuleModal({
      index,
      draft: index == null ? emptySensitiveRule() : { ...sensitiveRules[index] },
    });
  };

  const updateSensitiveRuleDraft = (field, value) => {
    setSensitiveRuleModal((current) =>
      current ? { ...current, draft: { ...current.draft, [field]: value } } : current,
    );
  };

  const persistSensitiveRules = async (candidateRules, successMessage = 'Sensitive field rules saved') => {
    const errors = validateSensitiveRules(candidateRules);
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    setSavingSensitiveFields(true);
    try {
      const saved = await api.updateSensitiveFieldsConfig(buildSensitiveRulesPayload(candidateRules));
      setSensitiveRules((saved.rules || []).map(normalizeSensitiveRuleForUi));
      toast.success(successMessage);
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Failed to save sensitive field terms');
      return false;
    } finally {
      setSavingSensitiveFields(false);
    }
  };

  const saveSensitiveRuleDraft = async () => {
    if (!sensitiveRuleModal) {
      return;
    }

    const candidateRules =
      sensitiveRuleModal.index == null
        ? [...sensitiveRules, sensitiveRuleModal.draft]
        : sensitiveRules.map((rule, ruleIndex) =>
            ruleIndex === sensitiveRuleModal.index ? sensitiveRuleModal.draft : rule,
          );
    const saved = await persistSensitiveRules(candidateRules);
    if (saved) {
      setSensitiveRuleModal(null);
    }
  };

  const removeSensitiveRuleAndSave = async (index) => {
    const candidateRules = sensitiveRules.filter((_, ruleIndex) => ruleIndex !== index);
    await persistSensitiveRules(candidateRules, 'Sensitive field rule removed');
  };

  const save = async () => {
    if (validationErrors.length > 0) {
      toast.error(validationErrors[0]);
      return;
    }

    setSaving(true);
    try {
      const saved = await api.updateToolQualityConfig(buildPayload(rows));
      setRows(mapConfigToRows(saved));
      toast.success('Scoring settings saved');
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Failed to save scoring settings');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return <LoadingPage message="Loading..." />;
  }

  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div>
      <div className="mb-8">
        <Link to="/dashboard" className="mb-2 inline-block text-sm text-blue-600 hover:text-blue-700">
          Back to Dashboard
        </Link>
        <h1 className="mb-2 text-3xl font-bold text-gray-800">Scoring settings</h1>
        <p className="max-w-2xl text-gray-600">
          Manage tool quality caps and the security categories where each tool can receive credit. Managed
          tools take precedence over approved unmanaged tools, and the default weight applies to unlisted tools.
        </p>
      </div>

      {loading ? (
        <LoadingPage message="Loading..." />
      ) : (
        <div className="space-y-8">
          <Card className="max-w-5xl">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Tool quality weights</CardTitle>
                <p className="mt-1 text-sm text-gray-600">
                  Weights range from 0 to 1. A weight of 1 allows full category credit; lower values reduce it.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={load} disabled={saving}>
                  Reset
                </Button>
                <Button variant="primary" size="sm" onClick={save} loading={saving} disabled={validationErrors.length > 0}>
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="max-w-xs">
                <Input
                  label="Default tool weight"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={rows.other}
                  onChange={(event) => setRows((current) => ({ ...current, other: event.target.value }))}
                  helperText="Used when a tool is not listed below."
                />
              </div>

              {validationErrors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {validationErrors[0]}
                </div>
              )}

              <ToolWeightTable
                title="Managed tools"
                rows={rows.managed}
                onChange={(index, field, value) => updateRow('managed', index, field, value)}
                onAdd={() => addRow('managed')}
                onRemove={(index) => removeRow('managed', index)}
              />

              <ToolWeightTable
                title="Approved unmanaged tools"
                rows={rows.approvedUnmanaged}
                onChange={(index, field, value) => updateRow('approvedUnmanaged', index, field, value)}
                onAdd={() => addRow('approvedUnmanaged')}
                onRemove={(index) => removeRow('approvedUnmanaged', index)}
              />
            </CardContent>
          </Card>

          <Card className="max-w-5xl">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>API schema sensitive field rules</CardTitle>
                <p className="mt-1 text-sm text-gray-600">
                  Rules classify fields by path terms and example/default/enum value patterns, then explain why each finding matters.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <SensitiveRulesTable
                rules={sensitiveRules}
                errors={sensitiveRuleErrors}
                onAdd={() => openSensitiveRuleModal(null)}
                onEdit={openSensitiveRuleModal}
                onRemove={removeSensitiveRuleAndSave}
              />
            </CardContent>
          </Card>

          <SensitiveRuleModal
            rule={sensitiveRuleModal?.draft || null}
            isOpen={Boolean(sensitiveRuleModal)}
            onClose={() => setSensitiveRuleModal(null)}
            onChange={updateSensitiveRuleDraft}
            onSave={saveSensitiveRuleDraft}
            saving={savingSensitiveFields}
          />
        </div>
      )}
    </div>
  );
}
