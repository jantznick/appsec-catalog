/** @typedef {'TENABLE_IO' | 'WIZ' | 'GITHUB' | 'BITBUCKET' | 'AZURE_DEVOPS'} IntegrationProvider */

export const PROVIDER_TENABLE_IO = 'TENABLE_IO';
export const PROVIDER_WIZ = 'WIZ';
// SCM providers use a per-user OAuth/app flow (see routes/scm.js), not the
// accessKey/secretKey credential CRUD, so they are intentionally kept out of SUPPORTED_PROVIDERS.
export const PROVIDER_GITHUB = 'GITHUB';
export const PROVIDER_BITBUCKET = 'BITBUCKET';
export const PROVIDER_AZURE_DEVOPS = 'AZURE_DEVOPS';

export const SUPPORTED_PROVIDERS = [PROVIDER_TENABLE_IO, PROVIDER_WIZ];

export function assertSupportedProvider(provider) {
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    const err = new Error(`Unsupported integration provider: ${provider}`);
    err.statusCode = 400;
    throw err;
  }
}
