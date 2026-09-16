/**
 * The canonical list of application metadata fields.
 *
 * WHY THIS EXISTS
 *
 * This list used to be hand-maintained in nine places: the `Application` and
 * `ApplicationVersion` models, `createApplicationVersion`, `createVersionFromData`,
 * `compareVersions`, `applyApprovedVersion`, `SPLITTABLE_METADATA_FIELDS`,
 * `routes/config.js availableFields`, and `BulkImportApplicationsModal.APPLICATION_FIELDS`
 * — plus a tenth copy inside `PendingApprovals.jsx`. Adding one field meant editing all
 * of them correctly, with nothing to catch a miss, and the failure modes are silent:
 *
 *   - missing from the diff list  -> the field is invisible in version history
 *   - missing from the apply list -> the field is silently discarded on approval
 *
 * Neither raises an error. See APP_DATA_FIXES_PLAN.md findings D2 and 1.1.
 *
 * DEPENDENCY-FREE ON PURPOSE
 *
 * This module imports nothing. `utils/applicationVersion.js` imports Prisma, which made
 * `compareVersions` impossible to unit test, so the pure diff logic lives here instead.
 * Keep it that way: anything added here must stay importable with no node_modules and
 * no database.
 *
 * ADDING A FIELD
 *
 * Add one entry below. The version snapshot, diff, apply and split lists all derive from
 * it. Then check the consumers that do not derive from it yet — `routes/config.js`,
 * the completeness calculators, and the two frontend copies — which are tracked as the
 * remaining work in APP_DATA_FIXES_PLAN.md 1.1 and 1.2.
 */

/**
 * @typedef {Object} ApplicationMetadataField
 * @property {string} key        Column name on `Application` and `ApplicationVersion`.
 * @property {string} label      Human label. Keep in step with routes/config.js.
 * @property {string} group      Grouping for UI and reporting.
 * @property {'string'|'int'|'boolean'|'datetime'|'json'} type Storage shape.
 * @property {boolean} versioned Recorded in the version snapshot and compared by the diff.
 * @property {boolean} approvable May be written back to the application by approving a
 *   version. False for fields the system derives, so approving an old snapshot cannot
 *   overwrite a freshly derived value with a stale one.
 * @property {boolean} splittable A split may copy this to the new application.
 */

/**
 * Canonical order. The version snapshot, diff and apply lists are emitted in this
 * order, which matches the pre-registry hand-written lists exactly — see
 * applicationFields.test.js, which pins that equivalence.
 */
