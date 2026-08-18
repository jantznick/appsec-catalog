/**
 * Registry of AI features. Every AI call declares a `feature` key from here so
 * usage/cost can be grouped and gated per-feature. Adding a feature is as
 * simple as adding an entry; the admin usage/access UIs read from this list.
 */

export const AI_FEATURES = {
  threat_model_generate: {
    key: 'threat_model_generate',
    label: 'Threat model co-pilot',
    description: 'Drafts STRIDE threats and components for an application threat model.',
  },
};

export const AI_FEATURE_KEYS = Object.keys(AI_FEATURES);

export function isKnownFeature(key) {
  return Object.prototype.hasOwnProperty.call(AI_FEATURES, key);
}

export function listFeatures() {
  return Object.values(AI_FEATURES);
}
