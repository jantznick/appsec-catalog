import crypto from 'crypto';

/**
 * Threat modeling built on Adam Shostack's four questions:
 *   1. What are we working on?      -> scope + actors + data types (per node)
 *   2. What can go wrong?           -> threats[] (optionally STRIDE-tagged)
 *   3. What are we going to do?     -> per-threat mitigation + status + ticket
 *   4. Did we do a good job?        -> model status + review + component sign-off
 *
 * A threat model has a root node (the whole application) plus component nodes
 * (auth, payments, storage, ...). Threats live as JSON arrays on each node.
 */

export const THREAT_MODEL_REVIEW_MAX_DAYS = 180; // mirrors metadata review window

export const MODEL_STATUSES = ['draft', 'in_review', 'approved', 'superseded'];
export const THREAT_STATUSES = ['open', 'mitigated', 'accepted', 'ticketed'];

// STRIDE categories used to prompt "what can go wrong" (question 2).
export const STRIDE_CATEGORIES = [
  { key: 'spoofing', label: 'Spoofing', question: 'Can someone pretend to be someone (or something) they are not?' },
  { key: 'tampering', label: 'Tampering', question: 'Can data or code be modified when it should not be?' },
  { key: 'repudiation', label: 'Repudiation', question: 'Can someone deny an action without us being able to prove otherwise?' },
  { key: 'information_disclosure', label: 'Information disclosure', question: 'Can data be exposed to someone not authorized to see it?' },
  { key: 'denial_of_service', label: 'Denial of service', question: 'Can the component be made unavailable or degraded?' },
  { key: 'elevation_of_privilege', label: 'Elevation of privilege', question: 'Can someone do something they should not be allowed to?' },
];

const STRIDE_KEYS = new Set(STRIDE_CATEGORIES.map((c) => c.key));

// Actors and data types for question 1 (checkboxes in the UI).
export const ACTOR_OPTIONS = [
  { key: 'end_user', label: 'End user (customer)' },
  { key: 'privileged_user', label: 'Privileged user (admin, support)' },
  { key: 'api_client', label: 'API client (machine)' },
  { key: 'partner', label: 'Partner / external integration' },
  { key: 'internal_service', label: 'Internal service' },
  { key: 'platform_admin', label: 'Platform administrator' },
];

export const DATA_TYPE_OPTIONS = [
  { key: 'none', label: 'None / non-sensitive' },
  { key: 'credentials', label: 'Credentials / secrets' },
  { key: 'pii', label: 'PII (names, email, profile)' },
  { key: 'payment', label: 'Payment / financial' },
  { key: 'health', label: 'Health / regulated' },
  { key: 'other_regulated', label: 'Other regulated' },
];

/**
 * Library of component archetypes. Each pre-seeds the STRIDE categories most
 * relevant to that kind of component and offers a couple of starter prompts,
 * so a non-expert gets nudged toward the right questions.
 */
export const COMPONENT_ARCHETYPES = [
  {
    key: 'auth',
    label: 'Authentication & sessions',
    description: 'Login, tokens, session management, password reset.',
    relevantStride: ['spoofing', 'elevation_of_privilege', 'information_disclosure'],
    starterThreats: [
      { title: 'Stolen or replayed credentials/tokens', stride: 'spoofing' },
      { title: 'Session fixation or token that never expires', stride: 'elevation_of_privilege' },
    ],
  },
  {
    key: 'payment',
    label: 'Payment processing',
    description: 'Checkout, billing, card/bank handling, payment provider calls.',
    relevantStride: ['tampering', 'repudiation', 'information_disclosure'],
    starterThreats: [
      { title: 'Price or amount tampering before charge', stride: 'tampering' },
      { title: 'Disputed transaction with no audit trail', stride: 'repudiation' },
    ],
  },
  {
    key: 'data_storage',
    label: 'Data storage',
    description: 'Databases, object stores, caches, backups holding sensitive data.',
    relevantStride: ['information_disclosure', 'tampering', 'denial_of_service'],
    starterThreats: [
      { title: 'Unencrypted sensitive data at rest', stride: 'information_disclosure' },
      { title: 'Broken object-level authorization (IDOR)', stride: 'information_disclosure' },
    ],
  },
  {
    key: 'integration',
    label: 'External integration / third party',
    description: 'Outbound calls to partners, SaaS, webhooks, and their data sharing.',
    relevantStride: ['spoofing', 'information_disclosure', 'tampering'],
    starterThreats: [
      { title: 'Unverified webhook / spoofed callback', stride: 'spoofing' },
      { title: 'Over-sharing data with third party', stride: 'information_disclosure' },
    ],
  },
  {
    key: 'admin',
    label: 'Admin / privileged functions',
    description: 'Back-office tools, elevated roles, configuration and support access.',
    relevantStride: ['elevation_of_privilege', 'repudiation', 'spoofing'],
    starterThreats: [
      { title: 'Missing authorization on admin action', stride: 'elevation_of_privilege' },
      { title: 'Privileged action not logged', stride: 'repudiation' },
    ],
  },
  {
    key: 'file_upload',
    label: 'File upload / processing',
    description: 'User uploads, document/image processing, parsing untrusted input.',
    relevantStride: ['tampering', 'denial_of_service', 'elevation_of_privilege'],
    starterThreats: [
      { title: 'Malicious file leads to code execution', stride: 'elevation_of_privilege' },
      { title: 'Large/zip-bomb upload exhausts resources', stride: 'denial_of_service' },
    ],
  },
  {
    key: 'messaging',
    label: 'Messaging / notifications',
    description: 'Email, SMS, push, or queue-based messaging to users or systems.',
    relevantStride: ['spoofing', 'information_disclosure', 'denial_of_service'],
    starterThreats: [
      { title: 'Spoofed sender / phishing via our channel', stride: 'spoofing' },
      { title: 'Sensitive data leaked in notification body', stride: 'information_disclosure' },
    ],
  },
  {
    key: 'other',
    label: 'Other component',
    description: 'Anything else worth its own pass through the four questions.',
    relevantStride: [],
    starterThreats: [],
  },
];

