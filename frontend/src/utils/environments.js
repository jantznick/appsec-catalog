/**
 * Display rules for environments, shared so every screen says the same word.
 *
 * Orbit names four of the five kinds. `Environment.name` for a PRODUCTION row is
 * always "production", for STAGING always "staging", and so on - so showing a Kind
 * column and a Name column side by side prints the same word twice. Only OTHER has
 * a name the company typed, and there it is the only thing telling a sandbox from a
 * demo.
 */

export const ENVIRONMENT_KIND_LABELS = Object.freeze({
  PRODUCTION: 'Production',
  STAGING: 'Staging',
  QA: 'QA',
  DEVELOPMENT: 'Development',
  OTHER: 'Other',
});

/** The one kind a company may hold several of; mirrors the backend constant. */
export const REPEATABLE_ENVIRONMENT_KIND = 'OTHER';

/**
 * What to call this environment on screen: the kind's label, or the typed name for
 * an OTHER.
 * @param {{ kind?: string, name?: string }} environment
 * @returns {string}
 */
export function environmentLabel(environment) {
  if (environment?.kind === REPEATABLE_ENVIRONMENT_KIND) {
    return environment.name || 'Other';
  }
  return ENVIRONMENT_KIND_LABELS[environment?.kind] || environment?.name || '';
}


/**
 * The names a company owns for this environment, in order, canonical first.
 *
 * For OTHER that is ALL of them: the label is the first string its pipelines send,
 * so excluding the canonical row would drop the environment's own name out of its
 * edit form. For the four named kinds the canonical is Orbit's word rather than
 * anything the company typed, so only the extras belong to them.
 *
 * @param {{ kind?: string, names?: Array<{ value: string, isCanonical: boolean }> }} environment
 * @returns {string[]}
 */
export function environmentOwnedNames(environment) {
  const names = environment?.names || [];
  const ordered = [...names].sort((a, b) => Number(b.isCanonical) - Number(a.isCanonical));
  if (environment?.kind === REPEATABLE_ENVIRONMENT_KIND) {
    return ordered.map((n) => n.value);
  }
  return ordered.filter((n) => !n.isCanonical).map((n) => n.value);
}

/** The canonical name Orbit would give an environment of this kind, or '' for OTHER. */
export function canonicalNameForKind(kind) {
  return kind === REPEATABLE_ENVIRONMENT_KIND ? '' : String(kind || '').toLowerCase();
}
