/**
 * Program content distribution — ASCOE sessions and Security Champions
 * packages. See PROGRAM_CONTENT_PLAN.md.
 *
 * Three surfaces, deliberately distinct:
 *   /public            marketing catalog, no auth, no company identifiers ever
 *   /ascoe|/champions  member delivery, audience-scoped
 *   /admin/*           authoring, admins only
 *
 * Phase 1 is links-only: assets carry an externalUrl and/or embedUrl. The
 * upload columns exist in the schema but nothing writes them yet.
 *
 * ROUTE ORDER MATTERS HERE. The member routes use `/:program` and
 * `/:program/:slug`, which are the same shape as `/admin/ascoe` and
 * `/admin/assets/:id`. Express matches in declaration order, and Express 5
 * removed inline regex params (`/:program(ascoe|champions)` throws), so the
 * only thing keeping these apart is that every literal path is declared before
 * the parameterized one that could swallow it. Order is, strictly:
 *   /public  ->  /admin/assets/reorder  ->  /admin/assets  ->
 *   /admin/assets/:id  ->  /admin/:program  ->  /admin/:program/:id  ->
 *   /:program  ->  /:program/:slug
 * Adding a literal route below its parameterized sibling will silently 404.
 */
import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireVerified, requireAdmin } from '../middleware/auth.js';
import { getAuthContext } from '../middleware/authContext.js';
import {
  SECTION_LAYOUT,
  normalizeStatus,
  normalizeAudienceScope,
  normalizeAssetKind,
  normalizeAssetSection,
  validateExternalUrl,
  validateEmbedUrl,
  memberVisibilityWhere,
  publicVisibilityWhere,
  canMemberSeeRelease,
} from '../services/programContent.js';

const router = express.Router();

const MAX_TITLE = 200;
const MAX_TEXT = 20000;

/**
 * The two programs differ enough to have separate tables, but list/detail/CRUD
 * are structurally identical, so they're driven from one descriptor rather than
 * duplicated. Program-specific fields are handled by `buildExtra`.
 */
const PROGRAMS = {
  ascoe: {
    key: 'ascoe',
    label: 'ASCOE session',
    delegate: () => prisma.ascoeSession,
    /** Column on ContentAsset pointing at this program's release. */
    assetFk: 'ascoeSessionId',
    /** Column the member/admin lists sort by. */
    dateField: 'sessionDate',
    extraSelect: { sessionDate: true, location: true },
    buildExtra(body, { isCreate }) {
      const sessionDate = parseOptionalDate(body?.sessionDate);
      if (sessionDate.error) return { error: sessionDate.error };
      const location = trimToNull(body?.location);
      if (location && location.length > MAX_TITLE) {
        return { error: `Location must be ${MAX_TITLE} characters or fewer` };
      }
      void isCreate;
      return { data: { sessionDate: sessionDate.value, location } };
    },
  },
  champions: {
    key: 'champions',
    label: 'Champions package',
    delegate: () => prisma.championsPackage,
    assetFk: 'packageId',
    dateField: 'periodStart',
    extraSelect: { periodStart: true, theme: true, facilitatorNotes: true },
    buildExtra(body, { isCreate }) {
      const periodStart = parseOptionalDate(body?.periodStart);
      if (periodStart.error) return { error: periodStart.error };
      // Unlike an ASCOE session date, periodStart drives the "current package"
      // callout and month ordering, so it can't be left unset.
      if (isCreate && !periodStart.value) {
        return { error: 'Period start (the first of the month) is required' };
      }
      const theme = trimToNull(body?.theme);
      if (theme && theme.length > MAX_TITLE) {
        return { error: `Theme must be ${MAX_TITLE} characters or fewer` };
      }
      const facilitatorNotes = trimToNull(body?.facilitatorNotes);
      if (facilitatorNotes && facilitatorNotes.length > MAX_TEXT) {
        return { error: `Facilitator notes must be ${MAX_TEXT} characters or fewer` };
      }
      const data = { theme, facilitatorNotes };
      if (periodStart.value) data.periodStart = periodStart.value;
      return { data };
    },
  },
};

function trimToNull(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}

function parseOptionalDate(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return { value: null };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { error: 'Date must be a valid date' };
  }
  return { value: parsed };
}

/**
 * URL keys are hyphenated ("q3-2026", "2026-09"). The shared slug util is
 * company-specific (underscores, and it queries the Company table), so this
 * normalizes locally.
 */
