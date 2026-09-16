/**
 * Application metadata fields that a split (POST /api/applications/:id/split) can
 * carry over from the original application to the newly created one.
 *
 * Derived from the single field registry in services/applicationFields.js — add a field
 * there, not here. Kept as its own module so the split route's imports do not change.
 *
 * Deliberately NOT splittable (see the `splittable` flag in the registry):
 *   - `name` / `companyId` — set explicitly by the split itself
 *   - `status` — always copied, so both halves start in the same onboarding state
 *   - `interfaces` and every other relation — domains, deployments, deployment tokens,
 *     product links, contacts, notes, threat model and API schema all stay with the
 *     original application; a split only ever copies scalar metadata.
 *   - `metadataLastReviewed` — not metadata; the new application has never been reviewed
 */
import { SPLITTABLE_METADATA_FIELDS } from '../services/applicationFields.js';

export { SPLITTABLE_METADATA_FIELDS };

export const SPLITTABLE_METADATA_FIELD_SET = new Set(SPLITTABLE_METADATA_FIELDS);

export const SPLIT_METADATA_MODES = ['all', 'none', 'selected'];
