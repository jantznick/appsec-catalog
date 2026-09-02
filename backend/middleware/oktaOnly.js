/**
 * Okta-only guard.
 *
 * Security: when Okta SSO is configured, this deployment is Okta-only. Every
 * local-credential surface (password login, magic-code login, setting or
 * resetting a password) is refused so none of them can serve as an alternate,
 * un-SSO'd way into an account. Break-glass: unset the Okta env vars to restore
 * local credentials if the IdP is unavailable.
 */
import { isOktaConfigured } from '../services/oktaClient.js';

/**
 * Whether this deployment is Okta-only, i.e. local credentials are disabled.
 */
export function isOktaOnly() {
  return isOktaConfigured();
}

/**
 * Build a middleware that refuses the request on Okta-only deployments.
 *
 * @param {{ error?: string, message?: string }} [options] Response body used for
 *   the 403, so each surface can explain itself in its own terms.
 */
export function blockWhenOktaOnly(options = {}) {
  const {
    error = 'Disabled by Okta SSO',
    message = 'This deployment uses Okta SSO. Local credentials are not used.',
  } = options;

  return function oktaOnlyGuard(req, res, next) {
    if (isOktaOnly()) {
      return res.status(403).json({ error, message });
    }
    next();
  };
}