function normalizeSlug(raw) {
  return String(raw ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function assetSelect() {
  return {
    id: true,
    kind: true,
    section: true,
    title: true,
    description: true,
    displayOrder: true,
    externalUrl: true,
    embedUrl: true,
    fileName: true,
    mimeType: true,
    sizeBytes: true,
  };
}

function releaseSelect(program, { includeAssets = false, includeCompanies = false } = {}) {
  return {
    id: true,
    slug: true,
    title: true,
    periodLabel: true,
    summary: true,
    body: true,
    publicSummary: true,
    isPubliclyListed: true,
    status: true,
    publishedAt: true,
    audienceScope: true,
    createdAt: true,
    updatedAt: true,
    ...program.extraSelect,
    _count: { select: { assets: true } },
    ...(includeAssets
      ? {
          assets: {
            select: assetSelect(),
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          },
        }
      : {}),
    ...(includeCompanies
      ? {
          companies: {
            select: {
              companyId: true,
              company: { select: { id: true, name: true } },
            },
          },
        }
      : {}),
    author: { select: { id: true, email: true } },
  };
}

/**
 * Group a release's assets into the program's section layout, dropping sections
 * with nothing in them so the detail page renders no empty headings.
 */
function groupAssetsBySection(program, assets) {
  const layout = SECTION_LAYOUT[program.key] || [];
  const grouped = layout
    .map(({ section, heading }) => ({
      section,
      heading,
      assets: (assets || []).filter((asset) => asset.section === section),
    }))
    .filter((group) => group.assets.length > 0);

  // An asset whose section isn't in this program's layout would otherwise
  // vanish from the page entirely. Surface it rather than silently hiding it.
  const known = new Set(layout.map((entry) => entry.section));
  const orphans = (assets || []).filter((asset) => !known.has(asset.section));
  if (orphans.length > 0) {
    grouped.push({ section: 'other', heading: 'Other materials', assets: orphans });
  }

  return grouped;
}

function shapeRelease(program, release) {
  if (!release) return null;
  const { _count, assets, ...rest } = release;
  return {
    ...rest,
    program: program.key,
    assetCount: _count?.assets ?? 0,
    ...(assets ? { sections: groupAssetsBySection(program, assets) } : {}),
  };
}

function resolveProgram(req, res) {
  const program = PROGRAMS[req.params.program];
  if (!program) {
    res.status(404).json({ error: 'Unknown program' });
    return null;
  }
  return program;
}

/**
 * Validate and assemble the shared release columns.
 * @returns {{ error: string } | { data: object, companyIds: string[] }}
 */
async function buildReleaseData(program, body, { isCreate, existing }) {
  const title = trimToNull(body?.title);
  if (!title) return { error: 'Title is required' };
  if (title.length > MAX_TITLE) {
    return { error: `Title must be ${MAX_TITLE} characters or fewer` };
  }

  const periodLabel = trimToNull(body?.periodLabel);
  if (!periodLabel) return { error: 'Period label is required' };

  const slug = normalizeSlug(body?.slug || title);
  if (!slug) return { error: 'Slug could not be derived — provide one explicitly' };

  for (const [field, value] of Object.entries({
    Summary: body?.summary,
    Body: body?.body,
    'Public summary': body?.publicSummary,
  })) {
    if (value && String(value).length > MAX_TEXT) {
      return { error: `${field} must be ${MAX_TEXT} characters or fewer` };
    }
  }

  const status = normalizeStatus(body?.status);
  const audienceScope = normalizeAudienceScope(body?.audienceScope);

  const companyIds = Array.isArray(body?.companyIds)
    ? [...new Set(body.companyIds.map((id) => String(id).trim()).filter(Boolean))]
    : [];

  if (audienceScope === 'companies' && companyIds.length === 0) {
    return { error: 'Select at least one company, or set the audience to all members' };
  }

  if (companyIds.length > 0) {
    const found = await prisma.company.count({ where: { id: { in: companyIds } } });
    if (found !== companyIds.length) {
      return { error: 'One or more selected companies no longer exist' };
    }
  }

  const extra = program.buildExtra(body || {}, { isCreate });
  if (extra.error) return { error: extra.error };

  const data = {
    slug,
    title,
    periodLabel,
    summary: trimToNull(body?.summary),
    body: trimToNull(body?.body),
    publicSummary: trimToNull(body?.publicSummary),
    isPubliclyListed: Boolean(body?.isPubliclyListed),
    status,
    audienceScope,
    ...extra.data,
  };

  // `publishedAt` answers "when did this first go out" and is never cleared, so
  // unpublishing and republishing keeps the original date. Visibility is
  // governed by `status` alone.
  if (status === 'published' && !existing?.publishedAt) {
    data.publishedAt = new Date();
  }

  return { data, companyIds: audienceScope === 'companies' ? companyIds : [] };
}

/**
 * @returns {{ error: string } | { data: object }}
 */
function buildAssetData(body, { isCreate }) {
  const title = trimToNull(body?.title);
  if (!title) return { error: 'Asset title is required' };
  if (title.length > MAX_TITLE) {
    return { error: `Asset title must be ${MAX_TITLE} characters or fewer` };
  }

  const description = trimToNull(body?.description);
  if (description && description.length > MAX_TEXT) {
    return { error: `Asset description must be ${MAX_TEXT} characters or fewer` };
  }

  const external = validateExternalUrl(body?.externalUrl);
  if (!external.ok) return { error: external.error };

  const embed = validateEmbedUrl(body?.embedUrl);
  if (!embed.ok) return { error: embed.error };

  // Phase 1 has no uploads, so a link is the only thing that can make an asset
  // actionable. Without one the card would render with nothing to click.
  if (isCreate && !external.value && !embed.value) {
    return { error: 'Add a link to the material, or an embed link for a recording' };
  }

  const displayOrderRaw = Number.parseInt(String(body?.displayOrder ?? '0'), 10);

  return {
    data: {
      kind: normalizeAssetKind(body?.kind),
      section: normalizeAssetSection(body?.section),
      title,
      description,
      externalUrl: external.value,
      embedUrl: embed.value,
      displayOrder: Number.isFinite(displayOrderRaw) ? displayOrderRaw : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Public marketing catalog
// ---------------------------------------------------------------------------

/**
 * Anonymous visitors get enough to understand what the programs produce and a
 * reason to sign in — title, period, the marketing blurb, and a breakdown of
 * what's attached. Never asset titles, never URLs, never company identifiers.
 */
router.get('/public', async (req, res) => {
  try {
    const publicSelect = (program) => ({
      slug: true,
      title: true,
      periodLabel: true,
      publicSummary: true,
      [program.dateField]: true,
      // Only `kind` is selected: enough for "2 decks, 1 recording" without
      // exposing what the materials actually are.
      assets: { select: { kind: true } },
    });

    const shapePublic = (program) => (release) => ({
      program: program.key,
      slug: release.slug,
      title: release.title,
      periodLabel: release.periodLabel,
      publicSummary: release.publicSummary,
      date: release[program.dateField] ?? null,
      assetCount: release.assets.length,
      assetKinds: [...new Set(release.assets.map((asset) => asset.kind))].sort(),
    });

    const [sessions, packages] = await Promise.all([
      PROGRAMS.ascoe.delegate().findMany({
        where: publicVisibilityWhere(),
        orderBy: [{ sessionDate: 'desc' }, { createdAt: 'desc' }],
        take: 50,
        select: publicSelect(PROGRAMS.ascoe),
      }),
      PROGRAMS.champions.delegate().findMany({
        where: publicVisibilityWhere(),
        orderBy: [{ periodStart: 'desc' }],
        take: 50,
        select: publicSelect(PROGRAMS.champions),
      }),
    ]);

    res.json({
      ascoe: sessions.map(shapePublic(PROGRAMS.ascoe)),
      champions: packages.map(shapePublic(PROGRAMS.champions)),
    });
  } catch (error) {
    console.error('Error fetching public program content catalog:', error);
    res.status(500).json({ error: 'Failed to load program content' });
  }
});

// ---------------------------------------------------------------------------
// Admin asset management
//
// Declared before `/admin/:program` so that "assets" isn't parsed as a program
// name, and `reorder` before `/admin/assets/:id` so it isn't parsed as an id.
// ---------------------------------------------------------------------------

router.put('/admin/assets/reorder', requireAuth, requireAdmin, async (req, res) => {
  try {
    const order = Array.isArray(req.body?.order) ? req.body.order : null;
    if (!order || order.length === 0) {
      return res.status(400).json({ error: 'An ordered list of asset ids is required' });
    }

    const updates = order
      .map((entry, index) => ({
        id: String(entry?.id ?? entry ?? '').trim(),
        displayOrder: Number.isFinite(Number(entry?.displayOrder))
          ? Number(entry.displayOrder)
          : index,
      }))
      .filter((entry) => entry.id);

    if (updates.length === 0) {
      return res.status(400).json({ error: 'An ordered list of asset ids is required' });
    }

    await prisma.$transaction(
      updates.map((entry) =>
        prisma.contentAsset.update({
          where: { id: entry.id },
          data: { displayOrder: entry.displayOrder },
        })
      )
    );

    res.json({ message: 'Order updated' });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'One or more assets no longer exist' });
    }
    console.error('Error reordering content assets:', error);
    res.status(500).json({ error: 'Failed to reorder assets' });
  }
});

router.post('/admin/assets', requireAuth, requireAdmin, async (req, res) => {
  try {
    const program = PROGRAMS[req.body?.program];
    if (!program) {
      return res.status(400).json({ error: 'A valid program is required' });
    }
    const releaseId = trimToNull(req.body?.releaseId);
    if (!releaseId) {
      return res.status(400).json({ error: 'A release is required' });
    }

    const release = await program.delegate().findUnique({
      where: { id: releaseId },
      select: { id: true },
    });
    if (!release) {
      return res.status(404).json({ error: `${program.label} not found` });
    }

    const built = buildAssetData(req.body, { isCreate: true });
    if (built.error) {
      return res.status(400).json({ error: built.error });
    }

    const asset = await prisma.contentAsset.create({
      data: {
        ...built.data,
        // Exactly one parent FK is ever set; the other stays null.
        [program.assetFk]: releaseId,
        uploadedBy: getAuthContext(req)?.userId || null,
      },
      select: assetSelect(),
    });

    res.status(201).json(asset);
  } catch (error) {
    console.error('Error creating content asset:', error);
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

router.put('/admin/assets/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.contentAsset.findUnique({
      where: { id: req.params.id },
      select: { id: true, storagePath: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const built = buildAssetData(req.body, { isCreate: false });
    if (built.error) {
      return res.status(400).json({ error: built.error });
    }

    // An edit may clear both links, but only if an uploaded file still backs
    // the asset — otherwise it becomes an un-clickable row.
    if (!built.data.externalUrl && !built.data.embedUrl && !existing.storagePath) {
      return res.status(400).json({
        error: 'Add a link to the material, or an embed link for a recording',
      });
    }

    const asset = await prisma.contentAsset.update({
      where: { id: req.params.id },
      data: built.data,
      select: assetSelect(),
    });

    res.json(asset);
  } catch (error) {
    console.error('Error updating content asset:', error);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

router.delete('/admin/assets/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Phase 2: unlink the stored file before dropping the row.
    await prisma.contentAsset.delete({ where: { id: req.params.id } });
    res.json({ message: 'Asset deleted' });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Asset not found' });
    }
    console.error('Error deleting content asset:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// ---------------------------------------------------------------------------
// Admin authoring — releases
// ---------------------------------------------------------------------------

router.get('/admin/:program', requireAuth, requireAdmin, async (req, res) => {
  const program = resolveProgram(req, res);
  if (!program) return;

  try {
    const status = req.query.status ? normalizeStatus(req.query.status) : null;
    // Assets are included so selecting a release in the authoring UI shows its
    // materials without a second round trip. Admin volumes are small enough
    // that the heavier payload is worth the simpler client.
    const releases = await program.delegate().findMany({
      where: status ? { status } : {},
      orderBy: [{ [program.dateField]: 'desc' }, { createdAt: 'desc' }],
      select: releaseSelect(program, { includeAssets: true, includeCompanies: true }),
    });

    res.json({ releases: releases.map((release) => shapeRelease(program, release)) });
  } catch (error) {
    console.error(`Error fetching ${program.label} list for admin:`, error);
    res.status(500).json({ error: 'Failed to load program content' });
  }
});

router.post('/admin/:program', requireAuth, requireAdmin, async (req, res) => {
  const program = resolveProgram(req, res);
  if (!program) return;

  try {
    const built = await buildReleaseData(program, req.body, { isCreate: true, existing: null });
    if (built.error) {
      return res.status(400).json({ error: built.error });
    }

    const release = await program.delegate().create({
      data: {
        ...built.data,
        createdBy: getAuthContext(req)?.userId || null,
        ...(built.companyIds.length > 0
          ? { companies: { create: built.companyIds.map((companyId) => ({ companyId })) } }
          : {}),
      },
      select: releaseSelect(program, { includeAssets: true, includeCompanies: true }),
    });

    res.status(201).json(shapeRelease(program, release));
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'That URL slug is already in use' });
    }
    console.error(`Error creating ${program.label}:`, error);
    res.status(500).json({ error: 'Failed to create program content' });
  }
});

router.get('/admin/:program/:id', requireAuth, requireAdmin, async (req, res) => {
  const program = resolveProgram(req, res);
  if (!program) return;

  try {
    const release = await program.delegate().findUnique({
      where: { id: req.params.id },
      select: releaseSelect(program, { includeAssets: true, includeCompanies: true }),
    });
    if (!release) {
      return res.status(404).json({ error: `${program.label} not found` });
    }
    res.json(shapeRelease(program, release));
  } catch (error) {
    console.error(`Error fetching ${program.label}:`, error);
    res.status(500).json({ error: 'Failed to load program content' });
  }
});

router.put('/admin/:program/:id', requireAuth, requireAdmin, async (req, res) => {
  const program = resolveProgram(req, res);
  if (!program) return;

  try {
    const existing = await program.delegate().findUnique({
      where: { id: req.params.id },
      select: { id: true, publishedAt: true },
    });
    if (!existing) {
      return res.status(404).json({ error: `${program.label} not found` });
    }

    const built = await buildReleaseData(program, req.body, { isCreate: false, existing });
    if (built.error) {
      return res.status(400).json({ error: built.error });
    }

    // Replace the audience wholesale — the form always submits the full list,
    // and a diff here would silently keep stale grants.
    const release = await program.delegate().update({
      where: { id: req.params.id },
      data: {
        ...built.data,
        companies: {
          deleteMany: {},
          ...(built.companyIds.length > 0
            ? { create: built.companyIds.map((companyId) => ({ companyId })) }
            : {}),
        },
      },
      select: releaseSelect(program, { includeAssets: true, includeCompanies: true }),
    });

    res.json(shapeRelease(program, release));
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'That URL slug is already in use' });
    }
    console.error(`Error updating ${program.label}:`, error);
    res.status(500).json({ error: 'Failed to update program content' });
  }
});

router.delete('/admin/:program/:id', requireAuth, requireAdmin, async (req, res) => {
  const program = resolveProgram(req, res);
  if (!program) return;

  try {
    // Cascades to assets, their download records, and the audience rows. Once
    // Phase 2 stores files, this handler must also unlink them from disk —
    // Prisma's cascade drops rows, not bytes.
    await program.delegate().delete({ where: { id: req.params.id } });
    res.json({ message: `${program.label} deleted` });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: `${program.label} not found` });
    }
    console.error(`Error deleting ${program.label}:`, error);
    res.status(500).json({ error: 'Failed to delete program content' });
  }
});

