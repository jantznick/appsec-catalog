/** @typedef {'TENABLE_IO' | 'WIZ'} IntegrationProvider */

export const PROVIDER_TENABLE_IO = 'TENABLE_IO';
export const PROVIDER_WIZ = 'WIZ';

export const SUPPORTED_PROVIDERS = [PROVIDER_TENABLE_IO, PROVIDER_WIZ];

export function assertSupportedProvider(provider) {
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    const err = new Error(`Unsupported integration provider: ${provider}`);
    err.statusCode = 400;
    throw err;
  }
}
