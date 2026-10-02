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
 * ONE SET FOR COMPLETENESS, ONE SEPARATE SET FOR SECURITY TOOLING
 *
 * The consolidation above unified the implementation but kept four sets, on the grounds
 * that changing which fields count is a product decision rather than a refactor. That
 * decision has now been made: completeness is the App Data tab, and nothing else.
 *
 * `metadata` is exactly what the App Data tab asks for — its Basic Information and
 * Technical Information cards — and it is the only set `calculateCompleteness` uses.
 * The same set drives the 40-point completeness component of the 0-100 knowledge score,
 * the dashboard percentage and the portfolio CSV's metadata column, so an application
 * has one completeness number wherever it is shown.
 *
 * `security` stays a separate set because it is a separate column in the portfolio CSV
 * answering a separate question ("what tooling is in place"), not a second opinion about
 * the same one. It is never called completeness.
 *
 * Dependency-free, like services/applicationFields.js. Keep it that way.
 */

import { isMetadataField, metadataFieldSource } from './applicationFields.js';

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
  '@standaloneSecrets',
  '@iacContainerScanning',
  'appFirewallTool',
  'appFirewallIntegrationLevel',
  'apiSchema',
  'apiSecurityNA',
  'appFirewallNA',
]);

/** Expanded where the conditional SCA marker sits. */
const STANDALONE_SCA_FIELDS = Object.freeze(['scaTool', 'scaIntegrationLevel']);

/**
 * Expanded where the conditional secrets marker sits. Same rule as SCA: when the SAST
 * tool already detects secrets the team was correctly told to leave these blank, so they
 * leave the denominator rather than counting as gaps.
 */
const STANDALONE_SECRETS_FIELDS = Object.freeze(['secretsScanTool', 'secretsScanIntegrationLevel']);

/**
 * Expanded where the IaC/container marker sits. When a team has declared it not
 * applicable, the tool and level leave the denominator and only the declaration counts
 * — the same shape as the SCA and secrets markers, so "we have no IaC" is a complete
 * answer rather than two permanent gaps.
 */
const IAC_CONTAINER_FIELDS = Object.freeze(['iacContainerScanTool', 'iacContainerScanIntegrationLevel']);

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
  metadata: 'trimmed',
  security: 'exact',
  portfolioBasic: 'trimmed',
  portfolioTechnical: 'trimmed',
});

/**
 * The named field sets. Each is a plain list of field keys, in display order, and may
 * contain the `@standaloneSca` marker which `resolveFieldSet` expands.
 */
export const FIELD_SETS = Object.freeze({
  /**
   * Application metadata: exactly the questions the App Data tab asks.
   *
   * This is the only set `calculateCompleteness` uses. Two fields the App Data tab
   * renders are deliberately absent:
   *
   * - `name` is required at create and cannot be blank, so counting it would add the
   *   same point to every application — an honest-looking percentage built on a
   *   guaranteed point. Same reasoning as the note on the N/A booleans below.
   * - `companyId` is an assignment the catalogue makes, not something a team tells us.
   *
   * `additionalNotes` is free-text with no expected answer, so an empty one is not a
   * gap. `owner` is absent because the App Data tab does not ask for it; the question
   * it used to answer is `devTeamContact`.
   *
   * Security tooling is NOT here. It is asked for on the Security tab and reported
   * separately as `security` below.
   */
  metadata: Object.freeze([
    // Basic Information card
    'description',
    'repoUrl',
    'devTeamContact',
    'criticalAspects',
    'businessCriticality',
    // Technical Information card
    'language',
    'framework',
    'serverEnvironment',
    'currentVersion',
    'facing',
    'deploymentType',
    'authProfiles',
    'dataTypes',
  ]),

  /**
   * Retained only so the differential suite can compare today's numbers against the
   * pre-consolidation ones. Nothing in the application reads these two; `metadata`
   * replaced them. Do not add a caller.
   */
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
  // Likewise for secrets scanning.
  const includeStandaloneSecrets = !application?.sastIncludesSecrets;
  return fields.flatMap((field) => {
    if (field === '@standaloneSca') {
      return includeStandaloneSca ? [...STANDALONE_SCA_FIELDS] : [];
    }
    if (field === '@standaloneSecrets') {
      return includeStandaloneSecrets ? [...STANDALONE_SECRETS_FIELDS] : [];
    }
    if (field === '@iacContainerScanning') {
      // The declaration itself always counts; the tool fields only when it applies.
      return application?.iacContainerScanNA === true
        ? ['iacContainerScanNA']
        : ['iacContainerScanNA', ...IAC_CONTAINER_FIELDS];
    }
    return [field];
  });
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
  'secretsScanIntegrationLevel',
  'iacContainerScanIntegrationLevel',
  'appFirewallIntegrationLevel',
  'apiSecurityNA',
  'appFirewallNA',
  // false is an answer. Unlike its two siblings this column has no DB default, so
  // null genuinely means unanswered and correctly counts as unfilled.
  'iacContainerScanNA',
]);