// ---------------------------------------------------------------------------
// Member delivery — declared last, because `/:program` and `/:program/:slug`
// would otherwise match the literal admin paths above.
// ---------------------------------------------------------------------------

router.get('/:program', requireAuth, requireVerified, async (req, res) => {
  const program = resolveProgram(req, res);
  if (!program) return;

  try {
    const auth = getAuthContext(req);
    const releases = await program.delegate().findMany({
      where: memberVisibilityWhere(auth, program.key),
      orderBy: [{ [program.dateField]: 'desc' }, { createdAt: 'desc' }],
      select: releaseSelect(program),
    });

    res.json({ releases: releases.map((release) => shapeRelease(program, release)) });
  } catch (error) {
    console.error(`Error fetching ${program.label} list:`, error);
    res.status(500).json({ error: 'Failed to load program content' });
  }
});

router.get('/:program/:slug', requireAuth, requireVerified, async (req, res) => {
  const program = resolveProgram(req, res);
  if (!program) return;

  try {
    const auth = getAuthContext(req);
    const release = await program.delegate().findUnique({
      where: { slug: req.params.slug },
      select: {
        ...releaseSelect(program, { includeAssets: true }),
        // Needed by canMemberSeeRelease; stripped before responding.
        companies: { select: { companyId: true } },
      },
    });

    // 404 rather than 403 for a release this member isn't entitled to — a 403
    // would confirm it exists.
    if (!canMemberSeeRelease(auth, release)) {
      return res.status(404).json({ error: `${program.label} not found` });
    }

    const { companies, ...visible } = release;
    void companies;
    res.json(shapeRelease(program, visible));
  } catch (error) {
    console.error(`Error fetching ${program.label}:`, error);
    res.status(500).json({ error: 'Failed to load program content' });
  }
});

export default router;
