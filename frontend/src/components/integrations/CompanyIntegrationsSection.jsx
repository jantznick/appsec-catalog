import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';
import useAuthStore from '../../store/authStore.js';
import { integrationProviderLabel } from '../../lib/integrationLabels.js';
import { AddIntegrationModal } from './AddIntegrationModal.jsx';
import { IntegrationTagPickerModal } from './IntegrationTagPickerModal.jsx';

/** Providers that support a non-secret link in CompanyToolLink.filter (Tenable tag, Wiz folder). */
const TOOL_LINK_PROVIDERS = new Set(['TENABLE_IO', 'WIZ']);

/**
 * @param {{ companyId: string, company: object, onRefresh: () => Promise<void> }} props
 */
export function CompanyIntegrationsSection({ companyId, company, onRefresh }) {
  const { isAdmin, user } = useAuthStore();
  const isMemberOfCompany = user?.companyId === companyId;
  const isAdminUser = isAdmin();
  /** Same as company page access: admin or member of this company */
  const canViewThisCompany = isAdminUser || isMemberOfCompany;
  const canManageCompanyCredential = isAdminUser || isMemberOfCompany;

  const [providerOptions, setProviderOptions] = useState([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalProviderPreset, setAddModalProviderPreset] = useState(undefined);

  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagModalProvider, setTagModalProvider] = useState(null);
  const [tags, setTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [selectedTagUuid, setSelectedTagUuid] = useState('');
  const [savingLink, setSavingLink] = useState(false);
  const [removeCompanyKeysProvider, setRemoveCompanyKeysProvider] = useState(null);
  const [removingCompanyKeys, setRemovingCompanyKeys] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getIntegrationProviders();
        const list = data.providers || [];
        if (!cancelled) {
          setProviderOptions(
            list.map((p) => ({
              value: p,
              label: integrationProviderLabel(p),
            })),
          );
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = company?.integrationSummary || {};
  const links = company?.companyToolLinks || [];

  /**
   * Rows under “This company”: per-company keys, existing tag/folder links, **or** (for admins)
   * catalog-wide-only + linkable tool (Tenable/Wiz) so the Tag/Folder link UI is reachable when
   * there are no company-specific API keys.
   */
  const companyScopedProviders = useMemo(() => {
    const list = Object.keys(summary);
    return list.filter((p) => {
      const co = summary[p]?.company;
      const ent = summary[p]?.enterprise;
      const hasLink = links.some((l) => l.provider === p);
      if (co?.configured || hasLink) return true;
      if (TOOL_LINK_PROVIDERS.has(p) && ent?.configured && canViewThisCompany) return true;
      return false;
    });
  }, [summary, links, canViewThisCompany]);

  /** Catalog-wide (enterprise) credentials exist - everyone on this page should see this. */
  const catalogWideProviders = useMemo(() => {
    return Object.keys(summary).filter((p) => summary[p]?.enterprise?.configured);
  }, [summary]);

  const canUseTagPicker = (provider) => {
    const co = summary[provider]?.company;
    const ent = summary[provider]?.enterprise;
    return (
      (co?.configured && canManageCompanyCredential) || (ent?.configured && canViewThisCompany)
    );
  };

  const openAddModal = (presetProvider) => {
    setAddModalProviderPreset(presetProvider);
    setAddModalOpen(true);
  };

  const confirmRemoveCompanyKeys = async () => {
    if (!removeCompanyKeysProvider) return;
    setRemovingCompanyKeys(true);
    try {
      await api.deleteIntegrationCredentials(removeCompanyKeysProvider, {
        scope: 'COMPANY',
        companyId,
      });
      toast.success('Removed');
      setRemoveCompanyKeysProvider(null);
      await onRefresh();
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setRemovingCompanyKeys(false);
    }
  };

  const openTagModal = async (provider) => {
    if (!canUseTagPicker(provider)) return;
    setTagModalProvider(provider);
    setTagModalOpen(true);
    setSelectedTagUuid('');
    setLoadingTags(true);
    const filter = links.find((l) => l.provider === provider)?.filter;
    try {
      const data = await api.getCompanyIntegrationTags(companyId, provider);
      setTags(Array.isArray(data.tags) ? data.tags : []);
      if (provider === 'WIZ') {
        if (filter?.folderId) {
          setSelectedTagUuid(filter.folderId);
        }
      } else if (filter?.tagUuid) {
        setSelectedTagUuid(filter.tagUuid);
      }
    } catch (e) {
      toast.error(e.message || 'Failed to load tags');
      setTagModalOpen(false);
    } finally {
      setLoadingTags(false);
    }
  };

  const saveTagLink = async () => {
    if (!tagModalProvider || !selectedTagUuid) {
      toast.error(tagModalProvider === 'WIZ' ? 'Select a folder' : 'Select a tag');
      return;
    }
    const tag = tags.find((t) => t.uuid === selectedTagUuid);
    setSavingLink(true);
    try {
      if (tagModalProvider === 'WIZ') {
        await api.putCompanyIntegrationLink(companyId, tagModalProvider, {
          folderId: selectedTagUuid,
          folderName: tag?.value || null,
        });
      } else {
        await api.putCompanyIntegrationLink(companyId, tagModalProvider, {
          tagUuid: selectedTagUuid,
          tagName: tag?.display_label || tag?.value || null,
          categoryUuid: tag?.category_uuid || null,
        });
      }
      toast.success('Link saved');
      setTagModalOpen(false);
      await onRefresh();
    } catch (e) {
      toast.error(e.message || 'Failed to save link');
    } finally {
      setSavingLink(false);
    }
  };

  const showGlobalEmpty =
    catalogWideProviders.length === 0 && companyScopedProviders.length === 0;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle>Integrations</CardTitle>
              {canManageCompanyCredential && (
                <Button variant="primary" size="sm" onClick={() => openAddModal(undefined)}>
                  Add integration…
                </Button>
              )}
            </div>
            {canManageCompanyCredential && (
              <p className="text-xs text-gray-500 max-w-2xl">
                <span className="font-medium text-gray-700">Company-only:</span> keys you add here are stored
                for <strong>this company only</strong>. When present, the app uses them for this
                company&apos;s API calls to the tool first; catalog-wide keys stay in place for other
                companies.
                {isAdminUser && (
                  <>
                    {' '}
                    Admins can add keys here when helping a team use its own tenant. Catalog-wide keys for
                    all companies are managed in{' '}
                    <Link
                      to="/settings/integrations"
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Integration settings
                    </Link>
                    .
                  </>
                )}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {showGlobalEmpty ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 text-center">
              <p className="text-sm text-gray-600">No integrations configured yet.</p>
              <p className="text-sm text-gray-500 mt-2">
                When an administrator adds catalog-wide connections, they will appear here. You can also add
                company-only credentials using &quot;Add integration&quot; (members and admins).
              </p>
            </div>
          ) : null}

          {/* 2 - Catalog-wide (enterprise): visible to all viewers of this page */}
          {!showGlobalEmpty && catalogWideProviders.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Catalog-wide (shared)
              </h3>
              <ul className="space-y-3">
                {catalogWideProviders.map((provider) => {
                  const ent = summary[provider]?.enterprise;
                  const label = integrationProviderLabel(provider);
                  return (
                    <li
                      key={`ent-${provider}`}
                      className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900">{label}</span>
                        <span className="text-xs font-medium text-blue-900 bg-blue-100 px-2 py-0.5 rounded">
                          Catalog-wide
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-2">
                        <span className="text-green-800 font-medium">Active</span>
                        {' - '}
                        {isAdminUser ? (
                          <>
                            shared API access for every company
                            {ent?.accessKeyHint ? (
                              <span className="ml-2 font-mono text-xs text-gray-600">{ent.accessKeyHint}</span>
                            ) : null}
                            {ent?.baseUrl ? (
                              <span className="ml-2 text-xs text-gray-500">({ent.baseUrl})</span>
                            ) : null}
                          </>
                        ) : (
                          'your organization uses shared credentials for this integration.'
                        )}
                      </p>
                      {isAdminUser && (
                        <p className="text-xs text-gray-600 mt-2">
                          Manage keys in{' '}
                          <Link
                            to="/settings/integrations"
                            className="text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Integration settings
                          </Link>
                          .
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* 3 - Company-scoped rows */}
          {!showGlobalEmpty && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                This company
              </h3>
              {companyScopedProviders.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-surface px-4 py-4 text-sm text-gray-600">
                  No company-specific integration yet. You can still rely on catalog-wide connections above.
                  {canManageCompanyCredential && (
                    <span className="block mt-2 text-gray-500">
                      Use <strong>Add integration…</strong> to register API keys that belong only to this
                      company (e.g. a dedicated tool tenant).
                    </span>
                  )}
                </div>
              ) : (
                <ul className="space-y-4">
                  {companyScopedProviders.map((provider) => {
                    const co = summary[provider]?.company;
                    const filter = links.find((l) => l.provider === provider)?.filter;
                    const label = integrationProviderLabel(provider);

                    return (
                      <li
                        key={provider}
                        className="rounded-xl border border-gray-200 bg-surface shadow-sm overflow-hidden"
                      >
                        <div className="p-4 sm:p-5 space-y-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
                              Company credentials
                            </span>
                          </div>

                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                            <div className="min-w-0 space-y-2 flex-1">
                              <h3 className="text-base font-semibold text-gray-900 leading-snug">{label}</h3>
                              {co?.configured ? (
                                <p className="text-sm text-gray-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="text-green-800 font-medium">Keys active</span>
                                  {co.accessKeyHint ? (
                                    <>
                                      <span className="text-gray-300 hidden sm:inline" aria-hidden>
                                        ·
                                      </span>
                                      <span className="font-mono text-xs text-gray-600">{co.accessKeyHint}</span>
                                    </>
                                  ) : null}
                                  {co.baseUrl ? (
                                    <span className="text-xs text-gray-500">({co.baseUrl})</span>
                                  ) : null}
                                </p>
                              ) : (
                                <p className="text-sm text-gray-600">
                                  Using catalog-wide credentials for API calls; link or metadata is saved
                                  below.
                                </p>
                              )}
                            </div>

                            {canManageCompanyCredential && co?.configured && (
                              <div className="flex items-center gap-4 shrink-0 border-t border-gray-100 pt-4 sm:border-0 sm:pt-0">
                                <button
                                  type="button"
                                  onClick={() => openAddModal(provider)}
                                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                                >
                                  Update keys
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRemoveCompanyKeysProvider(provider)}
                                  className="text-sm font-medium text-red-600 hover:text-red-700"
                                >
                                  Remove keys
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {TOOL_LINK_PROVIDERS.has(provider) && (
                          <div className="px-4 py-4 sm:px-5 border-t border-gray-100 bg-slate-50/70">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                              <div className="min-w-0 space-y-1 flex-1">
                                <p className="text-xs font-medium text-gray-500">
                                  {provider === 'WIZ' ? 'Folder link' : 'Tag link'}
                                </p>
                                {provider === 'WIZ' ? (
                                  filter?.folderId || filter?.folderName ? (
                                    <p className="text-sm text-gray-800">
                                      <span className="font-medium text-gray-900">
                                        {filter?.folderName || '-'}
                                      </span>
                                      {filter?.folderId ? (
                                        <span className="block sm:inline sm:ml-2 mt-0.5 sm:mt-0 text-xs font-mono text-gray-500">
                                          {filter.folderId}
                                        </span>
                                      ) : null}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-gray-600">No folder linked yet.</p>
                                  )
                                ) : filter?.tagUuid || filter?.tagName ? (
                                  <p className="text-sm text-gray-800">
                                    <span className="font-medium text-gray-900">
                                      {filter?.tagName || '-'}
                                    </span>
                                    {filter?.tagUuid ? (
                                      <span className="block sm:inline sm:ml-2 mt-0.5 sm:mt-0 text-xs font-mono text-gray-500">
                                        {filter.tagUuid}
                                      </span>
                                    ) : null}
                                  </p>
                                ) : (
                                  <p className="text-sm text-gray-600">No tag linked yet.</p>
                                )}
                                {!canUseTagPicker(provider) && (
                                  <p className="text-xs text-gray-500 pt-1">
                                    {isAdminUser
                                      ? provider === 'WIZ'
                                        ? 'Configure catalog-wide or company API keys to link a folder.'
                                        : 'Configure catalog-wide or company API keys to link a tag.'
                                      : 'Ask an admin to configure catalog-wide keys, or add company keys above.'}
                                  </p>
                                )}
                              </div>
                              {canUseTagPicker(provider) && (
                                <div className="shrink-0">
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => openTagModal(provider)}
                                    className="w-full sm:w-auto"
                                  >
                                    {provider === 'WIZ'
                                      ? filter?.folderId
                                        ? 'Change folder…'
                                        : 'Link folder…'
                                      : filter?.tagUuid
                                        ? 'Change tag…'
                                        : 'Link tag…'}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {isAdminUser && !showGlobalEmpty && (
            <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">
              View all company-level integrations under{' '}
              <Link
                to="/settings/integrations"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Integration settings
              </Link>{' '}
              , or scan the &quot;Company integrations&quot; column on the{' '}
              <Link to="/companies" className="text-blue-600 hover:text-blue-700 font-medium">
                Companies
              </Link>{' '}
              list.
            </p>
          )}
        </CardContent>
      </Card>

      <AddIntegrationModal
        isOpen={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setAddModalProviderPreset(undefined);
        }}
        scope="COMPANY"
        companyId={companyId}
        onSaved={onRefresh}
        providerOptions={
          providerOptions.length
            ? providerOptions
            : [
                { value: 'TENABLE_IO', label: 'Tenable.io' },
                { value: 'WIZ', label: 'Wiz' },
              ]
        }
        defaultProvider={addModalProviderPreset}
        title={addModalProviderPreset ? 'Update company integration' : 'Add integration'}
        description="Stores API keys for this company only. When present, the app uses them for this company&apos;s integration calls first. Keys shared across all companies are managed separately by admins only and are unchanged by what you enter here."
      />

      <Modal
        isOpen={removeCompanyKeysProvider != null}
        onClose={() => !removingCompanyKeys && setRemoveCompanyKeysProvider(null)}
        title="Remove company API keys?"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setRemoveCompanyKeysProvider(null)}
              disabled={removingCompanyKeys}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmRemoveCompanyKeys} loading={removingCompanyKeys}>
              Remove keys
            </Button>
          </>
        }
      >
        {removeCompanyKeysProvider != null && (
          <div className="space-y-3">
            <p className="text-gray-700">
              Remove company-only API credentials for{' '}
              <strong>{integrationProviderLabel(removeCompanyKeysProvider)}</strong>? This organization will
              fall back to catalog-wide keys for that tool if they exist.
            </p>
            <p className="text-sm text-gray-500">Encrypted keys stored for this company will be deleted.</p>
          </div>
        )}
      </Modal>

      <IntegrationTagPickerModal
        isOpen={tagModalOpen}
        onClose={() => !savingLink && setTagModalOpen(false)}
        title={
          tagModalProvider
            ? tagModalProvider === 'WIZ'
              ? `Select folder - ${integrationProviderLabel(tagModalProvider)}`
              : `Select tag - ${integrationProviderLabel(tagModalProvider)}`
            : 'Select'
        }
        isWiz={tagModalProvider === 'WIZ'}
        tags={tags}
        loading={loadingTags}
        selectedUuid={selectedTagUuid}
        onSelectUuid={setSelectedTagUuid}
        onSave={saveTagLink}
        saving={savingLink}
      />
    </>
  );
}
