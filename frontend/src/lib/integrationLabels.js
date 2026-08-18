/** Human-readable names for IntegrationCredential.provider and SCM connection.provider values */
const INTEGRATION_PROVIDER_LABELS = {
  TENABLE_IO: 'Tenable.io',
  WIZ: 'Wiz',
  GITHUB: 'GitHub',
  GITLAB: 'GitLab',
  BITBUCKET: 'Bitbucket',
  AZURE_DEVOPS: 'Azure DevOps',
};

export function integrationProviderLabel(provider) {
  return INTEGRATION_PROVIDER_LABELS[provider] || provider;
}

export function scmProviderLabel(provider) {
  return INTEGRATION_PROVIDER_LABELS[provider] || provider;
}
