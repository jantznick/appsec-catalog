import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table.jsx';
import useAuthStore from '../store/authStore.js';

/**
 * Deployment Environments: the strings each company's pipelines send, mapped onto
 * Orbit's five environment kinds.
 *
 * Orbit owns the taxonomy — PRODUCTION, STAGING, QA, DEVELOPMENT, plus as many OTHERs
 * as a company wants. The company owns the words. Nobody has to change their tagging
 * schema to suit us: if their pipelines deploy with `Environment: Super Important`,
 * that becomes the name of their PRODUCTION row and everything resolves.
 *
 * The four named kinds are single-slot, which is what makes "the company's production
 * environment" a lookup rather than a guess — and is why an application's primary
 * environment needs no stored flag anywhere.
 *
 * Not to be confused with `Company.serverEnvironment` ("Cloud (AWS)"), which is a
 * hosting platform. Different question, different field, deliberately labelled apart.
 */

/** Orbit's kinds, in importance order. Overridden by the server's list once loaded. */
const FALLBACK_KINDS = ['PRODUCTION', 'STAGING', 'QA', 'DEVELOPMENT', 'OTHER'];

const KIND_LABELS = {
  PRODUCTION: 'Production',
  STAGING: 'Staging',
  QA: 'QA',
  DEVELOPMENT: 'Development',
  OTHER: 'Other',
};

const KIND_HINTS = {
  PRODUCTION: 'What customers use. Its version is the one reported as the application\'s current version.',
  STAGING: 'Pre-production. Release candidates go here first.',
  QA: 'Testing and UAT.',
  DEVELOPMENT: 'Day-to-day development deploys.',
  OTHER: 'Anything else — sandbox, demo, a one-off region. Add as many as you need.',
};

const REPEATABLE_KIND = 'OTHER';

const emptyForm = { name: '', kind: 'OTHER', aliases: '', description: '', status: 'active' };

/**
 * The strings a company's pipelines send for this environment, canonical excluded.
 *
 * The canonical name is Orbit's word for the kind (production, staging, qa,
 * development) and is not something a company types -- only OTHER has a typed name.
 * So the editable list is everything EXCEPT the canonical row.
 */
function canonicalNameFor(kind) {
  return kind === REPEATABLE_KIND ? '' : String(kind || '').toLowerCase();
}

function extraNames(env) {
  return (env?.names || []).filter((n) => !n.isCanonical).map((n) => n.value);
}

