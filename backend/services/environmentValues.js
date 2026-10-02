/**
 * Reading per-environment values back onto an application.
 *
 * WHY THIS EXISTS
 *
 * `currentVersion` and `gitBranch` moved off `Application` onto
 * `ApplicationEnvironment`, because they describe a particular running copy rather
 * than the application: a service in prod and the same service in staging do not
 * share a version. But a dozen consumers still read `app.currentVersion` by name,
 * including dynamic dereferences (`app[scanField]` in services/scoring.js) and the
 * policy engine's `getFieldValue`. Rewriting all of them to walk a relation would
 * have been a large, error-prone diff for no gain.
 *
 * So this module flattens the values back on under their ORIGINAL property names.
 * Downstream code is unchanged and does not know anything moved.
 *
 * DEPENDENCY-FREE ON PURPOSE
 *
 * Imports nothing - same rule as services/applicationFields.js and
 * services/completeness.js. The Prisma `include` this needs is exported as data
 * (ENVIRONMENT_VALUE_INCLUDE) rather than executed here, so the pure resolution
 * logic stays unit-testable without a database.
 *
 * WHERE TO CALL IT
 *
 * At the data-access boundary: right after the query, before the row reaches
 * scoring, completeness, the policy engine or a response body. Not inside those,
 * which stay pure and keep reading plain properties.
 */

import { ENVIRONMENT_SOURCED_METADATA_FIELDS } from './applicationFields.js';
import { PRIMARY_ENVIRONMENT_KIND } from './environmentNaming.js';

/**
 * The Prisma `include` covering everything this module reads.
 *
 * Spread it into any query whose result reaches completeness, scoring or a response
 * body. It is deliberately a shared constant rather than six hand-written includes,
 * for the same reason SCORING_INCLUDE is: a call site with its own copy will
 * disagree with every other call site, and the disagreement is silent.
 */
export const ENVIRONMENT_VALUE_INCLUDE = Object.freeze({
  environments: {
    include: {
      environment: {
        select: { id: true, name: true, kind: true, status: true, displayOrder: true },
      },
    },
  },
});

/**
 * The fields this module is responsible for, taken from the registry rather than
 * restated. A field marked source: 'environment' there but unhandled here would read
 * as `undefined` everywhere, which is indistinguishable from empty.
 * environmentValues.test.js pins the two together.
 */
export const ENVIRONMENT_SOURCED_FIELDS = ENVIRONMENT_SOURCED_METADATA_FIELDS;

/**
 * Is this instance live?
 *
 * Both levels have to agree. The instance's own status says "this application no
 * longer runs in UAT"; the vocabulary row's says "this company no longer has a UAT
 * at all". Checking only the instance would let a stale row on a retired
 * environment keep counting, and nothing cascades the vocabulary status down.
 *
 * @param {{ status?: string, environment?: { status?: string } }} instance
 * @returns {boolean}
 */
export function isActiveInstance(instance) {
  if (!instance) return false;
  const instanceActive = (instance.status || 'active') === 'active';
  const vocabularyActive = (instance.environment?.status || 'active') === 'active';
  return instanceActive && vocabularyActive;
}

/**
 * The application's active environment instances, in display order.
 *
 * @param {Object} application with `environments` loaded
 * @returns {Array<Object>}
 */
export function activeInstances(application) {
  assertEnvironmentsLoaded(application);
  return [...application.environments]
    .filter(isActiveInstance)
    .sort(
      (a, b) =>
        (a.environment?.displayOrder ?? 0) - (b.environment?.displayOrder ?? 0) ||
        String(a.environment?.name || '').localeCompare(String(b.environment?.name || '')),
    );
}

/**
 * The application's primary environment instance, or null.
 *
 * Primary is DERIVED, not stored. A company holds at most one PRODUCTION
 * environment (the partial unique index Environment_companyId_kind_key enforces
 * it), so this is a lookup rather than the heuristic an earlier design feared.
 *
 * An application with no PRODUCTION instance has no primary, full stop. Nothing is
 * promoted in its place - staging does not slide up the scale. The absence shows up
 * on its own: `currentVersion` resolves to null and counts as an unfilled field
 * through the ordinary completeness path, with no special-case code.
 *
 * @param {Object} application with `environments` loaded
 * @returns {Object | null}
 */
export function primaryInstance(application) {
  return activeInstances(application).find(
    (instance) => instance.environment?.kind === PRIMARY_ENVIRONMENT_KIND,
  ) || null;
}

/**
 * Throw when the relation was never loaded.
 *
 * Prisma returns `undefined` for a relation that was not `include`d and `[]` for one
 * that was included and is empty. Those mean completely different things and look
 * identical if you only check for a falsy value:
 *
 *   undefined -> a query forgot its include. Reporting a data gap here would mean
 *                the same application scores differently depending on which endpoint
 *                you hit. That is exactly how finding E5 shipped: one of four
 *                scoring call sites omitted `apiSchema` and silently zeroed a whole
 *                category, for months, with no error anywhere.
 *   []        -> the application genuinely has no environments. A real gap, and the
 *                caller should see null values and carry on.
 *
 * @param {Object} application
 */
export function assertEnvironmentsLoaded(application) {
  if (!application || typeof application !== 'object') {
    throw new TypeError('resolveEnvironmentValues: expected an application object');
  }
  if (application.environments === undefined) {
    throw new Error(
      `Application ${application.id || '(unknown)'} was loaded without its \`environments\` relation, ` +
        'so currentVersion and gitBranch cannot be resolved. Spread ENVIRONMENT_VALUE_INCLUDE ' +
        '(services/environmentValues.js) into the query. Reporting these as empty instead would ' +
        'make the same application score differently depending on which endpoint you hit.',
    );
  }
  if (!Array.isArray(application.environments)) {
    throw new TypeError(
      `Application ${application.id || '(unknown)'}: \`environments\` should be an array, got ${typeof application.environments}`,
    );
  }
}

/**
 * The per-environment values for this application, under their original names.
 *
 * Both read from the primary environment. Knowing what is running in production is
 * the thing worth knowing, and it is what outreach to a company actually asks about.
 *
 * @param {Object} application with `environments` loaded
 * @returns {{ currentVersion: string|null, gitBranch: string|null, primaryEnvironment: Object|null }}
 */
export function resolveEnvironmentValues(application) {
  const primary = primaryInstance(application);
  return {
    currentVersion: primary?.currentVersion ?? null,
    gitBranch: primary?.gitBranch ?? null,
    primaryEnvironment: primary
      ? {
        applicationEnvironmentId: primary.id,
        environmentId: primary.environment?.id ?? null,
        name: primary.environment?.name ?? null,
        kind: primary.environment?.kind ?? null,
      }
      : null,
  };
}

/**
 * A copy of the application with the per-environment values flattened on.
 *
 * Returns a new object rather than mutating, so a Prisma row stays a faithful
 * picture of the database and nothing downstream can be surprised by a property
 * appearing on a row it holds a reference to.
 *
 * @param {Object} application with `environments` loaded
 * @returns {Object}
 */
export function withEnvironmentValues(application) {
  const { currentVersion, gitBranch, primaryEnvironment } = resolveEnvironmentValues(application);
  return { ...application, currentVersion, gitBranch, primaryEnvironment };
}

/**
 * `withEnvironmentValues` over a list. Convenience for the portfolio and dashboard
 * queries, which all load many applications at once.
 *
 * @param {Array<Object>} applications
 * @returns {Array<Object>}
 */
export function withEnvironmentValuesAll(applications) {
  return (applications || []).map(withEnvironmentValues);
}