export const APPLICATION_METADATA_FIELDS = Object.freeze(
  [
    // --- Identity -----------------------------------------------------------
    // `name` is versioned but never copied by a split: a split sets both names itself.
    { key: 'name', label: 'Application Name', group: 'basic', type: 'string', versioned: true, approvable: true, splittable: false },
    { key: 'description', label: 'Description', group: 'basic', type: 'string', versioned: true, approvable: true, splittable: true },
    { key: 'owner', label: 'Owner', group: 'basic', type: 'string', versioned: true, approvable: true, splittable: true },
    { key: 'repoUrl', label: 'Repository URL', group: 'basic', type: 'string', versioned: true, approvable: true, splittable: true },

    // --- Technical stack ----------------------------------------------------
    { key: 'language', label: 'Language', group: 'technical', type: 'string', versioned: true, approvable: true, splittable: true },
    { key: 'framework', label: 'Framework', group: 'technical', type: 'string', versioned: true, approvable: true, splittable: true },
    // Despite the name this is a hosting model ("cloud", "on-premises", "hybrid"), not a
    // prod/staging environment. It is a submitter claim from the manager form.
    { key: 'serverEnvironment', label: 'Server Environment', group: 'technical', type: 'string', versioned: true, approvable: true, splittable: true },

    // --- Exposure and deployment shape --------------------------------------
    { key: 'facing', label: 'Facing (Internal/External)', group: 'deployment', type: 'string', versioned: true, approvable: true, splittable: true },
    // Concatenation of the technical form's deployment frequency and method.
    { key: 'deploymentType', label: 'Deployment Type', group: 'deployment', type: 'string', versioned: true, approvable: true, splittable: true },

    // --- Security posture claims --------------------------------------------
    { key: 'authProfiles', label: 'Auth Profiles', group: 'security', type: 'string', versioned: true, approvable: true, splittable: true },
    { key: 'dataTypes', label: 'Data Types', group: 'security', type: 'string', versioned: true, approvable: true, splittable: true },

    // --- Onboarding state ---------------------------------------------------
    // Versioned, but a split always copies status explicitly so both halves start in the
    // same onboarding state - hence not splittable here.
    { key: 'status', label: 'Status', group: 'basic', type: 'string', versioned: true, approvable: true, splittable: false },

    // --- Business context ---------------------------------------------------
    { key: 'businessCriticality', label: 'Business Criticality', group: 'business', type: 'int', versioned: true, approvable: true, splittable: true },
    { key: 'criticalAspects', label: 'Critical Aspects', group: 'business', type: 'string', versioned: true, approvable: true, splittable: true },
    { key: 'devTeamContact', label: 'Development Team Contact', group: 'business', type: 'string', versioned: true, approvable: true, splittable: true },

    // --- Security testing ---------------------------------------------------
    { key: 'securityTestingDescription', label: 'Security Testing Description', group: 'security', type: 'string', versioned: true, approvable: true, splittable: true },
    { key: 'additionalNotes', label: 'Additional Notes', group: 'freetext', type: 'string', versioned: true, approvable: true, splittable: true },

    // --- Security tooling ---------------------------------------------------
    { key: 'sastTool', label: 'SAST Tool', group: 'security', type: 'string', versioned: true, approvable: true, splittable: true },
    { key: 'sastIntegrationLevel', label: 'SAST Integration Level', group: 'security', type: 'int', versioned: true, approvable: true, splittable: true },
    { key: 'sastIncludesSca', label: 'SAST includes SCA', group: 'security', type: 'boolean', versioned: true, approvable: true, splittable: true },
    { key: 'dastTool', label: 'DAST Tool', group: 'security', type: 'string', versioned: true, approvable: true, splittable: true },
    { key: 'dastIntegrationLevel', label: 'DAST Integration Level', group: 'security', type: 'int', versioned: true, approvable: true, splittable: true },
    { key: 'scaTool', label: 'SCA Tool', group: 'security', type: 'string', versioned: true, approvable: true, splittable: true },
    { key: 'scaIntegrationLevel', label: 'SCA Integration Level', group: 'security', type: 'int', versioned: true, approvable: true, splittable: true },
    { key: 'appFirewallTool', label: 'Application Firewall Tool', group: 'security', type: 'string', versioned: true, approvable: true, splittable: true },
    { key: 'appFirewallIntegrationLevel', label: 'Application Firewall Integration Level', group: 'security', type: 'int', versioned: true, approvable: true, splittable: true },
    // Superseded by the API schema upload; retained for existing data.
    { key: 'apiSecurityTool', label: 'Legacy API Security Tool', group: 'security', type: 'string', versioned: true, approvable: true, splittable: true },
    { key: 'apiSecurityIntegrationLevel', label: 'Legacy API Security Integration Level', group: 'security', type: 'int', versioned: true, approvable: true, splittable: true },
    { key: 'apiSecurityNA', label: 'API Security Not Applicable', group: 'security', type: 'boolean', versioned: true, approvable: true, splittable: true },
    { key: 'appFirewallNA', label: 'Application Firewall Not Applicable', group: 'security', type: 'boolean', versioned: true, approvable: true, splittable: true },

    // --- Deployment metadata ------------------------------------------------
    // currentVersion, gitBranch and deploymentEnvironment describe a particular running
    // copy rather than the application, and are slated to move to a per-environment
    // entity; deploymentEnvironment is expected to be deleted rather than relocated,
    // since its only job is recording which environment a row describes. lastDastScanDate
    // moves with them because DAST runs against a deployed URL. The SAST and SCA scan
    // dates stay: they describe a commit and a dependency manifest, not a deployment.
    // When that lands, those four entries come out of this list - which is the point of
    // having one list.
    { key: 'currentVersion', label: 'Current Version', group: 'deployment', type: 'string', versioned: true, approvable: true, splittable: true },
    { key: 'deploymentEnvironment', label: 'Deployment Environment', group: 'deployment', type: 'string', versioned: true, approvable: true, splittable: true },
    { key: 'gitBranch', label: 'Git Branch', group: 'deployment', type: 'string', versioned: true, approvable: true, splittable: true },
    { key: 'lastDastScanDate', label: 'Last DAST Scan Date', group: 'deployment', type: 'datetime', versioned: true, approvable: true, splittable: true },
    { key: 'lastSastScanDate', label: 'Last SAST Scan Date', group: 'deployment', type: 'datetime', versioned: true, approvable: false, splittable: true },
    { key: 'lastScaScanDate', label: 'Last SCA Scan Date', group: 'deployment', type: 'datetime', versioned: true, approvable: false, splittable: true },

    // --- Relations stored as scalars ---------------------------------------
    // JSON array of application ids in a String column. A split does not copy it:
    // relational data stays with the original application.
    { key: 'interfaces', label: 'Interfaces', group: 'technical', type: 'json', versioned: true, approvable: true, splittable: false },
  ].map((field) => Object.freeze(field)),
);

