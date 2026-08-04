/** @typedef {'TENABLE_IO' | 'WIZ' | 'GITHUB'} IntegrationProvider */

export const PROVIDER_TENABLE_IO = 'TENABLE_IO';
export const PROVIDER_WIZ = 'WIZ';
// GitHub uses its own per-user OAuth/GitHub-App flow (see routes/github.js), not the
// accessKey/secretKey credential CRUD, so it is intentionally kept out of SUPPORTED_PROVIDERS.
export const PROVIDER_GITHUB = 'GITHUB';

export const SUPPORTED_PROVIDERS = [PROVIDER_TENABLE_IO, PROVIDER_WIZ];

export function assertSupportedProvider(provider) {
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    const err = new Error(`Unsupported integration provider: ${provider}`);
    err.statusCode = 400;
    throw err;
  }
}
