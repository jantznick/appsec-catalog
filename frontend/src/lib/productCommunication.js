/**
 * Shared vocabulary and colour for the product-communication surfaces:
 * What's New (updates, roadmap, feature requests) and the two admin pages
 * behind them.
 *
 * Colour follows the house rule for this theme — accent `-100` fills with
 * `-800` text, so a badge reads as a tinted chip rather than a saturated
 * block. The ramps themselves are remapped in index.css.
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

const CATEGORY_BADGES = {
  Feature: 'bg-blue-100 text-blue-800',
  Improvement: 'bg-indigo-100 text-indigo-800',
  Fix: 'bg-amber-100 text-amber-800',
  Security: 'bg-red-100 text-red-800',
  Admin: 'bg-purple-100 text-purple-800',
  Integration: 'bg-green-100 text-green-800',
  Deployment: 'bg-orange-100 text-orange-800',
};

export function categoryBadgeClass(category) {
  return CATEGORY_BADGES[category] || 'bg-gray-100 text-gray-700';
}

/**
 * Roadmap columns, left to right. The server sends the same list with every
 * roadmap response; this adds the presentation that the API has no business
 * knowing about, and acts as the fallback if a response arrives without it.
 */
export const ROADMAP_STAGES = [
  {
    key: 'EXPLORING',
    label: 'Exploring',
    description: 'Being scoped — not committed to yet.',
    badge: 'bg-gray-100 text-gray-700',
    dot: 'bg-gray-400',
    accent: 'border-gray-300',
  },
  {
    key: 'PLANNED',
    label: 'Planned',
    description: 'Committed, waiting its turn.',
    badge: 'bg-indigo-100 text-indigo-800',
    dot: 'bg-indigo-400',
    accent: 'border-indigo-400',
  },
  {
    key: 'IN_PROGRESS',
    label: 'In progress',
    description: 'Actively being built.',
    badge: 'bg-blue-100 text-blue-800',
    dot: 'bg-blue-500',
    accent: 'border-blue-500',
  },
  {
    key: 'SHIPPED',
    label: 'Shipped',
    description: 'Live in Orbit.',
    badge: 'bg-green-100 text-green-800',
    dot: 'bg-green-500',
    accent: 'border-green-500',
  },
];

/**
 * The finer-grained states an IN_PROGRESS item can be in. Null just means
 * "being built"; these are the milestones people ask about by name.
 */
export const ROADMAP_PROGRESS_STATES = [
  { key: 'BETA_TESTING', label: 'In beta testing', badge: 'bg-violet-100 text-violet-800' },
  { key: 'HTS_TESTING', label: 'In HTS testing', badge: 'bg-amber-100 text-amber-800' },
  {
    key: 'SCHEDULED_RELEASE',
    label: 'Scheduled for production release',
    badge: 'bg-green-100 text-green-800',
  },
];

export function progressStateMeta(key) {
  return ROADMAP_PROGRESS_STATES.find((state) => state.key === key) || null;
}

/** "In HTS testing" / "Production release 12 Mar 2026" — the card's sub-label. */
export function progressStateLabel(item) {
  const meta = progressStateMeta(item?.progressState);
  if (!meta) return null;
  if (meta.key === 'SCHEDULED_RELEASE' && item?.scheduledReleaseAt) {
    return `Production release ${formatShortDate(item.scheduledReleaseAt)}`;
  }
  return meta.label;
}

export function stageMeta(key) {
  return ROADMAP_STAGES.find((stage) => stage.key === key) || ROADMAP_STAGES[0];
}

/** Feature-request triage states, in the order a request moves through them. */
export const REQUEST_STATUSES = [
  { key: 'NEW', label: 'New', badge: 'bg-amber-100 text-amber-800' },
  { key: 'UNDER_REVIEW', label: 'Under review', badge: 'bg-blue-100 text-blue-800' },
  { key: 'PLANNED', label: 'Planned', badge: 'bg-indigo-100 text-indigo-800' },
  { key: 'DECLINED', label: 'Not planned', badge: 'bg-gray-100 text-gray-600' },
  { key: 'SHIPPED', label: 'Shipped', badge: 'bg-green-100 text-green-800' },
];

export function requestStatusMeta(key) {
  return REQUEST_STATUSES.find((status) => status.key === key) || REQUEST_STATUSES[0];
}

export function formatDate(value, fallback = '') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatShortDate(value, fallback = '') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value, fallback = '') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "Mar 2026" — the heading the updates feed groups entries under. */
export function monthKey(value) {
  if (!value) return 'Undated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Undated';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

/**
 * Split a free-text body into paragraphs and bullet runs for rendering.
 * Update bodies are plain text (there is no editor), but authors reliably
 * write lists with "-" or "*", so those are recognised and rendered as lists
 * instead of being flattened into one line.
 */
export function parseBody(body) {
  if (!body) return [];

  return String(body)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
      const isList = lines.length > 0 && lines.every((line) => /^[-*•]\s+/.test(line));
      if (isList) {
        return { type: 'list', items: lines.map((line) => line.replace(/^[-*•]\s+/, '')) };
      }
      return { type: 'paragraph', text: lines.join(' ') };
    });
}
