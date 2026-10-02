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
 * Serialise aliases back to the stored column. Returns null rather than an empty
 * string so "no aliases" is one value in the database, not two.
 *
 * @param {unknown} value a comma-separated string, or an array of strings
 * @returns {string | null}
 */
export function serializeEnvironmentAliases(value) {
  const list = Array.isArray(value)
    ? parseEnvironmentAliases(value.join(','))
    : parseEnvironmentAliases(value);
  return list.length ? list.join(',') : null;
}

/**
 * Every string that resolves to this environment: its name plus its aliases.
 *
 * The name is implicitly an alias of itself, so callers never have to remember to
 * check both.
 *
 * @param {{ name?: unknown, aliases?: unknown }} environment
 * @returns {string[]}
 */
export function environmentMatchNames(environment) {
  const name = normalizeEnvironmentName(environment?.name);
  const aliases = parseEnvironmentAliases(environment?.aliases);
  const seen = new Set();
  const out = [];
  for (const candidate of name ? [name, ...aliases] : aliases) {
    if (!seen.has(candidate)) {
      seen.add(candidate);
      out.push(candidate);
    }
  }
  return out;
}

/**
 * Strings the candidate environment would claim that another already owns.
 *
 * This is the one invariant in the environment model with no database backstop:
 * aliases live comma-packed in a single column, so uniqueness across a company
 * cannot be an index. Without this check `prod` could belong to both PRODUCTION and
 * STAGING and `resolveEnvironmentForDeployment` would return whichever row the
 * query happened to reach first.
 *
 * @param {{ id?: string, name?: unknown, aliases?: unknown }} candidate
 * @param {Array<{ id?: string, name?: unknown, aliases?: unknown }>} existing
 *   the company's other environments; the candidate's own row is skipped by id
 * @returns {Array<{ value: string, conflictsWith: string }>}
 */
export function findEnvironmentNameConflicts(candidate, existing) {
  const claimed = environmentMatchNames(candidate);
  if (!claimed.length) {
    return [];
  }

  const owners = new Map();
  for (const other of existing || []) {
    if (candidate?.id && other?.id === candidate.id) continue;
    const ownerName = normalizeEnvironmentName(other?.name) || other?.id || 'another environment';
    for (const value of environmentMatchNames(other)) {
      if (!owners.has(value)) {
        owners.set(value, ownerName);
      }
    }
  }

  const conflicts = [];
  for (const value of claimed) {
    const conflictsWith = owners.get(value);
    if (conflictsWith) {
      conflicts.push({ value, conflictsWith });
    }
  }
  return conflicts;
}
