/** Human-readable names for IntegrationCredential.provider values */
const INTEGRATION_PROVIDER_LABELS = {
  TENABLE_IO: 'Tenable.io',
  WIZ: 'Wiz',
};

export function integrationProviderLabel(provider) {
  return INTEGRATION_PROVIDER_LABELS[provider] || provider;
}
