import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getAuthContext } from '../middleware/authContext.js';

const router = express.Router();

const VALID_STATUSES = new Set(['draft', 'published']);
const VALID_CATEGORIES = new Set([
  'Feature',
  'Improvement',
  'Fix',
  'Security',
  'Admin',
  'Integration',
  'Deployment',
]);

function normalizeStatus(status) {
  const normalized = String(status || 'draft').trim().toLowerCase();
  return VALID_STATUSES.has(normalized) ? normalized : 'draft';
}

function normalizeCategory(category) {
  const normalized = String(category || 'Improvement').trim();
  return VALID_CATEGORIES.has(normalized) ? normalized : 'Improvement';
}

function normalizeRelatedCommits(relatedCommits) {
  if (!Array.isArray(relatedCommits)) {
    return [];
  }

  return relatedCommits
    .map((commit) => ({
      hash: String(commit?.hash || '').trim(),
      shortHash: String(commit?.shortHash || '').trim(),
      subject: String(commit?.subject || '').trim(),
      authorName: String(commit?.authorName || '').trim(),
      authorEmail: String(commit?.authorEmail || '').trim(),
      committedAt: commit?.committedAt ? String(commit.committedAt) : null,
    }))
    .filter((commit) => commit.hash || commit.shortHash || commit.subject)
    .slice(0, 25);
}

function selectProductUpdate() {
  return {
    id: true,
    title: true,
    summary: true,
    body: true,
    category: true,
    status: true,
    releaseLabel: true,
    relatedCommits: true,
    publishedAt: true,
    createdAt: true,
    updatedAt: true,
    author: {
      select: {
        id: true,
        email: true,
      },
    },
  };
}

function buildOrderBy(status) {
  if (status === 'published') {
    return [{ publishedAt: 'desc' }, { createdAt: 'desc' }];
  }
  return [{ updatedAt: 'desc' }, { createdAt: 'desc' }];
}

// Published product updates for signed-in users.
router.get('/published', requireAuth, async (req, res) => {
  try {
    const limitParam = Number.parseInt(String(req.query.limit || '50'), 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;

    const updates = await prisma.productUpdate.findMany({
      where: {
        status: 'published',
        publishedAt: { not: null },
      },
      orderBy: buildOrderBy('published'),
      take: limit,
      select: selectProductUpdate(),
    });

    res.json({ updates });
  } catch (error) {
    console.error('Error fetching published product updates:', error);
    res.status(500).json({ error: 'Failed to fetch product updates' });
  }
});

// Admin list, optionally filtered by status.
router.get('/admin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const status = req.query.status ? normalizeStatus(req.query.status) : null;
    const updates = await prisma.productUpdate.findMany({
      where: status ? { status } : {},
      orderBy: buildOrderBy(status),
      select: selectProductUpdate(),
    });

    res.json({ updates });
  } catch (error) {
    console.error('Error fetching product updates for admin:', error);
    res.status(500).json({ error: 'Failed to fetch product updates' });
  }
});

router.post('/admin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, summary, body, category, status, releaseLabel, relatedCommits } = req.body || {};
    const cleanTitle = String(title || '').trim();
    const cleanSummary = String(summary || '').trim();

    if (!cleanTitle) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!cleanSummary) {
      return res.status(400).json({ error: 'Summary is required' });
    }

    const cleanStatus = normalizeStatus(status);
    const now = new Date();
    const update = await prisma.productUpdate.create({
      data: {
        title: cleanTitle,
        summary: cleanSummary,
        body: String(body || '').trim() || null,
        category: normalizeCategory(category),
        status: cleanStatus,
        releaseLabel: String(releaseLabel || '').trim() || null,
        relatedCommits: normalizeRelatedCommits(relatedCommits),
        createdBy: getAuthContext(req)?.userId || null,
        publishedAt: cleanStatus === 'published' ? now : null,
      },
      select: selectProductUpdate(),
    });

    res.status(201).json(update);
  } catch (error) {
    console.error('Error creating product update:', error);
    res.status(500).json({ error: 'Failed to create product update' });
  }
});

router.put('/admin/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.productUpdate.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Product update not found' });
    }

    const { title, summary, body, category, status, releaseLabel, relatedCommits } = req.body || {};
    const cleanTitle = String(title || '').trim();
    const cleanSummary = String(summary || '').trim();

    if (!cleanTitle) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!cleanSummary) {
      return res.status(400).json({ error: 'Summary is required' });
    }

    const cleanStatus = normalizeStatus(status);
    const shouldSetPublishedAt = cleanStatus === 'published' && !existing.publishedAt;
    const shouldClearPublishedAt = cleanStatus !== 'published';

    const update = await prisma.productUpdate.update({
      where: { id },
      data: {
        title: cleanTitle,
        summary: cleanSummary,
        body: String(body || '').trim() || null,
        category: normalizeCategory(category),
        status: cleanStatus,
        releaseLabel: String(releaseLabel || '').trim() || null,
        relatedCommits: normalizeRelatedCommits(relatedCommits),
        ...(shouldSetPublishedAt ? { publishedAt: new Date() } : {}),
        ...(shouldClearPublishedAt ? { publishedAt: null } : {}),
      },
      select: selectProductUpdate(),
    });

    res.json(update);
  } catch (error) {
    console.error('Error updating product update:', error);
    res.status(500).json({ error: 'Failed to update product update' });
  }
});

router.delete('/admin/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.productUpdate.delete({ where: { id } });
    res.json({ message: 'Product update deleted successfully' });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Product update not found' });
    }
    console.error('Error deleting product update:', error);
    res.status(500).json({ error: 'Failed to delete product update' });
  }
});

export default router;
