import * as client from 'openid-client';

/**
 * Okta OIDC client helper.
 *
 * Wraps openid-client (v6) with lazy discovery of the corporate Okta
 * authorization server. All configuration comes from environment variables so
 * that no Okta secrets ever reach the frontend.
 *
 * Required env vars (see .env.example):
 *   OKTA_ISSUER         e.g. https://yourcompany.okta.com/oauth2/default
 *   OKTA_CLIENT_ID
 *   OKTA_CLIENT_SECRET
 *   OKTA_REDIRECT_URI   must exactly match a "Sign-in redirect URI" in Okta
 * Optional:
 *   OKTA_SCOPES         space-delimited, default "openid email profile".
 *                       Add "groups" only if using OKTA_ADMIN_GROUP mapping.
 *   OKTA_ADMIN_GROUP    Okta group name that maps to app admins
 *   OKTA_POST_LOGOUT_REDIRECT_URI  where Okta returns the user after logout
 */

// Admin is managed manually by default, so `groups` is not requested unless the
// operator opts in via OKTA_SCOPES (needed only for OKTA_ADMIN_GROUP mapping).
const SCOPES = process.env.OKTA_SCOPES || 'openid email profile';

let configPromise = null;

/**
 * Whether Okta SSO is configured. When false, the Okta routes should behave as
 * if the feature is disabled so the app still runs without Okta credentials.
 */
export function isOktaConfigured() {
  return Boolean(
    process.env.OKTA_ISSUER &&
      process.env.OKTA_CLIENT_ID &&
      process.env.OKTA_CLIENT_SECRET &&
      process.env.OKTA_REDIRECT_URI
  );
}

/**
 * Lazily discover and cache the Okta OIDC configuration.
 * @returns {Promise<import('openid-client').Configuration>}
 */
export async function getOktaConfig() {
  if (!isOktaConfigured()) {
    throw new Error(
      'Okta is not configured. Set OKTA_ISSUER, OKTA_CLIENT_ID, OKTA_CLIENT_SECRET and OKTA_REDIRECT_URI.'
    );
  }

  if (!configPromise) {
    configPromise = client
      .discovery(
        new URL(process.env.OKTA_ISSUER),
        process.env.OKTA_CLIENT_ID,
        process.env.OKTA_CLIENT_SECRET
      )
      .catch((err) => {
        // Reset so a later request can retry discovery (e.g. transient DNS).
        configPromise = null;
        throw err;
      });
  }

  return configPromise;
}

/**
 * Build the Okta authorization URL and the per-request checks that must be
 * stashed in the session and replayed at the callback.
 * @returns {Promise<{ url: string, state: string, nonce: string, codeVerifier: string }>}
 */
export async function buildAuthorizationRequest() {
  const config = await getOktaConfig();

  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  const nonce = client.randomNonce();

  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: process.env.OKTA_REDIRECT_URI,
    scope: SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
  });

  return { url: url.href, state, nonce, codeVerifier };
}

/**
 * Complete the authorization code exchange at the callback.
 * @param {string} currentUrl - the full callback URL including query string
 * @param {{ codeVerifier: string, state: string, nonce: string }} checks
 * @returns {Promise<{ claims: object, idToken: string }>}
 */
export async function handleCallback(currentUrl, { codeVerifier, state, nonce }) {
  const config = await getOktaConfig();

  const tokens = await client.authorizationCodeGrant(config, new URL(currentUrl), {
    pkceCodeVerifier: codeVerifier,
    expectedState: state,
    expectedNonce: nonce,
    idTokenExpected: true,
  });

  const claims = tokens.claims();
  return { claims, idToken: tokens.id_token };
}

/**
 * Build the Okta end-session (RP-initiated logout) URL, if supported by the
 * discovered metadata. Returns null when unavailable so callers can fall back
 * to a plain local logout.
 * @param {string | undefined} idTokenHint
 * @returns {Promise<string | null>}
 */
export async function buildLogoutUrl(idTokenHint) {
  const config = await getOktaConfig();
  const meta = config.serverMetadata();
  if (!meta.end_session_endpoint) {
    return null;
  }

  const params = {};
  if (idTokenHint) {
    params.id_token_hint = idTokenHint;
  }
  if (process.env.OKTA_POST_LOGOUT_REDIRECT_URI) {
    params.post_logout_redirect_uri = process.env.OKTA_POST_LOGOUT_REDIRECT_URI;
  }

  return client.buildEndSessionUrl(config, params).href;
}

/**
 * Extract group names from ID token claims. Okta emits these as the `groups`
 * claim (an array of strings) when a groups claim is configured on the
 * authorization server.
 * @param {object} claims
 * @returns {string[]}
 */
export function getGroupsFromClaims(claims) {
  const groups = claims?.groups;
  if (Array.isArray(groups)) {
    return groups.filter((g) => typeof g === 'string');
  }
  if (typeof groups === 'string') {
    return [groups];
  }
  return [];
}
