/**
 * Environment naming rules. Deliberately free of any prisma import so the rules
 * can be tested without a database.
 *
 * ORBIT OWNS THE TAXONOMY, COMPANIES OWN THE WORDS
 *
 * `kind` is ours and is what cross-company reporting counts. `name` is whatever the
 * company actually tags and deploys with, and `aliases` are the other strings their
 * pipelines send for the same place. A company has at most one row of each kind
 * except OTHER - see the partial unique index Environment_companyId_kind_key.
 *
 * NOTHING HERE INFERS AT RESOLVE TIME
 *
 * `inferEnvironmentKind` is a seed-time default and a suggestion in the settings UI.
 * It must never be used to attach a deployment or a Wiz tag to an environment: a
 * submitted string matches a name or an alias exactly, or it goes to Unassigned.
 * Guessing would quietly absorb the typos this feature exists to surface.
 *
 * IMPORTANT: the name -> kind mapping here is duplicated as a CASE expression in
 * migration 20260922120000_add_environments, which seeded the vocabulary from
 * existing deployment history. If you change one, change the other.
 */

/** Canonical buckets. A company's own `name` is free text; `kind` is comparable. */
export const ENVIRONMENT_KINDS = Object.freeze([
  'PRODUCTION',
  'STAGING',
  'DEVELOPMENT',
  'QA',
  'OTHER',
]);

const KIND_BY_NAME = new Map([
  ['prod', 'PRODUCTION'],
  ['production', 'PRODUCTION'],
  ['prd', 'PRODUCTION'],
  ['live', 'PRODUCTION'],
  ['stage', 'STAGING'],
  ['staging', 'STAGING'],
  ['stg', 'STAGING'],
  ['preprod', 'STAGING'],
  ['pre-prod', 'STAGING'],
  ['dev', 'DEVELOPMENT'],
  ['development', 'DEVELOPMENT'],
  ['develop', 'DEVELOPMENT'],
  ['qa', 'QA'],
  ['test', 'QA'],
  ['testing', 'QA'],
  ['uat', 'QA'],
]);

/**
 * Canonical form of an environment name: trimmed and lower-cased, so "Prod ",
 * "prod" and "PROD" all address the same environment. Returns null for anything
 * that is not a usable name.
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeEnvironmentName(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.toLowerCase();
}

/**
 * Best-guess canonical bucket for a name. Unrecognised names are OTHER rather than
 * a guess: an environment that silently claims to be PRODUCTION would quietly
 * change what cross-company production reporting counts.
 *
 * @param {unknown} raw
 * @returns {string} one of ENVIRONMENT_KINDS
 */
export function inferEnvironmentKind(raw) {
  const name = normalizeEnvironmentName(raw);
  if (!name) {
    return 'OTHER';
  }
  return KIND_BY_NAME.get(name) || 'OTHER';
}

/**
 * @param {unknown} kind
 * @returns {boolean}
 */
export function isValidEnvironmentKind(kind) {
  return typeof kind === 'string' && ENVIRONMENT_KINDS.includes(kind);
}

/**
 * The one kind a company may hold more than one of.
 *
 * The other four are single-slot, which is what makes "the company's production
 * environment" a total lookup rather than a tie-break. OTHER is the catch-all, so a
 * company can add as many as it needs.
 */
export const REPEATABLE_ENVIRONMENT_KIND = 'OTHER';

/** @param {unknown} kind @returns {boolean} */
export function isSingleSlotKind(kind) {
  return isValidEnvironmentKind(kind) && kind !== REPEATABLE_ENVIRONMENT_KIND;
}

/**
 * The kind whose environment is an application's primary.
 *
 * Primary is derived rather than stored: because a company has at most one
 * PRODUCTION row, "which environment is the main one" is a lookup, not a heuristic.
 * An application with no PRODUCTION instance has no primary and nothing is promoted
 * in its place - staging is never slid up the scale.
 */
export const PRIMARY_ENVIRONMENT_KIND = 'PRODUCTION';

/**
 * Parse the comma-separated alias column into normalised, de-duplicated names.
 *
 * Aliases exist because real pipelines are inconsistent: one says `prod`, another
 * `production`, a third `Prod-US`. Recording the extras here is cheaper and safer
 * than asking a company to change its tagging schema, and far safer than inferring.
 *
 * @param {unknown} raw
 * @returns {string[]} normalised, order preserved, no duplicates, no blanks
 */
export function parseEnvironmentAliases(raw) {
  if (typeof raw !== 'string') {
    return [];
  }
  const seen = new Set();
  const out = [];
  for (const part of raw.split(',')) {
    const normalized = normalizeEnvironmentName(part);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}



/**
 * The canonical name for an environment of this kind.
 *
 * Orbit owns the word for the four named kinds, so every company's production
 * environment is called "production" however its pipelines spell it. That is what
 * makes cross-company screens readable - eighteen companies showing eighteen
 * different words for the same thing is worse than one word plus an alias list.
 *
 * OTHER is the exception, and has to be: a company with a sandbox and a demo has
 * two OTHERs, and the typed name is the only thing telling them apart.
 *
 * @param {unknown} kind
 * @param {unknown} typedName used only when kind is OTHER
 * @returns {string | null} normalized, or null when OTHER was given no usable name
 */
export function canonicalEnvironmentName(kind, typedName) {
  if (kind === REPEATABLE_ENVIRONMENT_KIND) {
    return normalizeEnvironmentName(typedName);
  }
  return isValidEnvironmentKind(kind) ? kind.toLowerCase() : null;
}

/**
 * Whether the company types this environment's name, or Orbit derives it.
 * @param {unknown} kind
 * @returns {boolean}
 */
export function hasTypedName(kind) {
  return kind === REPEATABLE_ENVIRONMENT_KIND;
}

/**
 * The full set of strings an environment should answer to: its canonical name plus
 * the extra spellings, normalized and de-duplicated, canonical first.
 *
 * This is what routes/environments.js writes into EnvironmentName. It does NOT
 * decide uniqueness - the database does, via @@unique([companyId, value]).
 *
 * @param {string} canonical
 * @param {unknown} extras comma-separated string, or an array
 * @returns {string[]}
 */
export function environmentNameRows(canonical, extras) {
  const list = Array.isArray(extras)
    ? parseEnvironmentAliases(extras.join(','))
    : parseEnvironmentAliases(extras);
  const seen = new Set();
  const out = [];
  for (const value of [canonical, ...list]) {
    const normalized = normalizeEnvironmentName(value);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}
