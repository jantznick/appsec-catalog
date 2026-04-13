import { useState, useEffect, useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import useAuthStore from '../store/authStore.js';
import { integrationProviderLabel } from '../lib/integrationLabels.js';
import { AddIntegrationModal } from '../components/integrations/AddIntegrationModal.jsx';

/**
 * Admin-only: catalog-wide (enterprise) integrations.
 */
export function IntegrationSettings() {
  const { isAdmin, loading: authLoading } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [providerOptions, setProviderOptions] = useState([]);
  const [enterpriseByProvider, setEnterpriseByProvider] = useState({});
  const [companyOverview, setCompanyOverview] = useState({ companies: [] });

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalProviderPreset, setAddModalProviderPreset] = useState(undefined);
  const [removeEnterpriseProvider, setRemoveEnterpriseProvider] = useState(null);
  const [removingEnterprise, setRemovingEnterprise] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [{ providers = [] }, overview] = await Promise.all([
        api.getIntegrationProviders(),
        api.getIntegrationAdminCompanyOverview().catch((e) => {
          console.error(e);
          return { companies: [] };
        }),
      ]);
      setCompanyOverview({ companies: overview?.companies ?? [] });

      const opts = providers.map((p) => ({
        value: p,
        label: integrationProviderLabel(p),
      }));
      setProviderOptions(opts);

      const entries = await Promise.all(
        providers.map(async (p) => {
          try {
            const c = await api.getIntegrationCredentials(p, { scope: 'ENTERPRISE' });
            return [p, c];
          } catch {
            return [p, { configured: false }];
          }
        }),
      );
      setEnterpriseByProvider(Object.fromEntries(entries));
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAdmin()) {
      load();
    }
  }, [authLoading, isAdmin]);

  const configuredProviders = useMemo(() => {
    return Object.keys(enterpriseByProvider).filter((p) => enterpriseByProvider[p]?.configured);
  }, [enterpriseByProvider]);

  const openAddModal = (preset) => {
    setAddModalProviderPreset(preset);
    setAddModalOpen(true);
  };

  const confirmRemoveEnterprise = async () => {
    if (!removeEnterpriseProvider) return;
    setRemovingEnterprise(true);
    try {
      await api.deleteIntegrationCredentials(removeEnterpriseProvider, { scope: 'ENTERPRISE' });
      toast.success('Removed');
      setRemoveEnterpriseProvider(null);
      await load();
    } catch (err) {
      toast.error(err.message || 'Failed to remove');
    } finally {
      setRemovingEnterprise(false);
    }
  };

  if (authLoading) {
    return <LoadingPage message="Loading…" />;
  }

  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div>
      <div className="mb-8">
        <Link to="/dashboard" className="text-sm text-blue-600 hover:text-blue-700 mb-2 inline-block">
          ← Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Integration settings</h1>
        <p className="text-gray-600 max-w-2xl">
          Catalog-wide API credentials apply to all companies unless a company adds its own keys on its
          company page. Only administrators can assign tags when using shared catalog-wide credentials.
          Company-specific keys are always added on each company&apos;s Integrations section (members or
          admins).
        </p>
      </div>

      {loading ? (
        <LoadingPage message="Loading…" />
      ) : (
        <Card className="max-w-2xl">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle>Integrations</CardTitle>
              <Button variant="primary" size="sm" onClick={() => openAddModal(undefined)}>
                Add integration…
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {configuredProviders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 text-center">
                <p className="text-sm text-gray-600">No integrations yet.</p>
                <p className="text-sm text-gray-500 mt-2">
                  Add a catalog-wide integration to enable shared API access across companies.
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {configuredProviders.map((provider) => {
                  const cred = enterpriseByProvider[provider];
                  return (
                    <li
                      key={provider}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-gray-200 p-4"
                    >
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          {integrationProviderLabel(provider)}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          <span className="text-green-800 font-medium">Active</span>
                          {cred?.accessKeyHint ? (
                            <span className="ml-2 font-mono text-xs">{cred.accessKeyHint}</span>
                          ) : null}
                          {cred?.baseUrl ? (
                            <span className="ml-2 text-xs text-gray-500">({cred.baseUrl})</span>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openAddModal(provider)}>
                          Update keys
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setRemoveEnterpriseProvider(provider)}>
                          Remove
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-100">
              Keys are encrypted at rest. Never share API keys in chat or tickets.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && (
        <Card className="max-w-2xl mt-8">
          <CardHeader>
            <CardTitle>Company-level integrations</CardTitle>
            <p className="text-sm text-gray-600 font-normal mt-1 max-w-2xl">
              Organizations where someone saved company-specific API keys (members or admins). These take
              precedence for that company&apos;s calls; catalog-wide keys above are unchanged.
            </p>
          </CardHeader>
          <CardContent>
            {companyOverview.companies?.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 text-center">
                <p className="text-sm text-gray-600">No company-specific keys yet.</p>
                <p className="text-sm text-gray-500 mt-2">
                  When a user adds keys on a company&apos;s Integrations section, that company appears here.
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {companyOverview.companies.map((row) => (
                  <li
                    key={row.companyId}
                    className="rounded-lg border border-gray-200 p-4 flex flex-wrap items-start justify-between gap-3"
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        <Link
                          to={`/companies/${row.companyId}`}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          {row.companyName}
                        </Link>
                      </h3>
                      <ul className="mt-2 space-y-1">
                        {row.integrations.map((int) => (
                          <li key={`${row.companyId}-${int.provider}`} className="text-sm text-gray-600">
                            <span className="font-medium text-gray-800">
                              {integrationProviderLabel(int.provider)}
                            </span>
                            {int.accessKeyHint ? (
                              <span className="ml-2 font-mono text-xs">{int.accessKeyHint}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <AddIntegrationModal
        isOpen={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setAddModalProviderPreset(undefined);
        }}
        scope="ENTERPRISE"
        onSaved={load}
        providerOptions={providerOptions.length ? providerOptions : [{ value: 'TENABLE_IO', label: 'Tenable.io' }]}
        defaultProvider={addModalProviderPreset}
        title={addModalProviderPreset ? 'Update catalog-wide integration' : 'Add integration'}
        description="These credentials apply to the entire catalog (all companies). Per-company keys are added on each company Integrations page."
      />

      <Modal
        isOpen={removeEnterpriseProvider != null}
        onClose={() => !removingEnterprise && setRemoveEnterpriseProvider(null)}
        title="Remove catalog-wide integration?"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setRemoveEnterpriseProvider(null)}
              disabled={removingEnterprise}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmRemoveEnterprise} loading={removingEnterprise}>
              Remove
            </Button>
          </>
        }
      >
        {removeEnterpriseProvider != null && (
          <div className="space-y-3">
            <p className="text-gray-700">
              Remove catalog-wide API credentials for{' '}
              <strong>{integrationProviderLabel(removeEnterpriseProvider)}</strong>? Companies that rely on
              these shared keys will no longer be able to use this integration until new catalog-wide or
              company keys are configured.
            </p>
            <p className="text-sm text-gray-500">Encrypted keys for this integration will be deleted.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
