/** Human-readable names for IntegrationCredential.provider values */
export const INTEGRATION_PROVIDER_LABELS = {
  TENABLE_IO: 'Tenable.io',
};

export function integrationProviderLabel(provider) {
  return INTEGRATION_PROVIDER_LABELS[provider] || provider;
}
