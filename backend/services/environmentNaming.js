/**
 * Environment naming rules. Deliberately free of any prisma import so the rules
 * can be tested without a database.
 *
 * IMPORTANT: the name -> kind mapping here is duplicated as a CASE expression in
 * migration 20260916120000_add_environments, which seeds the vocabulary from
 * existing deployment history. If you change one, change the other, or a company's
 * seeded environments will disagree with what new deployments infer.
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
