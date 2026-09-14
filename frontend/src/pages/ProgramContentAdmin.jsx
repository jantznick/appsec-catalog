import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import { api } from '../lib/api.js';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { Checkbox } from '../components/ui/Checkbox.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { toast } from '../components/ui/Toast.jsx';

const PROGRAM_TABS = [
  { key: 'ascoe', label: 'ASCOE sessions' },
  { key: 'champions', label: 'Champions packages' },
];

const ASSET_KINDS = [
  { value: 'slide_deck', label: 'Slides' },
  { value: 'recording', label: 'Recording' },
  { value: 'document', label: 'Document' },
  { value: 'article', label: 'Article' },
  { value: 'game', label: 'Game' },
  { value: 'challenge', label: 'Challenge' },
  { value: 'link', label: 'Link' },
];

/**
 * Sections offered per program — these mirror SECTION_LAYOUT on the backend.
 * An asset filed under a section the program doesn't render would still show up
 * (the API groups strays under "Other materials"), but offering only the valid
 * ones keeps that from happening by accident.
 */
const ASSET_SECTIONS = {
  ascoe: [
    { value: 'agenda', label: 'Before the session (agenda)' },
    { value: 'pre_read', label: 'Come prepared (pre-read)' },
    { value: 'materials', label: 'From the session' },
    { value: 'recording', label: 'Recording' },
  ],
  champions: [
    { value: 'pre_read', label: 'For champions to review beforehand' },
    { value: 'facilitator', label: 'Running the meeting' },
    { value: 'materials', label: 'In the meeting' },
    { value: 'activity', label: 'Games & challenges' },
    { value: 'recording', label: 'Recording' },
  ],
};

const emptyRelease = {
  slug: '',
  title: '',
  periodLabel: '',
  sessionDate: '',
  location: '',
  periodStart: '',
  theme: '',
  facilitatorNotes: '',
  summary: '',
  body: '',
  publicSummary: '',
  isPubliclyListed: false,
  status: 'draft',
  audienceScope: 'all',
  companyIds: [],
};

const emptyAsset = {
  kind: 'document',
  section: 'materials',
  title: '',
  description: '',
  externalUrl: '',
  embedUrl: '',
  displayOrder: 0,
};

function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function statusBadgeClasses(status) {
  return status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700';
}