export function SettingsEnvironments() {
  const { user, isAdmin } = useAuthStore();
  const isAdminUser = isAdmin();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [environments, setEnvironments] = useState([]);
  const [kinds, setKinds] = useState(FALLBACK_KINDS);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(isAdminUser ? '' : user?.companyId || '');

  const [editing, setEditing] = useState(null); // the row being edited, or null
  const [form, setForm] = useState(emptyForm);
  const [showModal, setShowModal] = useState(false);
  const [retireTarget, setRetireTarget] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const [kindData, rows] = await Promise.all([
        api.getEnvironmentKinds(),
        api.getEnvironments(companyId ? { companyId } : {}),
      ]);
      setKinds(kindData?.kinds?.length ? kindData.kinds : FALLBACK_KINDS);
      setEnvironments(rows || []);
      if (isAdminUser && companies.length === 0) {
        setCompanies(await api.getCompanies());
      }
    } catch (e) {
      toast.error(e.message || 'Failed to load environments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  /**
   * Slots only mean anything within ONE company — "one production per company" is
   * the rule. An admin looking at every company at once is looking at 18 production
   * environments that are all correct, so the slot layout is the wrong shape for
   * that view and is replaced by a flat table with a Company column.
   */
  const scopedToOneCompany = Boolean(companyId);

  const slots = useMemo(() => {
    const byKind = new Map();
    for (const kind of kinds) byKind.set(kind, []);
    for (const env of environments) {
      if (!byKind.has(env.kind)) byKind.set(env.kind, []);
      byKind.get(env.kind).push(env);
    }
    return [...byKind.entries()].map(([kind, rows]) => ({ kind, rows }));
  }, [environments, kinds]);

  /**
   * Which single-slot kinds are already taken, for a given company.
   *
   * Scoped by company deliberately. Computing it across the whole list would mean
   * one company owning a STAGING row hid the "name your staging" action from every
   * other company, and would disable the kind in the edit modal for all of them.
   */
  const takenSingleSlotsFor = useMemo(() => {
    const byCompany = new Map();
    for (const env of environments) {
      if (env.kind === REPEATABLE_KIND) continue;
      if (!byCompany.has(env.companyId)) byCompany.set(env.companyId, new Set());
      byCompany.get(env.companyId).add(env.kind);
    }
    return (id) => byCompany.get(id) || new Set();
  }, [environments]);

  const takenSingleSlots = takenSingleSlotsFor(companyId);

  const openCreate = (kind) => {
    setEditing(null);
    setForm({ ...emptyForm, kind: kind || REPEATABLE_KIND });
    setShowModal(true);
  };

  const openEdit = (env) => {
    setEditing(env);
    setForm({
      name: env.name || '',
      kind: env.kind || REPEATABLE_KIND,
      aliases: extraNames(env).join(', '),
      description: env.description || '',
      status: env.status || 'active',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (form.kind === REPEATABLE_KIND && !form.name.trim()) {
      toast.error('Give this environment a name — it is the only thing telling it apart from your other ones');
      return;
    }
    try {
      setSaving(true);
      if (editing) {
        const result = await api.updateEnvironment(editing.id, form);
        // Renaming breaks every pipeline still sending the old name. Aliases make
        // that recoverable, so offer it rather than just warning.
        if (result?.renamedFrom && result?.canKeepOldNameAsAlias) {
          const keep = result.renamedFrom;
          toast.success(
            `Renamed to "${result.name}". ${result.affectedDeployments} deployment(s) used "${keep}" — add it as an alias so existing pipelines keep resolving.`,
          );
        } else {
          toast.success('Environment updated');
        }
      } else {
        // An admin's company comes from the filter above. The Add actions only render
        // inside the per-company layout, so this should be unreachable - but the API
        // rejects a create with no company and there is nowhere in this modal to type
        // one, so fail with something that says what to do.
        if (isAdminUser && !companyId) {
          toast.error('Pick a company above before adding an environment');
          return;
        }
        const payload = { ...form };
        if (isAdminUser && companyId) payload.companyId = companyId;
        await api.createEnvironment(payload);
        toast.success('Environment added');
      }
      setShowModal(false);
      await load();
    } catch (e) {
      toast.error(e.message || 'Failed to save environment');
    } finally {
      setSaving(false);
    }
  };

  const handleRetireToggle = async (env) => {
    try {
      await api.updateEnvironment(env.id, {
        status: env.status === 'active' ? 'retired' : 'active',
      });
      toast.success(env.status === 'active' ? 'Environment retired' : 'Environment reactivated');
      await load();
    } catch (e) {
      toast.error(e.message || 'Failed to change status');
    } finally {
      setRetireTarget(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading environments…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link to="/settings" className="mb-2 inline-block text-sm text-blue-600 hover:text-blue-700">
          ← Settings
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Deployment Environments</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">
          Orbit groups every environment into five kinds and names four of them for you —
          production, staging, qa, development. List the strings <em>your</em> pipelines
          actually send and we will match deploys and Wiz tags against them, so you never
          have to change your tagging schema. A value we do not recognise is recorded as
          Unassigned rather than guessed at.
        </p>
        <p className="mt-2 max-w-3xl text-xs text-gray-500">
          This is not the same as a company&rsquo;s <strong>Server Environment</strong> (&ldquo;Cloud
          (AWS)&rdquo;), which describes where it is hosted rather than which deployment it is.
        </p>
      </div>

      {isAdminUser && (
        <Card>
          <CardContent className="py-4">
            <Select
              label="Company"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              options={[
                { value: '', label: 'All companies' },
                ...companies.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </CardContent>
        </Card>
      )}

      {!scopedToOneCompany && (
        <Card>
          <CardHeader>
            <CardTitle>All environments</CardTitle>
            <p className="mt-1 text-sm text-gray-600">
              Every company&rsquo;s environments in one list. &ldquo;One per kind&rdquo; is a rule
              within a company, so several companies each having a production environment is
              correct and expected. Pick a company above to set one up or re-organise.
            </p>
          </CardHeader>
          <CardContent>
            {environments.length === 0 ? (
              <p className="text-sm italic text-gray-500">No environments yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Names your pipelines send</TableHead>
                    <TableHead>Applications</TableHead>
                    <TableHead>Deployments</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...environments]
                    .sort(
                      (a, b) =>
                        (a.company?.name || '').localeCompare(b.company?.name || '') ||
                        kinds.indexOf(a.kind) - kinds.indexOf(b.kind) ||
                        a.name.localeCompare(b.name),
                    )
                    .map((env) => (
                      <TableRow key={env.id}>
                        <TableCell>
                          <span className="font-medium text-gray-900">
                            {env.company?.name || '—'}
                          </span>
                        </TableCell>
                        <TableCell>{KIND_LABELS[env.kind] || env.kind}</TableCell>
                        <TableCell>{env.name}</TableCell>
                        <TableCell>
                          {extraNames(env).length ? (
                            <span className="text-sm text-gray-700">
                              {extraNames(env).join(', ')}
                            </span>
                          ) : (
                            <span className="text-sm italic text-gray-400">
                              just &ldquo;{env.name}&rdquo;
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{env._count?.applications ?? '—'}</TableCell>
                        <TableCell>{env._count?.deployments ?? '—'}</TableCell>
                        <TableCell>
                          <span
                            className={
                              env.status === 'active'
                                ? 'text-sm text-gray-700'
                                : 'text-sm text-gray-400'
                            }
                          >
                            {env.status === 'active' ? 'Active' : 'Retired'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => openEdit(env)}>
                              Edit
                            </Button>
                            <Button variant="ghost" onClick={() => setRetireTarget(env)}>
                              {env.status === 'active' ? 'Retire' : 'Reactivate'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {scopedToOneCompany && slots.map(({ kind, rows }) => {
        const repeatable = kind === REPEATABLE_KIND;
        const slotTaken = !repeatable && takenSingleSlots.has(kind);
        return (
          <Card key={kind}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>{KIND_LABELS[kind] || kind}</CardTitle>
                <p className="mt-1 text-sm text-gray-600">{KIND_HINTS[kind] || ''}</p>
                {!repeatable && (
                  <p className="mt-1 text-xs text-gray-500">One per company.</p>
                )}
              </div>
              {(repeatable || !slotTaken) && (
                <Button variant="secondary" onClick={() => openCreate(kind)}>
                  {repeatable ? 'Add another' : `Name your ${KIND_LABELS[kind]?.toLowerCase() || kind}`}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="text-sm italic text-gray-500">
                  Not set up. Deploys naming this environment will arrive as Unassigned until it is.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Names your pipelines send</TableHead>
                      <TableHead>Applications</TableHead>
                      <TableHead>Deployments</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((env) => (
                      <TableRow key={env.id}>
                        <TableCell>
                          <span className="font-medium text-gray-900">{env.name}</span>
                          {env.description && (
                            <p className="text-xs text-gray-500">{env.description}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {extraNames(env).length ? (
                            <span className="text-sm text-gray-700">{extraNames(env).join(', ')}</span>
                          ) : (
                            <span className="text-sm italic text-gray-400">
                              just &ldquo;{env.name}&rdquo;
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{env._count?.applications ?? '—'}</TableCell>
                        <TableCell>{env._count?.deployments ?? '—'}</TableCell>
                        <TableCell>
                          <span
                            className={
                              env.status === 'active'
                                ? 'text-sm text-gray-700'
                                : 'text-sm text-gray-400'
                            }
                          >
                            {env.status === 'active' ? 'Active' : 'Retired'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => openEdit(env)}>
                              Edit
                            </Button>
                            <Button variant="ghost" onClick={() => setRetireTarget(env)}>
                              {env.status === 'active' ? 'Retire' : 'Reactivate'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? `Edit "${editing.name}"` : 'Add an environment'}
      >
        <div className="space-y-4">
          <Select
            label="Kind"
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}
            // Filtered rather than disabled: the shared Select does not forward a
            // `disabled` flag to its options, so a greyed-out entry would still be
            // selectable and the save would fail with a 409 instead.
            options={kinds
              .filter((k) => {
                if (k === REPEATABLE_KIND) return true;
                // Which slots are free depends on the row's OWN company, which is
                // not necessarily the one the page is filtered to - an admin can
                // edit a row from the all-companies list.
                const taken = takenSingleSlotsFor(editing ? editing.companyId : companyId);
                return !taken.has(k) || (editing && editing.kind === k);
              })
              .map((k) => ({ value: k, label: KIND_LABELS[k] || k }))}
            helperText="Orbit's bucket for this environment. Cross-company reporting counts by kind, never by name."
          />
          {form.kind === REPEATABLE_KIND ? (
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. sandbox, demo"
              helperText="What Orbit calls this one. Only you can name it — the other four kinds take their name from the kind."
            />
          ) : (
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-2">Name</span>
              <p className="text-sm text-gray-900">
                {canonicalNameFor(form.kind)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Orbit&rsquo;s word for this kind, so every company reads the same on a
                cross-company screen. What your pipelines actually send goes below — you
                do not have to change anything on your side.
              </p>
            </div>
          )}
          <Input
            label="Names your pipelines send"
            value={form.aliases}
            onChange={(e) => setForm({ ...form, aliases: e.target.value })}
            placeholder="prod, prod-us, prod-eu"
            helperText="Comma-separated, and as many as you need. A deploy or a Wiz tag carrying any of these resolves here. Anything else lands in Unassigned rather than being guessed at."
          />
          <Input
            label="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add environment'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(retireTarget)}
        onClose={() => setRetireTarget(null)}
        title={retireTarget?.status === 'active' ? 'Retire this environment?' : 'Reactivate this environment?'}
      >
        <div className="space-y-4">
          {retireTarget?.status === 'active' ? (
            <p className="text-sm text-gray-700">
              &ldquo;{retireTarget?.name}&rdquo; will stop appearing in pickers, and the applications
              in it will stop counting as running there. Its deploy history and its Wiz tag are kept
              — a retired environment still describes what ran. Nothing is deleted.
            </p>
          ) : (
            <p className="text-sm text-gray-700">
              &ldquo;{retireTarget?.name}&rdquo; will appear in pickers again and its applications
              will count as running there.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRetireTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => handleRetireToggle(retireTarget)}>
              {retireTarget?.status === 'active' ? 'Retire' : 'Reactivate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default SettingsEnvironments;