/**
 * Catch a Prisma row that loaded the environments relation but was never passed
 * through `withEnvironmentValues`.
 *
 * `currentVersion` lives on `ApplicationEnvironment` now, so on a raw Prisma row it
 * is `undefined` - and an unfilled field is also absent. Those two look identical
 * here, and the wrong one of them silently costs every application a completeness
 * point on whichever endpoint forgot the resolver. That is finding E5 exactly: one
 * call site out of several omitting an include and quietly scoring differently from
 * the rest, for months, with no error anywhere.
 *
 * The two ARE distinguishable, though. A row that came from Prisma with the relation
 * included carries `environments` as an array; once flattened, the field is a string
 * or null, never undefined. A plain object in a test or a CSV import row has no
 * `environments` key at all and is left alone.
 *
 * Deliberately not a silent default. The point is to fail on the developer's machine
 * rather than to produce a plausible wrong number in production.
 */
function assertEnvironmentFieldResolved(application, field, value) {
  if (value !== undefined) return;
  if (metadataFieldSource(field) !== 'environment') return;
  if (!Array.isArray(application?.environments)) return;

  throw new Error(
    `completeness: "${field}" is stored on ApplicationEnvironment and this application ` +
      '(id ' + (application.id || 'unknown') + ') still has it unresolved. The `environments` ' +
      'relation was loaded but the row was not passed through withEnvironmentValues() from ' +
      'services/environmentValues.js. Counting it as empty would make this endpoint disagree ' +
      'with every other one.',
  );
}

/**
 * Count filled and scorable fields for one field set.
 *
 * The single implementation every caller shares.
 *
 * `missing` names the scorable fields that were not filled, so a caller can say which
 * ones rather than reimplementing the same loop to find out — which is exactly what
 * scoring.js used to do.
 *
 * @param {Record<string, unknown>} application
 * @param {keyof FIELD_SETS | string[]} set
 * @returns {{ filled: number, total: number, missing: string[] }}
 */
export function countFieldSet(application, set, blankRule) {
  const fields = resolveFieldSet(set, application);
  // The rule normally comes from the set name. An explicit field list has no name, so
  // it would silently fall back to `trimmed` — which is the wrong rule for the record
  // and security sets. `blankRule` lets a caller state it, which is what comparing
  // against a historical field list requires.
  const ruleName = blankRule || (typeof set === 'string' && SET_BLANK_RULES[set]) || 'trimmed';
  const isBlank = BLANK_RULES[ruleName];
  if (!isBlank) throw new Error(`Unknown blank rule: ${String(ruleName)}`);

  let filled = 0;
  let total = 0;
  const missing = [];

  for (const field of fields) {
    const value = application?.[field];

    assertEnvironmentFieldResolved(application, field, value);

    // "NA" opts the field out entirely: it leaves the denominator rather than counting
    // as a gap.
    if (isStringNA(value)) continue;

    total += 1;

    let isFilled;
    if (NON_NULL_COUNTS_AS_FILLED.has(field)) {
      isFilled = value !== null && value !== undefined;
    } else if (field === 'apiSchema') {
      // A relation: truthy means a schema is attached.
      isFilled = Boolean(value);
    } else if (field === 'businessCriticality') {
      // Numeric: any set value counts, including a hypothetical 0.
      isFilled = value !== null && value !== undefined;
    } else {
      isFilled = value !== null && value !== undefined && !isBlank(value);
    }

    if (isFilled) filled += 1;
    else missing.push(field);
  }

  return { filled, total, missing };
}

/**
 * How complete is this application's metadata?
 *
 * The single answer. Every screen that shows a completeness number, and the 40-point
 * completeness component of the 0-100 knowledge score, goes through here.
 *
 * @param {Record<string, unknown>} application
 * @returns {{ filled: number, total: number, percentage: number, missing: string[] }}
 */
export function calculateCompleteness(application) {
  const { filled, total, missing } = countFieldSet(application, 'metadata');
  return { filled, total, missing, percentage: toPercentage(filled, total) };
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