const ARCHETYPE_KEYS = new Set(COMPONENT_ARCHETYPES.map((a) => a.key));

const ARCHETYPE_LABELS = Object.fromEntries(COMPONENT_ARCHETYPES.map((a) => [a.key, a.label]));

/**
 * Derive the components that *should* be modeled from the question-1 answers.
 * Declaring sensitive data or privileged actors means a matching component has
 * to be modeled and reviewed before the model counts as complete — you can't
 * claim you handle payments and then leave that surface unexamined.
 */
export function getRecommendedArchetypes(model) {
  const data = model?.dataTypes || [];
  const actors = model?.actors || [];
  const recs = new Map(); // archetype -> reason
  const add = (key, reason) => { if (!recs.has(key)) recs.set(key, reason); };

  if (data.includes('credentials')) add('auth', 'handles credentials or secrets');
  if (data.includes('payment')) add('payment', 'handles payment or financial data');
  if (data.some((d) => ['pii', 'health', 'other_regulated'].includes(d))) {
    add('data_storage', 'stores sensitive or regulated data');
  }
  if (actors.some((a) => ['privileged_user', 'platform_admin'].includes(a))) {
    add('admin', 'has privileged / admin users');
  }
  if (actors.some((a) => ['api_client', 'partner'].includes(a))) {
    add('integration', 'exposes APIs or integrates with partners');
  }

  return [...recs.entries()].map(([archetype, reason]) => ({
    archetype,
    label: ARCHETYPE_LABELS[archetype] || archetype,
    reason,
  }));
}

/** Metadata surfaced to the frontend so it can render prompts/checkboxes. */
export function getThreatModelOptions() {
  return {
    archetypes: COMPONENT_ARCHETYPES,
    stride: STRIDE_CATEGORIES,
    actors: ACTOR_OPTIONS,
    dataTypes: DATA_TYPE_OPTIONS,
    modelStatuses: MODEL_STATUSES,
    threatStatuses: THREAT_STATUSES,
    reviewMaxDays: THREAT_MODEL_REVIEW_MAX_DAYS,
  };
}

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function clampString(value, max) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  return str.slice(0, max);
}

/** Normalize an incoming threat object; drops anything without a title. */
export function normalizeThreat(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = clampString(raw.title, 300);
  if (!title) return null;

  const stride = STRIDE_KEYS.has(raw.stride) ? raw.stride : null;
  const status = THREAT_STATUSES.includes(raw.status) ? raw.status : 'open';

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID(),
    title,
    stride,
    description: clampString(raw.description, 2000),
    mitigation: clampString(raw.mitigation, 2000),
    status,
    ticketUrl: clampString(raw.ticketUrl, 1000),
  };
}

export function normalizeThreats(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList.map(normalizeThreat).filter(Boolean).slice(0, 100);
}

function normalizeKeyList(rawList, allowed) {
  if (!Array.isArray(rawList)) return [];
  const seen = new Set();
  const out = [];
  for (const item of rawList) {
    if (allowed.has(item) && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

export function normalizeActors(rawList) {
  return normalizeKeyList(rawList, new Set(ACTOR_OPTIONS.map((a) => a.key)));
}

export function normalizeDataTypes(rawList) {
  return normalizeKeyList(rawList, new Set(DATA_TYPE_OPTIONS.map((d) => d.key)));
}

export function normalizeArchetype(value) {
  return ARCHETYPE_KEYS.has(value) ? value : 'other';
}

export function isValidModelStatus(value) {
  return MODEL_STATUSES.includes(value);
}

/**
 * Turn a Prisma ThreatModel (+components) into a plain object with parsed JSON
 * fields. Accepts null (no model yet). There is intentionally no score here —
 * the threat model is a documentation tool and does not contribute to any score.
 */
export function serializeThreatModel(model) {
  if (!model) {
    return { model: null };
  }

  const components = (model.components || [])
    .slice()
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    .map((c) => ({
      id: c.id,
      name: c.name,
      archetype: c.archetype,
      orderIndex: c.orderIndex,
      scope: c.scope || '',
      threats: parseJsonArray(c.threats),
      reviewed: c.reviewed,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

  const serialized = {
    id: model.id,
    applicationId: model.applicationId,
    status: model.status,
    version: model.version,
    scope: model.scope || '',
    actors: parseJsonArray(model.actors),
    dataTypes: parseJsonArray(model.dataTypes),
    threats: parseJsonArray(model.threats),
    reviewer: model.reviewer || '',
    lastReviewedAt: model.lastReviewedAt,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
    components,
  };

  return { model: serialized };
}

/**
 * Given the Q1 answers (actors + data types) and the components that already
 * exist, return the archetypes that should be auto-created because something is
 * checked but has no matching component yet.
 * @param {{ actors?: string[], dataTypes?: string[] }} model
 * @param {Array<{ archetype: string }>} existingComponents
 * @returns {Array<{ archetype: string, label: string, reason: string }>}
 */
export function getMissingRecommendedArchetypes(model, existingComponents = []) {
  const present = new Set(existingComponents.map((c) => c.archetype));
  return getRecommendedArchetypes(model).filter((r) => !present.has(r.archetype));
}
