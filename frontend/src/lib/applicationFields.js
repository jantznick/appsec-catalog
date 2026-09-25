/**
 * Client-side access to the application metadata field registry.
 *
 * WHY THIS EXISTS
 *
 * `backend/services/applicationFields.js` is the single source of truth for which fields
 * an application has and which are versioned, approvable or splittable. The frontend used
 * to hand-mirror that list — twice inside `VersionHistory.jsx`, again in
 * `PendingApprovals.jsx`, and again in `SplitApplicationModal.jsx`.
 *
 * Every field added since has had to be pasted into each copy, and a paste that was
 * missed is a field that silently disappears from version history, from an approval diff,
 * or from a split. Nothing errors; the field is simply absent. That is precisely how the
 * Phase 6a fields ended up invisible in five places at once.
 *
 * The registry is now served by `GET /api/config/application-fields` and cached here for
 * the page's lifetime, so a component asks for the list instead of restating it.
 *
 * FALLBACK BEHAVIOUR
 *
 * If the fetch fails, `getVersionedFields()` returns the caller's own fallback list. That
 * keeps a transient network failure from blanking a version diff, while still meaning
 * the fallback is only ever a safety net rather than the definition.
 */

import { api } from './api.js';

/** @type {Promise<object>|null} */
let inflight = null;
/** @type {object|null} */
let cached = null;

/**
 * Fetch the registry once per page load. Concurrent callers share one request.
 * @returns {Promise<{fields: Array, versioned: string[], approvable: string[], splittable: string[]}|null>}
 */
export async function loadApplicationFieldRegistry() {
  if (cached) return cached;
  if (!inflight) {
    inflight = api
      .getApplicationFieldRegistry()
      .then((data) => {
        cached = data;
        return data;
      })
      .catch((error) => {
        // Deliberately not rethrown: a failed registry fetch should degrade a diff to
        // its fallback list, not break the screen that renders it.
        console.error('Failed to load the application field registry:', error);
        inflight = null;
        return null;
      });
  }
  return inflight;
}

/** Synchronous read of whatever has already been fetched. */
export function getCachedRegistry() {
  return cached;
}

/**
 * Versioned field keys, in registry order.
 * @param {string[]} fallback used only when the registry could not be fetched
 */
export function getVersionedFields(fallback = []) {
  return cached?.versioned?.length ? cached.versioned : fallback;
}

/**
 * Splittable field keys, in registry order.
 * @param {string[]} fallback used only when the registry could not be fetched
 */
export function getSplittableFields(fallback = []) {
  return cached?.splittable?.length ? cached.splittable : fallback;
}

/** Human label for a field key, falling back to the key so it stays identifiable. */
export function getFieldLabel(key) {
  return cached?.fields?.find((f) => f.key === key)?.label || key;
}

/** Reset the cache. Tests only. */
export function __resetRegistryCache() {
  cached = null;
  inflight = null;
}