/** @type {Readonly<Record<string, ApplicationMetadataField>>} */
export const METADATA_FIELD_BY_KEY = Object.freeze(
  Object.fromEntries(APPLICATION_METADATA_FIELDS.map((f) => [f.key, f])),
);

/** Every metadata field key, in canonical order. */
export const METADATA_FIELD_KEYS = Object.freeze(APPLICATION_METADATA_FIELDS.map((f) => f.key));

/**
 * Fields carried in an `ApplicationVersion` snapshot, compared by `compareVersions`, and
 * written back by `applyApprovedVersion`. These three must agree or fields silently
 * vanish from history or from an approval — which is why they now come from one array.
 */
export const VERSIONED_METADATA_FIELDS = Object.freeze(
  APPLICATION_METADATA_FIELDS.filter((f) => f.versioned).map((f) => f.key),
);

/**
 * Fields an approval may write back to the application.
 *
 * Narrower than VERSIONED_METADATA_FIELDS: a derived field is still recorded in history
 * so you can see when it changed, but must never be *applied* from a version. The scan
 * dates are derived from scanner integrations, so applying a months-old snapshot value
 * over the current one would silently regress the freshness component of the tool score.
 */
export const APPROVABLE_METADATA_FIELDS = Object.freeze(
  APPLICATION_METADATA_FIELDS.filter((f) => f.versioned && f.approvable).map((f) => f.key),
);

/** Fields a split may copy from the original application to the new one. */
export const SPLITTABLE_METADATA_FIELDS = Object.freeze(
  APPLICATION_METADATA_FIELDS.filter((f) => f.splittable).map((f) => f.key),
);

/**
 * Whether approving a version may write this field back to the application.
 * @param {string} key
 * @returns {boolean}
 */
export function isApprovableMetadataField(key) {
  const field = METADATA_FIELD_BY_KEY[key];
  return Boolean(field?.versioned && field.approvable);
}

/** @param {string} key @returns {boolean} */
export function isMetadataField(key) {
  return Object.prototype.hasOwnProperty.call(METADATA_FIELD_BY_KEY, key);
}

/**
 * Human label for a metadata field, falling back to the key so an unknown field is
 * still identifiable in a message rather than rendering as undefined.
 * @param {string} key
 * @returns {string}
 */
export function metadataFieldLabel(key) {
  return METADATA_FIELD_BY_KEY[key]?.label ?? key;
}

/**
 * Copy the versioned metadata fields off an application (or version) row.
 *
 * Used to build a version snapshot. A plain copy with no coercion: the source is a
 * Prisma row whose values are already the right types.
 *
 * @param {Record<string, unknown>} source
 * @returns {Record<string, unknown>}
 */
export function pickVersionedMetadata(source) {
  const picked = {};
  for (const key of VERSIONED_METADATA_FIELDS) {
    picked[key] = source[key] ?? null;
  }
  return picked;
}

/**
 * Compare two versions and return the fields that differ.
 *
 * Normalises per type before comparing so that, for example, a date read back as a
 * `Date` and one read back as an ISO string are not reported as a change.
 *
 * @param {Record<string, unknown>} version1 The earlier version ("from").
 * @param {Record<string, unknown>} version2 The later version ("to").
 * @returns {{ changedFields: string[], diff: Record<string, { from: unknown, to: unknown }> }}
 */
export function compareVersions(version1, version2) {
  const changedFields = [];
  const diff = {};

  for (const field of VERSIONED_METADATA_FIELDS) {
    const val1 = version1?.[field];
    const val2 = version2?.[field];
    const { type } = METADATA_FIELD_BY_KEY[field];

    const normalize = (value) => {
      if (value === null || value === undefined) return null;
      if (type === 'datetime') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
      }
      if (type === 'boolean') return value === true ? 'true' : value === false ? 'false' : null;
      if (type === 'int') return String(value);
      return String(value).trim();
    };

    if (normalize(val1) !== normalize(val2)) {
      changedFields.push(field);
      diff[field] = { from: val1 ?? null, to: val2 ?? null };
    }
  }

  return { changedFields, diff };
}
