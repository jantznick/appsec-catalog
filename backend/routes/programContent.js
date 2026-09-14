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
import fs from 'node:fs';
import multer from 'multer';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireVerified, requireAdmin } from '../middleware/auth.js';
import { getAuthContext } from '../middleware/authContext.js';
import {
  MAX_FILE_BYTES,
  validateUpload,
  writeAssetFile,
  resolveAssetPath,
  deleteAssetFile,
  deleteReleaseFiles,
  sanitizeFileName,
} from '../services/programContentStorage.js';
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
 * Uploads are buffered in memory rather than streamed to disk so the file can
 * be validated and checksummed before anything is written — a rejected upload
 * leaves nothing behind to clean up. Safe at this size cap; revisit if the
 * limit ever grows past tens of megabytes.
 *
 * multer enforces the byte cap itself, which matters: without it a large body
 * would be fully buffered before our own check could reject it.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

/** Turn multer's own errors into the same JSON shape as everything else. */
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: `File is larger than the ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB limit`,
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Upload one file at a time, in the "file" field' });
    }
    console.error('Upload error:', error);
    return res.status(400).json({ error: 'Upload failed' });
  });
}

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
function buildAssetData(body, { isCreate, hasFile = false }) {
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

  // An asset needs at least one way to reach the material — an uploaded file,
  // a link, or an embed — or it renders as a card with nothing to click.
  if (isCreate && !external.value && !embed.value && !hasFile) {
    return { error: 'Attach a file, or add a link to the material' };
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

/**
 * Create an asset, optionally with its file in the same request.
 *
 * `handleUpload` is a no-op for a JSON body (multer only touches multipart), so
 * this one route serves both a link-only create and a file create. Doing both
 * in one request is what lets "a file counts as having something to click" be
 * checked server-side.
 */
router.post('/admin/assets', requireAuth, requireAdmin, handleUpload, async (req, res) => {
  let storedPath = null;
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

    const built = buildAssetData(req.body, { isCreate: true, hasFile: Boolean(req.file) });
    if (built.error) {
      return res.status(400).json({ error: built.error });
    }

    let stored = {};
    if (req.file) {
      const validated = validateUpload(req.file);
      if (!validated.ok) {
        return res.status(400).json({ error: validated.error });
      }
      // Written before the row because the storage path depends only on
      // program + releaseId, both already known. If the insert then fails, the
      // catch below removes the file rather than leaving it unreferenced.
      stored = await writeAssetFile({
        program: program.key,
        releaseId,
        file: req.file,
        ext: validated.ext,
      });
      storedPath = stored.storagePath;
    }

    const asset = await prisma.contentAsset.create({
      data: {
        ...built.data,
        ...stored,
        // Exactly one parent FK is ever set; the other stays null.
        [program.assetFk]: releaseId,
        uploadedBy: getAuthContext(req)?.userId || null,
      },
      select: assetSelect(),
    });

    res.status(201).json(asset);
  } catch (error) {
    if (storedPath) {
      await deleteAssetFile(storedPath);
    }
    console.error('Error creating content asset:', error);
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

/**
 * Attach (or replace) the stored copy of an asset. Kept separate from the JSON
 * create/update so metadata validation lives in one place and isn't duplicated
 * across a multipart variant.
 */
router.post('/admin/assets/:id/file', requireAuth, requireAdmin, handleUpload, async (req, res) => {
  try {
    const existing = await prisma.contentAsset.findUnique({
      where: { id: req.params.id },
      select: { id: true, ascoeSessionId: true, packageId: true, storagePath: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const validated = validateUpload(req.file);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }

    const program = existing.ascoeSessionId ? 'ascoe' : 'champions';
    const releaseId = existing.ascoeSessionId || existing.packageId;
    if (!releaseId) {
      return res.status(409).json({ error: 'Asset is not attached to a release' });
    }

    const stored = await writeAssetFile({
      program,
      releaseId,
      file: req.file,
      ext: validated.ext,
    });

    const asset = await prisma.contentAsset.update({
      where: { id: existing.id },
      data: stored,
      select: assetSelect(),
    });

    // Replacing a file: drop the old bytes only after the row points at the new
    // ones, so a failure here leaks a file rather than orphaning the asset.
    if (existing.storagePath && existing.storagePath !== stored.storagePath) {
      await deleteAssetFile(existing.storagePath);
    }

    res.json(asset);
  } catch (error) {
    console.error('Error storing content asset file:', error);
    res.status(500).json({ error: 'Failed to store file' });
  }
});

/** Remove just the stored copy, keeping the asset and its links. */
router.delete('/admin/assets/:id/file', requireAuth, requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.contentAsset.findUnique({
      where: { id: req.params.id },
      select: { id: true, storagePath: true, externalUrl: true, embedUrl: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    if (!existing.storagePath) {
      return res.status(400).json({ error: 'This asset has no stored file' });
    }
    // Same rule as the metadata editor: an asset with neither a file nor a link
    // is a card with nothing to click.
    if (!existing.externalUrl && !existing.embedUrl) {
      return res.status(400).json({
        error: 'Add a link before removing the file, or delete the material entirely',
      });
    }

    const asset = await prisma.contentAsset.update({
      where: { id: existing.id },
      data: {
        storagePath: null,
        fileName: null,
        mimeType: null,
        sizeBytes: null,
        checksumSha256: null,
      },
      select: assetSelect(),
    });

    await deleteAssetFile(existing.storagePath);
    res.json(asset);
  } catch (error) {
    console.error('Error removing content asset file:', error);
    res.status(500).json({ error: 'Failed to remove file' });
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
    // Read the path before deleting: the cascade removes the row, and with it
    // the only record of which file on disk belonged to it.
    const existing = await prisma.contentAsset.findUnique({
      where: { id: req.params.id },
      select: { storagePath: true },
    });

    await prisma.contentAsset.delete({ where: { id: req.params.id } });
    if (existing?.storagePath) {
      await deleteAssetFile(existing.storagePath);
    }
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
    // The cascade takes the assets, their download records, and the audience
    // rows — but Prisma drops rows, not bytes, so the release's stored files
    // have to be removed explicitly or they orphan in the volume forever.
    await program.delegate().delete({ where: { id: req.params.id } });
    await deleteReleaseFiles(program.key, req.params.id);
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
// Member download
//
// Declared before the member `/:program` routes for the same reason as the
// admin block: "assets" must not be parsed as a program name.
// ---------------------------------------------------------------------------

/**
 * Stream a stored asset to an entitled member.
 *
 * Entitlement is re-derived from the asset's PARENT RELEASE rather than taken
 * from the asset id. An id is guessable and shareable; if this trusted it, a
 * single leaked id would bypass company scoping entirely.
 */
router.get('/assets/:id/download', requireAuth, requireVerified, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const asset = await prisma.contentAsset.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        storagePath: true,
        ascoeSession: {
          select: {
            status: true,
            audienceScope: true,
            companies: { select: { companyId: true } },
          },
        },
        package: {
          select: {
            status: true,
            audienceScope: true,
            companies: { select: { companyId: true } },
          },
        },
      },
    });

    // 404 rather than 403 throughout: a 403 would confirm the asset exists.
    if (!asset?.storagePath) {
      return res.status(404).json({ error: 'File not found' });
    }

    const release = asset.ascoeSession || asset.package;
    if (!canMemberSeeRelease(auth, release)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const absolute = resolveAssetPath(asset.storagePath);
    if (!absolute || !fs.existsSync(absolute)) {
      console.error('Content asset row points at a missing file:', asset.id, asset.storagePath);
      return res.status(404).json({ error: 'File not found' });
    }

    // Record the download before streaming. Doing it first means a client that
    // disconnects mid-transfer still counts, which is the right bias for
    // adoption data — and a logging failure must not block the download.
    prisma.contentAssetDownload
      .create({
        data: {
          assetId: asset.id,
          userId: auth?.userId || null,
          companyId: auth?.companyId || null,
        },
      })
      .catch((error) => console.error('Failed to log content asset download:', error));

    const downloadName = sanitizeFileName(asset.fileName);
    res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');
    // Always an attachment, never inline: nothing stored here should be
    // rendered by the browser in this origin's context.
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    if (asset.sizeBytes) {
      res.setHeader('Content-Length', String(asset.sizeBytes));
    }

    const stream = fs.createReadStream(absolute);
    stream.on('error', (error) => {
      console.error('Error streaming content asset:', asset.id, error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to read file' });
      } else {
        res.destroy(error);
      }
    });
    stream.pipe(res);
  } catch (error) {
    console.error('Error downloading content asset:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download file' });
    }
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
