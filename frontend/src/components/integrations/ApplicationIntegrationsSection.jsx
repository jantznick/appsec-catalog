import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import useAuthStore from '../../store/authStore.js';
import { integrationProviderLabel } from '../../lib/integrationLabels.js';
import { IntegrationTagPickerModal } from './IntegrationTagPickerModal.jsx';
import { ApplicationGithubBlock } from './ApplicationGithubBlock.jsx';

const TOOL_LINK_PROVIDERS = new Set(['TENABLE_IO', 'WIZ']);

/**
 * Per-application Tenable tag / Wiz folder links. API credentials come from the app’s company.
 * @param {{ application: object, onRefresh: () => Promise<void> }} props
 */
export function ApplicationIntegrationsSection({ application, onRefresh }) {
  const { isAdmin, user } = useAuthStore();
  const companyId = application?.companyId;
  const applicationId = application?.id;
  const isMemberOfCompany = user?.companyId === companyId;
  const isAdminUser = isAdmin();
  const canViewThisCompany = isAdminUser || isMemberOfCompany;

  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagModalProvider, setTagModalProvider] = useState(null);
  const [tags, setTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  const summary = application?.integrationSummary || {};
  const links = application?.applicationToolLinks || [];

  const appScopedProviders = useMemo(() => {
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

  const catalogWideProviders = useMemo(() => {
    return Object.keys(summary).filter((p) => summary[p]?.enterprise?.configured);
  }, [summary]);

  const canUseTagPicker = (provider) => {
    const co = summary[provider]?.company;
    const ent = summary[provider]?.enterprise;
    return (
      (co?.configured && (isAdminUser || isMemberOfCompany)) || (ent?.configured && canViewThisCompany)
    );
  };

  const openTagModal = async (provider) => {
    if (!canUseTagPicker(provider) || !applicationId) return;
    setTagModalProvider(provider);
    setTagModalOpen(true);
    setSelectedId('');
    setLoadingTags(true);
    const filter = links.find((l) => l.provider === provider)?.filter;
    try {
      const data = await api.getApplicationIntegrationTags(applicationId, provider);
      setTags(Array.isArray(data.tags) ? data.tags : []);
      if (provider === 'WIZ') {
        if (filter?.folderId) setSelectedId(filter.folderId);
      } else if (filter?.tagUuid) {
        setSelectedId(filter.tagUuid);
      }
    } catch (e) {
      toast.error(e.message || 'Failed to load tags');
      setTagModalOpen(false);
    } finally {
      setLoadingTags(false);
    }
  };

  const saveTagLink = async () => {
    if (!tagModalProvider || !selectedId || !applicationId) {
      toast.error(tagModalProvider === 'WIZ' ? 'Select a folder' : 'Select a tag');
      return;
    }
    const tag = tags.find((t) => t.uuid === selectedId);
    setSavingLink(true);
    try {
      if (tagModalProvider === 'WIZ') {
        await api.putApplicationIntegrationLink(applicationId, tagModalProvider, {
          folderId: selectedId,
          folderName: tag?.value || null,
        });
      } else {
        await api.putApplicationIntegrationLink(applicationId, tagModalProvider, {
          tagUuid: selectedId,
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
    catalogWideProviders.length === 0 && appScopedProviders.length === 0;

  if (!applicationId || !companyId) {
    return null;
  }

  return (
    <>
      <ApplicationGithubBlock
        application={application}
        canManage={canViewThisCompany}
        onRefresh={onRefresh}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Integrations (this application)</CardTitle>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Link a Tenable tag or Wiz folder to <strong>this application</strong>. API keys are managed
            for the company (
            <Link to={`/companies/${companyId}`} className="text-blue-600 hover:underline">
              company integrations
            </Link>
            ) or catalog-wide in{' '}
            <Link to="/settings/integrations" className="text-blue-600 hover:underline">
              Integration settings
            </Link>
            .
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {showGlobalEmpty ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-4 py-6 text-center text-sm text-gray-600">
              No integration credentials available for this company. Configure Tenable or Wiz on the
              company or catalog-wide first.
            </div>
          ) : null}

          {!showGlobalEmpty && catalogWideProviders.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Catalog-wide (shared)
              </h3>
              <ul className="space-y-2">
                {catalogWideProviders.map((provider) => {
                  const ent = summary[provider]?.enterprise;
                  const label = integrationProviderLabel(provider);
                  return (
                    <li
                      key={`a-ent-${provider}`}
                      className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm text-gray-800"
                    >
                      <span className="font-medium text-gray-900">{label}</span>
                      {isAdminUser && ent?.accessKeyHint ? (
                        <span className="ml-2 font-mono text-xs text-gray-600">{ent.accessKeyHint}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {!showGlobalEmpty && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                This application
              </h3>
              {appScopedProviders.length === 0 ? (
                <p className="text-sm text-gray-600">
                  No linkable tool yet. Add catalog-wide or company credentials for Tenable or Wiz.
                </p>
              ) : (
                <ul className="space-y-4">
                  {appScopedProviders.map((provider) => {
                    const co = summary[provider]?.company;
                    const filter = links.find((l) => l.provider === provider)?.filter;
                    const label = integrationProviderLabel(provider);
                    return (
                      <li
                        key={provider}
                        className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
                      >
                        <div className="p-4 space-y-2">
                          <h3 className="text-base font-semibold text-gray-900">{label}</h3>
                          {co?.configured ? (
                            <p className="text-sm text-gray-600">Company keys active for this company.</p>
                          ) : (
                            <p className="text-sm text-gray-600">
                              Using catalog-wide credentials for this company for API calls.
                            </p>
                          )}
                        </div>
                        {TOOL_LINK_PROVIDERS.has(provider) && (
                          <div className="px-4 py-4 border-t border-gray-100 bg-slate-50/70">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-500">
                                  {provider === 'WIZ' ? 'Folder link' : 'Tag link'}
                                </p>
                                {provider === 'WIZ' ? (
                                  filter?.folderId || filter?.folderName ? (
                                    <p className="text-sm text-gray-800">
                                      <span className="font-medium">{filter?.folderName || '-'}</span>
                                      {filter?.folderId ? (
                                        <span className="block text-xs font-mono text-gray-500">
                                          {filter.folderId}
                                        </span>
                                      ) : null}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-gray-600">No folder linked yet.</p>
                                  )
                                ) : filter?.tagUuid || filter?.tagName ? (
                                  <p className="text-sm text-gray-800">
                                    <span className="font-medium">{filter?.tagName || '-'}</span>
                                    {filter?.tagUuid ? (
                                      <span className="block text-xs font-mono text-gray-500">
                                        {filter.tagUuid}
                                      </span>
                                    ) : null}
                                  </p>
                                ) : (
                                  <p className="text-sm text-gray-600">No tag linked yet.</p>
                                )}
                              </div>
                              {canUseTagPicker(provider) && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openTagModal(provider)}
                                  className="shrink-0"
                                >
                                  {provider === 'WIZ'
                                    ? filter?.folderId
                                      ? 'Change folder…'
                                      : 'Link folder…'
                                    : filter?.tagUuid
                                      ? 'Change tag…'
                                      : 'Link tag…'}
                                </Button>
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
        </CardContent>
      </Card>

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
        selectedUuid={selectedId}
        onSelectUuid={setSelectedId}
        onSave={saveTagLink}
        saving={savingLink}
      />
    </>
  );
}
