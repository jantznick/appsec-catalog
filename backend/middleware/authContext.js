/**
 * Normalized auth context accessor.
 * - Prefers `req.auth` (api-key based auth)
 * - Falls back to cookie session fields in `req.session`
 */
export function getAuthContext(req) {
  if (req?.auth?.userId) {
    return req.auth;
  }
  if (req?.session?.userId) {
    return {
      userId: req.session.userId,
      email: req.session.email ?? null,
      companyId: req.session.companyId ?? null,
      isAdmin: Boolean(req.session.isAdmin),
      verified: Boolean(req.session.verified),
    };
  }
  return null;
}

