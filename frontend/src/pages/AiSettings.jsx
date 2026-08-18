import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import useAuthStore from '../store/authStore.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Alert } from '../components/ui/Alert.jsx';

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
];

const TABS = [
  { key: 'config', label: 'Configuration' },
  { key: 'pricing', label: 'Model pricing' },
  { key: 'access', label: 'Company access' },
  { key: 'usage', label: 'Usage & cost' },
];

const fmtUsd = (n) =>
  n === null || n === undefined ? '—' : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
const fmtNum = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString());
const fmtDate = (d) => (d ? new Date(d).toLocaleString() : '—');

// ---------------------------------------------------------------------------

function ConfigTab() {
  const [state, setState] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAiConfig();
      setState(data.config);
      setConfigured(data.configured);
      setFeatures(data.features || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load AI config');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const data = await api.updateAiConfig({
        globalEnabled: state.globalEnabled,
        defaultProvider: state.defaultProvider,
        defaultModel: state.defaultModel,
        defaultMaxOutputTokens:
          state.defaultMaxOutputTokens === '' ? null : state.defaultMaxOutputTokens,
        defaultMonthlyCostLimitUsd:
          state.defaultMonthlyCostLimitUsd === '' ? null : state.defaultMonthlyCostLimitUsd,
      });
      setState(data.config);
      setConfigured(data.configured);
      toast.success('AI configuration saved');
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !state) return <LoadingPage />;

  return (
    <div className="space-y-6">
      {!configured && (
        <Alert variant="warning">
          <span className="font-semibold">No API key configured.</span> The server has no{' '}
          <code>ANTHROPIC_API_KEY</code> set, so AI calls will fail closed. Set it in the backend
          environment and restart to enable AI features.
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Global AI switch</CardTitle>
          <p className="mt-1 text-sm text-gray-600">
            Master control for all AI features across every company. When off, no AI calls are made.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={state.globalEnabled}
              onChange={(e) => setState((s) => ({ ...s, globalEnabled: e.target.checked }))}
            />
            <span className="text-sm font-medium text-gray-800">AI features enabled globally</span>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Default provider</label>
              <Select
                options={PROVIDERS}
                value={state.defaultProvider}
                onChange={(e) => setState((s) => ({ ...s, defaultProvider: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Default model</label>
              <Input
                value={state.defaultModel}
                onChange={(e) => setState((s) => ({ ...s, defaultModel: e.target.value }))}
              />
              <p className="mt-1 text-xs text-gray-500">
                A model id you have access to (e.g. <code>claude-sonnet-4-5</code>, <code>gpt-4o</code>).
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Max output tokens</label>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="Env default"
                value={state.defaultMaxOutputTokens ?? ''}
                onChange={(e) => setState((s) => ({ ...s, defaultMaxOutputTokens: e.target.value }))}
              />
              <p className="mt-1 text-xs text-gray-500">
                Per-call ceiling. Blank falls back to <code>AI_MAX_OUTPUT_TOKENS</code>.
              </p>
            </div>
          </div>

          <div className="sm:w-1/2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Default monthly cost limit per company (USD)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="No limit"
              value={state.defaultMonthlyCostLimitUsd ?? ''}
              onChange={(e) =>
                setState((s) => ({ ...s, defaultMonthlyCostLimitUsd: e.target.value }))
              }
            />
            <p className="mt-1 text-xs text-gray-500">
              Applied when a company has no explicit limit. Leave blank for no cap.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save configuration'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Available AI features</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {features.map((f) => (
              <li key={f.key} className="px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">{f.label}</p>
                <p className="text-sm text-gray-600">{f.description}</p>
                <code className="text-xs text-gray-400">{f.key}</code>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

const emptyPrice = () => ({
  provider: 'anthropic',
  model: '',
  inputPricePerMTok: '',
  outputPricePerMTok: '',
  cacheReadPricePerMTok: '',
  cacheWritePricePerMTok: '',
  currency: 'USD',
});

function PricingTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyPrice());
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.getAiPricing(false));
    } catch (err) {
      toast.error(err.message || 'Failed to load pricing');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const active = useMemo(() => rows.filter((r) => r.active && !r.effectiveTo), [rows]);
  const history = useMemo(() => rows.filter((r) => !(r.active && !r.effectiveTo)), [rows]);

  const submit = async () => {
    if (!form.model.trim()) return toast.error('Model is required');
    if (form.inputPricePerMTok === '' || form.outputPricePerMTok === '')
      return toast.error('Input and output prices are required');
    setSaving(true);
    try {
      await api.setAiPricing(form);
      toast.success(`Pricing set for ${form.model}`);
      setForm(emptyPrice());
      await load();
    } catch (err) {
      toast.error(err.message || 'Failed to save pricing');
    } finally {
      setSaving(false);
    }
  };

  const editExisting = (r) =>
    setForm({
      provider: r.provider,
      model: r.model,
      inputPricePerMTok: r.inputPricePerMTok ?? '',
      outputPricePerMTok: r.outputPricePerMTok ?? '',
      cacheReadPricePerMTok: r.cacheReadPricePerMTok ?? '',
      cacheWritePricePerMTok: r.cacheWritePricePerMTok ?? '',
      currency: r.currency || 'USD',
    });

  if (loading) return <LoadingPage />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Set model price</CardTitle>
          <p className="mt-1 text-sm text-gray-600">
            Prices are per 1,000,000 tokens. Saving creates a new effective-dated price; past
            requests keep the price they were charged at, so history stays accurate.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Provider">
              <Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
            </Field>
            <Field label="Model">
              <Input placeholder="claude-sonnet-4-5" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </Field>
            <Field label="Currency">
              <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </Field>
            <Field label="Input $/M tokens">
              <Input type="number" step="0.0001" min="0" value={form.inputPricePerMTok} onChange={(e) => setForm({ ...form, inputPricePerMTok: e.target.value })} />
            </Field>
            <Field label="Output $/M tokens">
              <Input type="number" step="0.0001" min="0" value={form.outputPricePerMTok} onChange={(e) => setForm({ ...form, outputPricePerMTok: e.target.value })} />
            </Field>
            <Field label="Cache read $/M (optional)">
              <Input type="number" step="0.0001" min="0" value={form.cacheReadPricePerMTok} onChange={(e) => setForm({ ...form, cacheReadPricePerMTok: e.target.value })} />
            </Field>
            <Field label="Cache write $/M (optional)">
              <Input type="number" step="0.0001" min="0" value={form.cacheWritePricePerMTok} onChange={(e) => setForm({ ...form, cacheWritePricePerMTok: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setForm(emptyPrice())}>Clear</Button>
            <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save price'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Active prices</CardTitle></CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-sm text-gray-500">No prices configured yet. Add one above.</p>
          ) : (
            <PriceTable rows={active} onEdit={editExisting} />
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <button className="text-left" onClick={() => setShowHistory((v) => !v)}>
              <CardTitle>Price history ({history.length}) {showHistory ? '▾' : '▸'}</CardTitle>
            </button>
          </CardHeader>
          {showHistory && <CardContent><PriceTable rows={history} /></CardContent>}
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function PriceTable({ rows, onEdit }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
            <th className="px-3 py-2">Provider</th>
            <th className="px-3 py-2">Model</th>
            <th className="px-3 py-2 text-right">Input $/M</th>
            <th className="px-3 py-2 text-right">Output $/M</th>
            <th className="px-3 py-2 text-right">Cache R/W $/M</th>
            <th className="px-3 py-2">Effective</th>
            {onEdit && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-gray-100">
              <td className="px-3 py-2">{r.provider}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.model}</td>
              <td className="px-3 py-2 text-right">{fmtUsd(r.inputPricePerMTok)}</td>
              <td className="px-3 py-2 text-right">{fmtUsd(r.outputPricePerMTok)}</td>
              <td className="px-3 py-2 text-right">
                {r.cacheReadPricePerMTok == null ? '—' : fmtUsd(r.cacheReadPricePerMTok)} /{' '}
                {r.cacheWritePricePerMTok == null ? '—' : fmtUsd(r.cacheWritePricePerMTok)}
              </td>
              <td className="px-3 py-2 text-xs text-gray-500">
                {fmtDate(r.effectiveFrom)}
                {r.effectiveTo ? ` → ${fmtDate(r.effectiveTo)}` : ' (current)'}
              </td>
              {onEdit && (
                <td className="px-3 py-2">
                  <Button variant="secondary" size="sm" onClick={() => onEdit(r)}>Update</Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------

function AccessTab() {
  const [data, setData] = useState({ rules: [], companies: [], globalDefault: null, providerKeys: {} });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.getAiAccess());
    } catch (err) {
      toast.error(err.message || 'Failed to load access rules');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Map companyId -> its company-wide rule (userId & feature null).
  const ruleByCompany = useMemo(() => {
    const m = {};
    for (const r of data.rules) if (!r.userId && !r.feature) m[r.companyId] = r;
    return m;
  }, [data.rules]);

  const save = async (companyId, patch) => {
    setSavingId(companyId);
    try {
      await api.setAiCompanyAccess(companyId, patch);
      await load();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <LoadingPage />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company AI access</CardTitle>
        <p className="mt-1 text-sm text-gray-600">
          AI is off for every company by default. Enable it per company, choose the provider/model
          (or leave blank to inherit the global default), and optionally set a monthly spend cap.
          (Per-user controls arrive with RBAC.)
        </p>
        {data.globalDefault && (
          <p className="mt-2 text-xs text-gray-500">
            Global default: <span className="font-medium">{data.globalDefault.provider}</span> /{' '}
            <code>{data.globalDefault.model}</code>. Provider keys present —{' '}
            {['anthropic', 'openai'].map((p) => (
              <span key={p} className={data.providerKeys?.[p] ? 'text-green-700' : 'text-gray-400'}>
                {p}: {data.providerKeys?.[p] ? 'yes' : 'no'}{p === 'anthropic' ? ', ' : ''}
              </span>
            ))}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">AI enabled</th>
                <th className="px-3 py-2">Provider / model</th>
                <th className="px-3 py-2">Monthly cost cap (USD)</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.companies.map((c) => (
                <AccessRow
                  key={c.id}
                  company={c}
                  rule={ruleByCompany[c.id]}
                  globalDefault={data.globalDefault}
                  saving={savingId === c.id}
                  onSave={save}
                />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

const PROVIDER_OPTIONS = [
  { value: '', label: 'Global default' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
];

function AccessRow({ company, rule, globalDefault, saving, onSave }) {
  const [limit, setLimit] = useState(rule?.monthlyCostLimitUsd ?? '');
  const [provider, setProvider] = useState(rule?.provider ?? '');
  const [model, setModel] = useState(rule?.model ?? '');
  useEffect(() => {
    setLimit(rule?.monthlyCostLimitUsd ?? '');
    setProvider(rule?.provider ?? '');
    setModel(rule?.model ?? '');
  }, [rule]);
  const enabled = rule?.enabled ?? false;

  const modelPlaceholder = provider
    ? provider === 'openai' ? 'e.g. gpt-4o' : 'e.g. claude-sonnet-4-5'
    : globalDefault ? `${globalDefault.model} (inherited)` : 'Global default';

  const saveProviderModel = () => {
    // Pair guard mirrors the backend: both or neither.
    if ((provider && !model.trim()) || (!provider && model.trim())) {
      toast.error('Set provider and model together, or clear both to inherit the global default');
      return;
    }
    onSave(company.id, {
      provider: provider || null,
      model: provider ? model.trim() : null,
    });
  };

  return (
    <tr className="border-b border-gray-100 align-top">
      <td className="px-3 py-2 font-medium text-gray-900">{company.name}</td>
      <td className="px-3 py-2">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={enabled}
            disabled={saving}
            onChange={(e) => onSave(company.id, { enabled: e.target.checked })}
          />
          <span className={enabled ? 'text-green-700' : 'text-gray-400'}>{enabled ? 'On' : 'Off'}</span>
        </label>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <Select
            options={PROVIDER_OPTIONS}
            value={provider}
            onChange={(e) => { setProvider(e.target.value); if (!e.target.value) setModel(''); }}
            className="w-40"
          />
          <Input
            placeholder={modelPlaceholder}
            value={model}
            disabled={!provider}
            onChange={(e) => setModel(e.target.value)}
            className="w-40"
          />
          <Button variant="secondary" size="sm" disabled={saving} onClick={saveProviderModel}>
            Save provider
          </Button>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="No cap"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="w-32"
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={saving}
            onClick={() => onSave(company.id, { monthlyCostLimitUsd: limit === '' ? null : limit })}
          >
            Save cap
          </Button>
        </div>
      </td>
      <td className="px-3 py-2" />
    </tr>
  );
}

// ---------------------------------------------------------------------------

function UsageTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.getAiUsage({ limit: 50 }));
    } catch (err) {
      toast.error(err.message || 'Failed to load usage');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading || !data) return <LoadingPage />;
  const { summary, recent } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total cost" value={fmtUsd(summary.totals.totalCost)} />
        <Stat label="Requests" value={fmtNum(summary.totals.requests)} />
        <Stat label="Input tokens" value={fmtNum(summary.totals.inputTokens)} />
        <Stat label="Output tokens" value={fmtNum(summary.totals.outputTokens)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BreakdownCard title="By company" rows={summary.byCompany} labelKey="companyName" />
        <BreakdownCard title="By feature" rows={summary.byFeature} labelKey="key" />
      </div>

      <Card>
        <CardHeader><CardTitle>Recent requests</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Application</th>
                  <th className="px-3 py-2">Feature</th>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">In/Out</th>
                  <th className="px-3 py-2 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-4 text-center text-gray-500">No AI requests yet.</td></tr>
                )}
                {recent.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(r.createdAt)}</td>
                    <td className="px-3 py-2">{r.companyName || '—'}</td>
                    <td className="px-3 py-2">{r.applicationName || '—'}</td>
                    <td className="px-3 py-2 text-xs">{r.feature}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.model}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2 text-right text-xs">{fmtNum(r.inputTokens)}/{fmtNum(r.outputTokens)}</td>
                    <td className="px-3 py-2 text-right">{fmtUsd(r.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-surface p-4 shadow-lg shadow-black/30">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function BreakdownCard({ title, rows, labelKey }) {
  if (!rows || rows.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-gray-500">No data.</p></CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <table className="min-w-full text-sm">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-100 last:border-0">
                <td className="px-2 py-2">{r[labelKey] || '—'}</td>
                <td className="px-2 py-2 text-right text-xs text-gray-500">{fmtNum(r.requests)} req</td>
                <td className="px-2 py-2 text-right font-medium">{fmtUsd(r.totalCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }) {
  const cls = {
    success: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
    blocked: 'bg-yellow-100 text-yellow-700',
  }[status] || 'bg-gray-100 text-gray-600';
  return <span className={`rounded px-2 py-0.5 text-xs ${cls}`}>{status}</span>;
}

// ---------------------------------------------------------------------------

export function AiSettings() {
  const { isAdmin, loading: authLoading } = useAuthStore();
  const [tab, setTab] = useState('config');

  if (authLoading) return <LoadingPage />;
  if (!isAdmin()) return <Navigate to="/dashboard" replace />;

  return (
    <div>
      <div className="mb-8">
        <Link to="/settings" className="mb-2 inline-block text-sm text-blue-600 hover:text-blue-700">
          Back to Settings
        </Link>
        <h1 className="mb-2 text-3xl font-bold text-gray-800">AI settings</h1>
        <p className="max-w-2xl text-gray-600">
          Control which companies can use AI, manage model pricing, and monitor token usage and cost.
        </p>
      </div>

      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-b-2 border-blue-600 text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'config' && <ConfigTab />}
      {tab === 'pricing' && <PricingTab />}
      {tab === 'access' && <AccessTab />}
      {tab === 'usage' && <UsageTab />}
    </div>
  );
}
