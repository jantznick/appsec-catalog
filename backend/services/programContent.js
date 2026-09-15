/**
 * Program content distribution — shared vocabulary and visibility rules for
 * ASCOE sessions and Security Champions packages. See PROGRAM_CONTENT_PLAN.md.
 *
 * Every visibility decision in this feature comes from here so that the member
 * list endpoints, the detail endpoints, and (in Phase 2) the asset download
 * route cannot drift apart.
 */

export const STATUSES = new Set(['draft', 'published']);

export const AUDIENCE_SCOPES = new Set(['all', 'companies']);

/**
 * Asset `kind` drives only the badge/icon shown on the card.
 */
export const ASSET_KINDS = new Set([
  'slide_deck',
  'recording',
  'document',
  'article',
  'game',
  'challenge',
  'link',
]);

/**
 * Asset `section` is a DISPLAY GROUPING, not a permission. Everyone who can see
 * a release can see all of its assets; this only decides which heading an asset
 * appears under. In particular `facilitator` content is grouped, not hidden —
 * a champion seeing the facilitator guide is harmless, while a champion who
 * can't find their pre-read is the actual failure mode.
 */
export const ASSET_SECTIONS = ['agenda', 'pre_read', 'facilitator', 'materials', 'activity', 'recording'];

const ASSET_SECTION_SET = new Set(ASSET_SECTIONS);

/**
 * Per-program section ordering and headings. A program renders only the
 * sections it uses, and the frontend drops any that end up empty.
 */
export const SECTION_LAYOUT = {
  ascoe: [
    { section: 'agenda', heading: 'Before the session' },
    { section: 'pre_read', heading: 'Come prepared' },
    { section: 'materials', heading: 'From the session' },
    { section: 'recording', heading: 'Watch the session' },
  ],
  champions: [
    { section: 'pre_read', heading: 'For champions to review beforehand' },
    { section: 'facilitator', heading: 'Running the meeting' },
    { section: 'materials', heading: 'In the meeting' },
    { section: 'activity', heading: 'Games & challenges' },
    { section: 'recording', heading: 'Watch the session' },
  ],
};

export function normalizeStatus(status) {
  const normalized = String(status || 'draft').trim().toLowerCase();
  return STATUSES.has(normalized) ? normalized : 'draft';
}

/**
 * Unrecognized scopes fall back to 'companies', the narrower value, so a typo
 * or a malformed request can never widen an audience.
 */
export function normalizeAudienceScope(scope) {
  const normalized = String(scope || 'companies').trim().toLowerCase();
  return AUDIENCE_SCOPES.has(normalized) ? normalized : 'companies';
}

export function normalizeAssetKind(kind) {
  const normalized = String(kind || 'document').trim().toLowerCase();
  return ASSET_KINDS.has(normalized) ? normalized : 'document';
}

export function normalizeAssetSection(section) {
  const normalized = String(section || 'materials').trim().toLowerCase();
  return ASSET_SECTION_SET.has(normalized) ? normalized : 'materials';
}

/**
 * Hosts allowed in `embedUrl`. That value goes straight into an iframe src, so
 * it is the most attacker-useful field in the feature and is allowlisted rather
 * than merely validated as a URL.
 *
 * Extend via PROGRAM_CONTENT_EMBED_HOSTS (comma-separated) rather than editing
 * this list, so a tenant-specific SharePoint host doesn't need a code change.
 */
const DEFAULT_EMBED_HOSTS = [
  'sharepoint.com',
  'microsoftstream.com',
  'web.microsoftstream.com',
];

function allowedEmbedHosts() {
  const fromEnv = String(process.env.PROGRAM_CONTENT_EMBED_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return [...DEFAULT_EMBED_HOSTS, ...fromEnv];
}

/**
 * @returns {{ ok: true, value: string|null } | { ok: false, error: string }}
 */
export function validateExternalUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return { ok: true, value: null };

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, error: 'Link must be a valid URL' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'Link must use https' };
  }
  return { ok: true, value: parsed.toString() };
}

/**
 * Embed URLs must be https, on an allowlisted host, and must look like a real
 * embed endpoint — a plain SharePoint *share* link refuses to render in an
 * iframe, so accepting one would produce a silently blank player. Rejecting it
 * here lets the admin form explain the difference.
 */
export function validateEmbedUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return { ok: true, value: null };

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, error: 'Embed link must be a valid URL' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'Embed link must use https' };
  }

  const host = parsed.hostname.toLowerCase();
  const permitted = allowedEmbedHosts().some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
  if (!permitted) {
    return {
      ok: false,
      error: `Embed link host "${host}" is not allowed. Recordings must be embedded from SharePoint or Stream.`,
    };
  }

  const looksLikeEmbed = /embed\.aspx/i.test(parsed.pathname) || parsed.searchParams.has('embed');
  if (!looksLikeEmbed) {
    return {
      ok: false,
      error:
        'That looks like a SharePoint share link, which will not play inline. Use the URL from SharePoint\'s "Embed" option instead.',
    };
  }

  return { ok: true, value: parsed.toString() };
}

/**
 * Prisma `where` fragment for releases a member may see.
 *
 * Visibility keys off `status` alone — `publishedAt` records when a release
 * first went out and is never cleared, so it is not a visibility signal.
 *
 * An `audienceScope` of 'all' means "every member, ongoing", which is what lets
 * a newly onboarded company pick up the whole back catalog without anyone
 * backfilling join rows.
 *
 * @param {{ isAdmin?: boolean, companyId?: string|null }} auth
 * @param {'ascoe'|'champions'} program - selects the join relation name
 */
export function memberVisibilityWhere(auth, program) {
  if (auth?.isAdmin) {
    return { status: 'published' };
  }

  const audience = [{ audienceScope: 'all' }];

  // A member with no company can only ever see the 'all' releases. Without this
  // guard an undefined companyId would match every join row.
  if (auth?.companyId) {
    audience.push({ companies: { some: { companyId: auth.companyId } } });
  }

  return { status: 'published', OR: audience };
}

/**
 * Prisma `where` fragment for the public marketing catalog.
 *
 * Gated on publication plus the explicit public flag, and nothing else —
 * audience targeting is irrelevant here because the public payload carries no
 * company identifiers at all. A company-targeted session can still be
 * advertised; what it cannot do is expose who it was targeted at.
 */
export function publicVisibilityWhere() {
  return { status: 'published', isPubliclyListed: true };
}

/**
 * True when `auth` may see `release`. Used by the detail and (Phase 2) download
 * routes, which must re-derive entitlement from the parent release rather than
 * trusting an asset id.
 *
 * @param {{ status: string, audienceScope: string, companies?: {companyId: string}[] }} release
 */
export function canMemberSeeRelease(auth, release) {
  if (!release) return false;
  if (auth?.isAdmin) return true;
  if (release.status !== 'published') return false;
  if (release.audienceScope === 'all') return true;
  if (!auth?.companyId) return false;
  return (release.companies || []).some((entry) => entry.companyId === auth.companyId);
}
