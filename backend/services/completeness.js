/**
 * How complete is an application record?
 *
 * WHY THIS IS ONE MODULE NOW
 *
 * There were four implementations of this question, with four different field lists
 * that disagreed (APP_DATA_FIXES_PLAN.md finding D1 / 1.2): this module, a
 * hand-mirrored copy in frontend/src/utils/applicationCompleteness.js,
 * `countBasicTechnicalMetadata` + `countSecurityCompletenessFields` in
 * utils/portfolioCompleteness.js, and KNOWLEDGE_SCORING_FIELDS in services/scoring.js.
 * `owner` counted in two of them, `criticalAspects` and `currentVersion` in exactly one,
 * `devTeamContact` in two — a different two. One application therefore had several
 * defensible completeness percentages depending on which screen you looked at.
 *
 * ONE IMPLEMENTATION, SEVERAL NAMED SETS — NOT ONE SET
 *
 * The sets are kept distinct on purpose. They answer genuinely different questions:
 * "is this record filled in" is not "how much has this team told us", and the portfolio
 * CSV deliberately reports metadata and security separately. Collapsing them into a
 * single set would change numbers already on dashboards, which is a product decision
 * rather than a refactor.
 *
 * So: the field sets are declared once, here, and every caller shares the one counting
 * implementation below. Every current number is preserved — see completeness.test.js,
 * which pins them.
 *
 * Dependency-free, like services/applicationFields.js. Keep it that way.
 */

import { isMetadataField } from './applicationFields.js';

/**
 * Fields that are not columns on `Application` and so are not in the field registry.
 * `apiSchema` is a relation; a caller may include the row or pass a boolean.
 */
export const PSEUDO_FIELDS = Object.freeze(['apiSchema']);

/**
 * Security tooling fields. Shared by the record and portfolio sets, which is why the
 * portfolio "security" number has always matched the tail of the record set exactly.
 *
 * `scaTool` / `scaIntegrationLevel` are conditional: when SAST covers SCA they leave the
 * denominator rather than counting as gaps.
 */
const SECURITY_FIELDS = Object.freeze([
  'sastTool',
  'sastIntegrationLevel',
  'dastTool',
  'dastIntegrationLevel',
  '@standaloneSca',
  'appFirewallTool',
  'appFirewallIntegrationLevel',
  'apiSchema',
  'apiSecurityNA',
  'appFirewallNA',
]);

/** Expanded where the conditional SCA marker sits. */
const STANDALONE_SCA_FIELDS = Object.freeze(['scaTool', 'scaIntegrationLevel']);

/**
 * How a set decides a string is blank.
 *
 * The two pre-existing implementations disagreed, and the difference is preserved rather
 * than unified: the record and security sets counted a whitespace-only value as filled
 * (`value !== ''`), while the portfolio metadata sets did not (`value.trim() !== ''`).
 * Unifying them would move numbers already on dashboards, so it is a product decision
 * and is tracked separately — see APP_DATA_FIXES_PLAN.md 1.2. `trimmed` is the more
 * defensible rule of the two if we ever pick one.
 */
const BLANK_RULES = Object.freeze({
  /** Only the empty string is blank. A whitespace-only value counts as filled. */
  exact: (value) => value === '',
  /** Whitespace-only values are blank too. */
  trimmed: (value) => String(value).trim() === '',
});

/** @type {Readonly<Record<string, 'exact'|'trimmed'>>} */
export const SET_BLANK_RULES = Object.freeze({
  record: 'exact',
  security: 'exact',
  portfolioBasic: 'trimmed',
  portfolioTechnical: 'trimmed',
});

/**
 * The named field sets. Each is a plain list of field keys, in display order, and may
 * contain the `@standaloneSca` marker which `resolveFieldSet` expands.
 */
export const FIELD_SETS = Object.freeze({
  /** Whole-record completeness, shown per application and on dashboards. */
  record: Object.freeze([
    'name',
    'description',
    'owner',
    'repoUrl',
    'language',
    'framework',
    'serverEnvironment',
    'facing',
    'deploymentType',
    'authProfiles',
    'dataTypes',
    ...SECURITY_FIELDS,
  ]),

  /** Basic Information card on the application detail page; portfolio CSV metadata. */
  portfolioBasic: Object.freeze([
    'name',
    'description',
    'repoUrl',
    'devTeamContact',
    'criticalAspects',
    'businessCriticality',
  ]),

  /** Technical Information card; portfolio CSV metadata. Scalar fields only. */
  portfolioTechnical: Object.freeze([
    'language',
    'framework',
    'serverEnvironment',
    'currentVersion',
    'facing',
    'deploymentType',
    'authProfiles',
    'dataTypes',
  ]),

  /** Security tooling only; the portfolio CSV's second percentage. */
  security: SECURITY_FIELDS,
});

