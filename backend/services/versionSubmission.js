/**
 * What a form submission actually said, as distinct from what the application already
 * held.
 *
 * THE PROBLEM THIS SOLVES
 *
 * `PUT /api/applications/public/:id` used to merge every submitted field with the stored
 * value before writing the pending version:
 *
 *     sastTool: sastTool?.trim() || existing.sastTool
 *
 * So a submitter could never clear anything. Clearing the SAST tool gave back the old
 * value, the version held the old value, the approval screen diffed old against old,
 * found no change, and never rendered the field. The admin was not shown a conflict to
 * resolve — the answer never arrived. Same for answering "No" to interfaces.
 *
 * The boolean half of this was fixed separately (see `submittedFlag` in the route, which
 * distinguishes an unchecked box from an absent key). This generalises that idea to
 * every type and records the result.
 *
 * THE SHAPE
 *
 * A version snapshot stays COMPLETE — every metadata column holds the application's value
 * at submit time — so version history and version-to-version diffs are unaffected.
 * Alongside it, `submittedFields` lists which of those columns the submission carried.
 * An approval writes only that subset.
 *
 * That gives two things at once:
 *
 *   - a submitted-but-empty field is null in the snapshot AND named in submittedFields,
 *     so it reads as a deliberate clear and is applied as null
 *   - a field the form never sent keeps its existing value in the snapshot and is absent
 *     from submittedFields, so approving can never write it back — which is what stopped
 *     a Wednesday approval of Monday's form reverting Tuesday's edits
 *
 * Dependency-free, like services/applicationFields.js. Keep it that way.
 */

import { METADATA_FIELD_BY_KEY, isMetadataField } from './applicationFields.js';

/** `submittedFields` is stored as a comma-separated string, like `approvedFields`. */
const SEPARATOR = ',';

/**
 * Serialize the submitted field list for storage.
 * @param {Iterable<string>} fields
 * @returns {string|null} null when nothing was submitted, so the column stays meaningful
 */
export function serializeSubmittedFields(fields) {
  const list = [...new Set(fields)].filter(isMetadataField);
  return list.length > 0 ? list.join(SEPARATOR) : null;
}

/**
 * Read a stored `submittedFields` value.
 *
 * @param {string|null|undefined} value
 * @returns {string[]|null} null for a version predating the column — the caller must
 *   treat that as "unknown", not as "nothing was submitted", or approving a queued
 *   legacy version would silently apply nothing.
 */
export function parseSubmittedFields(value) {
  if (value === null || value === undefined) return null;
  return String(value)
    .split(SEPARATOR)
    .map((f) => f.trim())
    .filter(Boolean);
}

/**
 * Coerce a posted value to the storage shape its registry entry declares.
 *
 * An empty or whitespace-only string becomes null: for a submitted field that is the
 * submitter clearing it, which is the whole point. `false` and `0` are preserved — they
 * are answers, not absences.
 *
 * @param {unknown} value
 * @param {string} field Registry field key.
 * @returns {unknown}
 */
export function coerceSubmittedValue(value, field) {
  const entry = METADATA_FIELD_BY_KEY[field];
  if (!entry) return value ?? null;
  if (value === null || value === undefined) return null;

  switch (entry.type) {
    case 'boolean':
      // Only an explicit true reads as true; anything else the form can send for an
      // unchecked box reads as false.
      return value === true || value === 'true';

    case 'int': {
      if (value === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    }

    case 'datetime': {
      if (value === '') return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    case 'json':
      // Already serialized by the caller; an empty value means "no relations".
      return value === '' ? null : value;

    default: {
      const trimmed = typeof value === 'string' ? value.trim() : String(value);
      return trimmed === '' ? null : trimmed;
    }
  }
}

/**
 * Build the pending-version payload from a complete baseline plus what was submitted.
 *
 * @param {Record<string, unknown>} baseline Every metadata field at submit time,
 *   normally `pickVersionedMetadata(existing)`.
 * @param {Record<string, unknown>} submitted Only the fields the form carried. A key
 *   present with an empty value is a deliberate clear.
 * @returns {{ versionData: Record<string, unknown>, submittedFields: string[] }}
 */
export function buildSubmission(baseline, submitted) {
  const submittedFields = [];
  const versionData = { ...baseline };

  for (const [field, value] of Object.entries(submitted)) {
    if (!isMetadataField(field)) continue;
    versionData[field] = coerceSubmittedValue(value, field);
    submittedFields.push(field);
  }

  return { versionData, submittedFields };
}

/**
 * Which fields an approval may write back.
 *
 * @param {string[]|null} submittedFields From `parseSubmittedFields`; null for a legacy
 *   version, which falls back to `approvableFields` so queued versions keep their
 *   meaning.
 * @param {string[]|null} approvedFields What the admin ticked; null means "everything
 *   offered".
 * @param {string[]} approvableFields Fields the registry allows an approval to write.
 * @returns {string[]}
 */
export function resolveFieldsToApply(submittedFields, approvedFields, approvableFields) {
  // An explicit empty array means the admin approved nothing. That must not be read as
  // approving everything.
  const requested = approvedFields || approvableFields;

  const allowed = new Set(approvableFields);
  const submittable = submittedFields === null ? null : new Set(submittedFields);

  return requested.filter(
    (field) => allowed.has(field) && (submittable === null || submittable.has(field)),
  );
}
