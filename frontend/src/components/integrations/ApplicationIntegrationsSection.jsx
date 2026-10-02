import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card.jsx';
import useAuthStore from '../../store/authStore.js';
import { integrationProviderLabel } from '../../lib/integrationLabels.js';
import { ApplicationScmBlock } from './ApplicationScmBlock.jsx';

const TOOL_LINK_PROVIDERS = new Set(['WIZ']);

/**
 * Per-application Wiz tag links, scoped by the app's company folder.
 * @param {{ application: object, onRefresh: () => Promise<void> }} props
 */
export function ApplicationIntegrationsSection({ application, onRefresh }) {
  const { isAdmin, user } = useAuthStore();
  const companyId = application?.companyId;
  const applicationId = application?.id;
  const isMemberOfCompany = user?.companyId === companyId;
  const isAdminUser = isAdmin();
  const canViewThisCompany = isAdminUser || isMemberOfCompany;


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




  const showGlobalEmpty =
    catalogWideProviders.length === 0 && appScopedProviders.length === 0;

  if (!applicationId || !companyId) {
    return null;
  }

  return (
    <>
      <ApplicationScmBlock
        application={application}
        canManage={canViewThisCompany}
        onRefresh={onRefresh}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Integrations (this application)</CardTitle>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Link a Wiz tag to <strong>this application</strong>. Wiz tags are limited to the
            company&apos;s linked folder. API keys are managed
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
              No integration credentials available for this company. Configure Wiz on the
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
                  No linkable tool yet. Add catalog-wide or company credentials for Wiz.
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
                        className="rounded-xl border border-gray-200 bg-surface shadow-sm overflow-hidden"
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
                            <p className="text-xs font-medium text-gray-500">Tag link</p>
                            <p className="mt-1 text-sm text-gray-600">
                              {/* The picker that used to live here chose from tags
                                  discovered in the folder, which meant a value had to
                                  already exist on a resource before it could be
                                  linked - no good for a company writing its tagging
                                  standard alongside the catalog. The value is assigned
                                  on the record itself now. */}
                              Assign this application&rsquo;s Wiz tag value on its{' '}
                              <span className="font-medium">Cloud resources</span> card, under
                              the Deployments tab.
                              {filter?.tagValue ? (
                                <span className="block text-xs text-gray-500">
                                  Currently <span className="font-mono">{filter.tagValue}</span>
                                </span>
                              ) : null}
                            </p>
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

    </>
  );
}
