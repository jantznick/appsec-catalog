/**
 * Shared vocabulary for the three product-communication surfaces: release
 * notes (ProductUpdate), the public roadmap (RoadmapItem) and the feature
 * request queue (FeatureRequest).
 *
 * They all label work the same way, so the list lives here rather than being
 * copied into each router — a category added for release notes should show up
 * on the roadmap and the request form without a second edit.
 */
export const UPDATE_CATEGORIES = [
  'Feature',
  'Improvement',
  'Fix',
  'Security',
  'Admin',
  'Integration',
  'Deployment',
];

const CATEGORY_SET = new Set(UPDATE_CATEGORIES);

/** Falls back to 'Improvement' rather than rejecting an unknown category. */
export function normalizeCategory(category) {
  const normalized = String(category || 'Improvement').trim();
  return CATEGORY_SET.has(normalized) ? normalized : 'Improvement';
}

/**
 * Per-user submission throttle, same shape as the one guarding the public
 * information-request endpoint: an in-process, per-key counter that resets on
 * restart. Proportionate for an internal tool — it stops a stuck client from
 * filling a table, and nothing more.
 */
export function createSubmissionThrottle({ windowMs, max }) {
  const log = new Map(); // key -> number[] (timestamps)

  return function isThrottled(key) {
    const now = Date.now();
    const hits = (log.get(key) || []).filter((t) => now - t < windowMs);
    if (hits.length >= max) {
      log.set(key, hits);
      return true;
    }
    hits.push(now);
    log.set(key, hits);
    if (log.size > 5000) {
      for (const [entry, times] of log) {
        if (!times.some((t) => now - t < windowMs)) log.delete(entry);
      }
    }
    return false;
  };
}