export function ProgramContentAdmin() {
  const { isAdmin } = useAuthStore();

  const [program, setProgram] = useState('ascoe');
  const [releases, setReleases] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyRelease);
  const [assetForm, setAssetForm] = useState(emptyAsset);
  const [editingAssetId, setEditingAssetId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAsset, setSavingAsset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const selected = useMemo(
    () => releases.find((release) => release.id === selectedId) || null,
    [releases, selectedId]
  );

  const loadReleases = async (which = program) => {
    try {
      setLoading(true);
      const data = await api.getProgramReleasesAdmin(which);
      setReleases(data.releases || []);
    } catch (error) {
      toast.error(error?.message || 'Failed to load program content');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin()) return;
    loadReleases(program);
    setSelectedId(null);
    setForm({ ...emptyRelease });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program]);

  useEffect(() => {
    if (!isAdmin()) return;
    // /api/companies responds with a bare array, not { companies }.
    api
      .getCompanies()
      .then((data) => setCompanies(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Failed to load companies'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  const resetForm = () => {
    setSelectedId(null);
    setForm({ ...emptyRelease });
    setAssetForm({ ...emptyAsset });
    setEditingAssetId(null);
  };

  const editRelease = (release) => {
    setSelectedId(release.id);
    setEditingAssetId(null);
    setAssetForm({ ...emptyAsset });
    setForm({
      slug: release.slug || '',
      title: release.title || '',
      periodLabel: release.periodLabel || '',
      sessionDate: toDateInput(release.sessionDate),
      location: release.location || '',
      periodStart: toDateInput(release.periodStart),
      theme: release.theme || '',
      facilitatorNotes: release.facilitatorNotes || '',
      summary: release.summary || '',
      body: release.body || '',
      publicSummary: release.publicSummary || '',
      isPubliclyListed: Boolean(release.isPubliclyListed),
      status: release.status || 'draft',
      audienceScope: release.audienceScope || 'all',
      companyIds: (release.companies || []).map((entry) => entry.companyId),
    });
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleCompany = (companyId) => {
    setForm((current) => ({
      ...current,
      companyIds: current.companyIds.includes(companyId)
        ? current.companyIds.filter((id) => id !== companyId)
        : [...current.companyIds, companyId],
    }));
  };

  const saveRelease = async (nextStatus = form.status) => {
    try {
      setSaving(true);
      const payload = { ...form, status: nextStatus };
      const saved = selectedId
        ? await api.updateProgramRelease(program, selectedId, payload)
        : await api.createProgramRelease(program, payload);

      setReleases((current) => {
        const exists = current.some((release) => release.id === saved.id);
        return exists
          ? current.map((release) => (release.id === saved.id ? saved : release))
          : [saved, ...current];
      });
      setSelectedId(saved.id);
      setForm((current) => ({ ...current, status: saved.status, slug: saved.slug }));
      toast.success(selectedId ? 'Saved' : 'Created');
    } catch (error) {
      toast.error(error?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const deleteRelease = async () => {
    const target = confirmDelete;
    if (target?.type !== 'release') return;
    try {
      await api.deleteProgramRelease(program, target.id);
      setReleases((current) => current.filter((release) => release.id !== target.id));
      resetForm();
      toast.success('Deleted');
    } catch (error) {
      toast.error(error?.message || 'Failed to delete');
    } finally {
      setConfirmDelete(null);
    }
  };

  const editAsset = (asset) => {
    setEditingAssetId(asset.id);
    setAssetForm({
      kind: asset.kind || 'document',
      section: asset.section || 'materials',
      title: asset.title || '',
      description: asset.description || '',
      externalUrl: asset.externalUrl || '',
      embedUrl: asset.embedUrl || '',
      displayOrder: asset.displayOrder ?? 0,
    });
  };

  const saveAsset = async () => {
    if (!selectedId) return;
    try {
      setSavingAsset(true);
      if (editingAssetId) {
        await api.updateContentAsset(editingAssetId, assetForm);
      } else {
        await api.createContentAsset({ ...assetForm, program, releaseId: selectedId });
      }
      // Re-read the release so the section grouping comes from the backend
      // rather than being reassembled here.
      const refreshed = await api.getProgramReleaseAdmin(program, selectedId);
      setReleases((current) =>
        current.map((release) => (release.id === refreshed.id ? refreshed : release))
      );
      setAssetForm({ ...emptyAsset });
      setEditingAssetId(null);
      toast.success(editingAssetId ? 'Material updated' : 'Material added');
    } catch (error) {
      toast.error(error?.message || 'Failed to save material');
    } finally {
      setSavingAsset(false);
    }
  };

  const deleteAsset = async () => {
    const target = confirmDelete;
    if (target?.type !== 'asset') return;
    try {
      await api.deleteContentAsset(target.id);
      const refreshed = await api.getProgramReleaseAdmin(program, selectedId);
      setReleases((current) =>
        current.map((release) => (release.id === refreshed.id ? refreshed : release))
      );
      if (editingAssetId === target.id) {
        setEditingAssetId(null);
        setAssetForm({ ...emptyAsset });
      }
      toast.success('Material deleted');
    } catch (error) {
      toast.error(error?.message || 'Failed to delete material');
    } finally {
      setConfirmDelete(null);
    }
  };

  const allAssets = (selected?.sections || []).flatMap((section) => section.assets);
  const isAscoe = program === 'ascoe';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Program Content</h1>
          <p className="text-sm text-gray-600 mt-1">
            Publish ASCOE session materials and monthly Security Champions packages.
          </p>
        </div>
        <Button variant="outline" onClick={resetForm}>
          New {isAscoe ? 'session' : 'package'}
        </Button>
      </div>

      <div className="flex gap-2">
        {PROGRAM_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setProgram(tab.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              program === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle>{isAscoe ? 'Sessions' : 'Packages'}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : releases.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing created yet.</p>
            ) : (
              <ul className="space-y-2">
                {releases.map((release) => (
                  <li key={release.id}>
                    <button
                      type="button"
                      onClick={() => editRelease(release)}
                      className={`w-full rounded-md border p-3 text-left transition-colors ${
                        selectedId === release.id
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-gray-500">
                          {release.periodLabel}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClasses(
                            release.status
                          )}`}
                        >
                          {release.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-gray-900 break-words">
                        {release.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {release.assetCount} item{release.assetCount === 1 ? '' : 's'}
                        {release.audienceScope === 'all'
                          ? ' · all members'
                          : ` · ${release.companies?.length || 0} compan${
                              (release.companies?.length || 0) === 1 ? 'y' : 'ies'
                            }`}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{selectedId ? 'Edit' : 'New'} {isAscoe ? 'session' : 'package'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Title"
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder={isAscoe ? 'Q3 2026 — Threat Modeling at Scale' : 'Phishing Awareness'}
                />
                <Input
                  label="Period label"
                  value={form.periodLabel}
                  onChange={(e) => updateField('periodLabel', e.target.value)}
                  placeholder={isAscoe ? 'Q3 2026' : 'September 2026'}
                />
                <Input
                  label="URL slug"
                  value={form.slug}
                  onChange={(e) => updateField('slug', e.target.value)}
                  placeholder={isAscoe ? 'q3-2026' : '2026-09'}
                  helperText="Derived from the title if left blank."
                />
                {isAscoe ? (
                  <>
                    <Input
                      type="date"
                      label="Session date"
                      value={form.sessionDate}
                      onChange={(e) => updateField('sessionDate', e.target.value)}
                      helperText="Drives the upcoming-vs-past split."
                    />
                    <Input
                      label="Location"
                      value={form.location}
                      onChange={(e) => updateField('location', e.target.value)}
                      placeholder="Virtual (Teams)"
                    />
                  </>
                ) : (
                  <>
                    <Input
                      type="date"
                      label="Period start"
                      value={form.periodStart}
                      onChange={(e) => updateField('periodStart', e.target.value)}
                      helperText="First of the month this package covers."
                    />
                    <Input
                      label="Theme"
                      value={form.theme}
                      onChange={(e) => updateField('theme', e.target.value)}
                      placeholder="Phishing & Social Engineering"
                    />
                  </>
                )}
              </div>

              <Textarea
                label="Summary"
                value={form.summary}
                onChange={(e) => updateField('summary', e.target.value)}
                rows={3}
                helperText="Shown to members. Plain text — blank lines start a new paragraph."
              />
              <Textarea
                label={isAscoe ? 'Agenda / recap' : 'What is in this package'}
                value={form.body}
                onChange={(e) => updateField('body', e.target.value)}
                rows={5}
              />
              {!isAscoe && (
                <Textarea
                  label="Facilitator notes"
                  value={form.facilitatorNotes}
                  onChange={(e) => updateField('facilitatorNotes', e.target.value)}
                  rows={4}
                  helperText="How to run the meeting. Visible to everyone who can see the package."
                />
              )}

              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Audience</h3>
                <Select
                  label="Who can see this"
                  value={form.audienceScope}
                  onChange={(e) => updateField('audienceScope', e.target.value)}
                  options={[
                    { value: 'all', label: 'All member companies (including future ones)' },
                    { value: 'companies', label: 'Only the companies I pick' },
                  ]}
                />
                {form.audienceScope === 'companies' ? (
                  <div className="max-h-48 overflow-y-auto rounded border border-gray-200 p-3 space-y-2">
                    {companies.length === 0 ? (
                      <p className="text-sm text-gray-500">No companies available.</p>
                    ) : (
                      companies.map((company) => (
                        <Checkbox
                          key={company.id}
                          label={company.name}
                          checked={form.companyIds.includes(company.id)}
                          onChange={() => toggleCompany(company.id)}
                        />
                      ))
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    A company onboarded later picks up this and the rest of the back catalog
                    automatically.
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Public catalog</h3>
                <Checkbox
                  label="List this on the public program content page"
                  checked={form.isPubliclyListed}
                  onChange={(e) => updateField('isPubliclyListed', e.target.checked)}
                />
                <Textarea
                  label="Public blurb"
                  value={form.publicSummary}
                  onChange={(e) => updateField('publicSummary', e.target.value)}
                  rows={3}
                  helperText="Marketing copy for visitors who aren't logged in. Materials always stay gated; no company names are ever shown publicly."
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => saveRelease(form.status)} loading={saving}>
                  Save {form.status === 'published' ? 'changes' : 'draft'}
                </Button>
                {form.status === 'published' ? (
                  <Button variant="outline" onClick={() => saveRelease('draft')} loading={saving}>
                    Unpublish
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => saveRelease('published')} loading={saving}>
                    Publish
                  </Button>
                )}
                {selectedId && (
                  <Button
                    variant="danger"
                    onClick={() => setConfirmDelete({ type: 'release', id: selectedId })}
                  >
                    Delete
                  </Button>
                )}
              </div>
              {form.status === 'published' && (
                <p className="text-xs text-gray-500">
                  Unpublishing hides this from members and the public catalog but keeps everything,
                  including the date it first went out. It&apos;s the reversible way to retire content.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Materials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedId ? (
                <p className="text-sm text-gray-500">
                  Save the {isAscoe ? 'session' : 'package'} first, then attach materials to it.
                </p>
              ) : (
                <>
                  {allAssets.length > 0 && (
                    <ul className="space-y-2">
                      {allAssets.map((asset) => (
                        <li
                          key={asset.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 break-words">
                              {asset.title}
                            </p>
                            <p className="text-xs text-gray-500">
                              {asset.kind} · {asset.section}
                              {asset.embedUrl ? ' · embedded' : ''}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => editAsset(asset)}>
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setConfirmDelete({ type: 'asset', id: asset.id })}
                            >
                              Remove
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {editingAssetId ? 'Edit material' : 'Add material'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Title"
                        value={assetForm.title}
                        onChange={(e) => setAssetForm({ ...assetForm, title: e.target.value })}
                      />
                      <Input
                        type="number"
                        label="Order"
                        value={assetForm.displayOrder}
                        onChange={(e) =>
                          setAssetForm({ ...assetForm, displayOrder: e.target.value })
                        }
                        helperText="Sorts within its section."
                      />
                      <Select
                        label="Type"
                        value={assetForm.kind}
                        onChange={(e) => setAssetForm({ ...assetForm, kind: e.target.value })}
                        options={ASSET_KINDS}
                      />
                      <Select
                        label="Section"
                        value={assetForm.section}
                        onChange={(e) => setAssetForm({ ...assetForm, section: e.target.value })}
                        options={ASSET_SECTIONS[program]}
                      />
                    </div>
                    <Textarea
                      label="Description"
                      value={assetForm.description}
                      onChange={(e) =>
                        setAssetForm({ ...assetForm, description: e.target.value })
                      }
                      rows={2}
                    />
                    <Input
                      label="Link (SharePoint, OneDrive, article URL)"
                      value={assetForm.externalUrl}
                      onChange={(e) =>
                        setAssetForm({ ...assetForm, externalUrl: e.target.value })
                      }
                      placeholder="https://..."
                      helperText="Where members go to get the material at its source."
                    />
                    <Input
                      label="Embed link (recordings only)"
                      value={assetForm.embedUrl}
                      onChange={(e) => setAssetForm({ ...assetForm, embedUrl: e.target.value })}
                      placeholder="https://....sharepoint.com/.../Embed.aspx?UniqueId=..."
                      helperText="Paste the URL from SharePoint's Embed option, not the Share link — a share link will not play inline."
                    />
                    <div className="flex gap-3">
                      <Button onClick={saveAsset} loading={savingAsset}>
                        {editingAssetId ? 'Save material' : 'Add material'}
                      </Button>
                      {editingAssetId && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingAssetId(null);
                            setAssetForm({ ...emptyAsset });
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete?.type === 'asset' ? 'Remove this material?' : 'Delete this release?'}
      >
        <div className="space-y-4">
          {confirmDelete?.type === 'asset' ? (
            <p className="text-sm text-gray-700">
              This removes the material from the {isAscoe ? 'session' : 'package'} permanently.
            </p>
          ) : (
            <p className="text-sm text-gray-700">
              This permanently deletes the {isAscoe ? 'session' : 'package'}, every material
              attached to it, and the record of who downloaded them. To retire content while
              keeping all of that, unpublish it instead.
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete?.type === 'asset' ? deleteAsset : deleteRelease}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