/**
 * Expand a named set for a given application.
 * @param {keyof FIELD_SETS | string[]} set A set name, or an explicit list of keys.
 * @param {Record<string, unknown>} application
 * @returns {string[]}
 */
export function resolveFieldSet(set, application) {
  const fields = Array.isArray(set) ? set : FIELD_SETS[set];
  if (!fields) {
    throw new Error(`Unknown completeness field set: ${String(set)}`);
  }

  // When SAST output includes SCA, the standalone SCA fields are not applicable.
  const includeStandaloneSca = !application?.sastIncludesSca;
  return fields.flatMap((field) =>
    field === '@standaloneSca' ? (includeStandaloneSca ? [...STANDALONE_SCA_FIELDS] : []) : [field],
  );
}

/**
 * If a field is exactly the text "NA" (after trim), do not count it toward completeness
 * (matches knowledge scoring: empty still counts; "NA" opts out of that field).
 *
 * This sentinel is a known wart — case-sensitive, exact, and undocumented in the UI.
 * See APP_DATA_FIXES_PLAN.md C1.
 * @param {unknown} value
 * @returns {boolean}
 */
function isStringNA(value) {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'string') return false;
  return value.trim() === 'NA';
}

/**
 * Fields where any non-null value counts as answered, including `false` and `0`.
 *
 * Integration levels: 0 is a real level ("Unknown / Nothing"), not an absence.
 * N/A booleans: `false` is an answer. Note these carry `@default(false)` in the schema,
 * so in practice they are never null and always count as filled — two guaranteed points
 * on every application (APP_DATA_FIXES_PLAN.md C2).
 */
const NON_NULL_COUNTS_AS_FILLED = new Set([
  'sastIntegrationLevel',
  'dastIntegrationLevel',
  'scaIntegrationLevel',
  'appFirewallIntegrationLevel',
  'apiSecurityNA',
  'appFirewallNA',
]);

/**
 * Count filled and scorable fields for one field set.
 *
 * The single implementation every caller shares.
 *
 * @param {Record<string, unknown>} application
 * @param {keyof FIELD_SETS | string[]} set
 * @returns {{ filled: number, total: number }}
 */
export function countFieldSet(application, set) {
  const fields = resolveFieldSet(set, application);
  const isBlank = BLANK_RULES[(typeof set === 'string' && SET_BLANK_RULES[set]) || 'trimmed'];

  let filled = 0;
  let total = 0;

  for (const field of fields) {
    const value = application?.[field];

    // "NA" opts the field out entirely: it leaves the denominator rather than counting
    // as a gap.
    if (isStringNA(value)) continue;

    total += 1;

    if (NON_NULL_COUNTS_AS_FILLED.has(field)) {
      if (value !== null && value !== undefined) filled += 1;
      continue;
    }

    if (field === 'apiSchema') {
      // A relation: truthy means a schema is attached.
      if (value) filled += 1;
      continue;
    }

    if (field === 'businessCriticality') {
      // Numeric: any set value counts, including a hypothetical 0.
      if (value !== null && value !== undefined) filled += 1;
      continue;
    }

    if (value !== null && value !== undefined && !isBlank(value)) {
      filled += 1;
    }
  }

  return { filled, total };
}

/**
 * Whole-record completeness for an application.
 *
 * `apiSchema` is treated as a truthy relation (include it as a boolean or the related
 * row); every other field is read directly off the application.
 *
 * @param {Record<string, unknown>} application
 * @returns {{ filled: number, total: number, percentage: number }}
 */
export function calculateCompleteness(application) {
  const { filled, total } = countFieldSet(application, 'record');
  return { filled, total, percentage: toPercentage(filled, total) };
}

/**
 * @param {number} filled
 * @param {number} total
 * @returns {number} 0-100, and 0 rather than NaN when nothing is scorable.
 */
export function toPercentage(filled, total) {
  return total > 0 ? Math.round((filled / total) * 100) : 0;
}

/**
 * Every field named across all sets that is neither a registry field nor a declared
 * pseudo-field. Should always be empty; asserted by the tests so a typo in a set above
 * cannot silently count a field that does not exist as permanently missing.
 * @returns {string[]}
 */
export function findUnknownFieldsInSets() {
  const unknown = new Set();
  for (const set of Object.keys(FIELD_SETS)) {
    // Resolve both ways so the conditional SCA fields are checked too.
    for (const sastIncludesSca of [true, false]) {
      for (const field of resolveFieldSet(set, { sastIncludesSca })) {
        if (!isMetadataField(field) && !PSEUDO_FIELDS.includes(field)) {
          unknown.add(field);
        }
      }
    }
  }
  return [...unknown];
}
