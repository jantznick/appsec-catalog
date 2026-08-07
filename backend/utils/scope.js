/**
 * Apply an admin's global view scope (company or division) to a Prisma
 * `where` clause for a COMPANY-OWNED model (Application, Product, Domain, ...).
 *
 * Contract:
 * - This is a convenience filter for admins only. Only when `auth.isAdmin` do
 *   we honor the scope params; for non-admins we return the clause untouched so
 *   the caller's existing hard-scoping (whereClause.companyId = auth.companyId)
 *   remains the real boundary. A client-chosen scope can never widen access.
 * - `companyId` wins over `divisionId` when both are present.
 * - Division scope filters through the owning company's `divisionId`.
 *
 * @param {object} whereClause - Prisma where clause to mutate and return.
 * @param {{ isAdmin?: boolean }} auth - Normalized auth context.
 * @param {{ companyId?: string, divisionId?: string }} query - req.query.
 * @returns {object} The (possibly modified) where clause.
 */
export function applyCompanyScope(whereClause, auth, query) {
  if (!auth?.isAdmin) return whereClause;
  const companyId = query?.companyId;
  const divisionId = query?.divisionId;
  if (companyId) {
    whereClause.companyId = companyId;
  } else if (divisionId) {
    whereClause.company = { ...(whereClause.company || {}), divisionId };
  }
  return whereClause;
}
