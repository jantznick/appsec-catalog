/**
 * Application name uniqueness within a company.
 *
 * Application names are unique per company, and "same name" is case-insensitive —
 * which is how users experience it, and how the split endpoint's conflict check already
 * behaves (`mode: 'insensitive'` in POST /api/applications/:id/split). A plain Prisma
 * `@@unique([companyId, name])` is case-SENSITIVE and would disagree with both, which is
 * why the database constraint is a functional index on (companyId, lower(name)).
 *
 * Dependency-free, like services/applicationFields.js, so it is unit testable and usable
 * from anywhere.
 */

/** Upper bound on one bulk import, so a single request cannot hold a long transaction. */
export const BULK_IMPORT_MAX_ROWS = 500;

/**
 * Canonical key for comparing two application names.
 * @param {unknown} name
 * @returns {string}
 */
export function applicationNameKey(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase();
}

/**
 * Give a name a numeric suffix until it no longer collides, the way a file manager
 * handles a duplicate download: "Checkout" -> "Checkout (1)" -> "Checkout (2)".
 *
 * Nothing is overwritten and no row is dropped. Note this does not make an import
 * idempotent — re-running the same file produces "Checkout (1)", then "Checkout (2)".
 * It makes the import safe under the uniqueness constraint; whether a re-import should
 * instead update in place is a separate decision.
 *
 * The caller owns `takenKeys` and should add the returned name's key to it before
 * resolving the next name, so that names allocated within one batch also avoid
 * colliding with each other.
 *
 * @param {string} name The requested name.
 * @param {Set<string>} takenKeys Keys already in use, from `applicationNameKey`.
 * @param {number} [limit] Highest suffix to try before falling back.
 * @returns {string} A name whose key is not in `takenKeys`.
 */
export function disambiguateApplicationName(name, takenKeys, limit = BULK_IMPORT_MAX_ROWS + 1) {
  const trimmed = String(name ?? '').trim();

  if (!takenKeys.has(applicationNameKey(trimmed))) return trimmed;

  for (let suffix = 1; suffix <= limit; suffix += 1) {
    const candidate = `${trimmed} (${suffix})`;
    if (!takenKeys.has(applicationNameKey(candidate))) return candidate;
  }

  // Unreachable in practice: at most `limit` names can be allocated in one request.
  // Fall back to something unique rather than dropping the row or breaking the
  // constraint.
  return `${trimmed} (${Date.now()})`;
}

/**
 * Resolve a batch of requested names against what already exists, allocating suffixes
 * as needed.
 *
 * @param {string[]} requestedNames In row order.
 * @param {Iterable<string>} existingNames Names already present in the company.
 * @returns {{ names: string[], renamed: Array<{ row: number, requestedName: string, finalName: string }> }}
 */
export function resolveApplicationNames(requestedNames, existingNames) {
  const takenKeys = new Set([...existingNames].map(applicationNameKey));
  const names = [];
  const renamed = [];

  requestedNames.forEach((requested, index) => {
    const requestedName = String(requested ?? '').trim();
    const finalName = disambiguateApplicationName(requestedName, takenKeys);
    takenKeys.add(applicationNameKey(finalName));
    names.push(finalName);

    if (finalName !== requestedName) {
      renamed.push({ row: index + 1, requestedName, finalName });
    }
  });

  return { names, renamed };
}
