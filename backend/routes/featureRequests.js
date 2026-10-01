import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getAuthContext } from '../middleware/authContext.js';
import {
  UPDATE_CATEGORIES,
  normalizeCategory,
  createSubmissionThrottle,
} from '../utils/productCommunication.js';

const router = express.Router();

/**
 * Triage states, in the order a request moves through them. DECLINED and
 * SHIPPED are both terminal; everything except NEW counts as triaged, which is
 * what the admin badge counts.
 */
export const REQUEST_STATUSES = [
  { key: 'NEW', label: 'New' },
  { key: 'UNDER_REVIEW', label: 'Under review' },
  { key: 'PLANNED', label: 'Planned' },
  { key: 'DECLINED', label: 'Not planned' },
  { key: 'SHIPPED', label: 'Shipped' },
];

const VALID_STATUSES = new Set(REQUEST_STATUSES.map((status) => status.key));

const MAX_TITLE_LENGTH = 200;
const MAX_DETAILS_LENGTH = 4000;
const MAX_NOTE_LENGTH = 4000;

// Submissions are authenticated, so the throttle is keyed on the user rather
// than an IP. Generous enough that nobody writing in good faith will hit it.
const isThrottled = createSubmissionThrottle({ windowMs: 60 * 60 * 1000, max: 10 });

function selectRequest() {
  return {
    id: true,
    title: true,
    details: true,
    category: true,
    status: true,
    adminNote: true,
    submitterEmail: true,
    createdAt: true,
    updatedAt: true,
    handledAt: true,
    submittedBy: { select: { id: true, email: true } },
    handledBy: { select: { id: true, email: true } },
    roadmapItem: { select: { id: true, title: true, stage: true, status: true } },
  };
}

/**
 * What the submitter is allowed to see of their own request: the content they
 * wrote, where it got to, and the admin's reply. Who handled it stays internal.
 */
function serializeForSubmitter(row) {
  return {
    id: row.id,
    title: row.title,
    details: row.details,
    category: row.category,
    status: row.status,
    adminNote: row.adminNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // Only a published roadmap item is acknowledged — otherwise promoting a
    // request would leak an unpublished plan to whoever asked for it.
    roadmapItem:
      row.roadmapItem && row.roadmapItem.status === 'published'
        ? { id: row.roadmapItem.id, title: row.roadmapItem.title, stage: row.roadmapItem.stage }
        : null,
  };
}

/** POST /api/feature-requests — signed-in users submit an idea. */
router.post('/', requireAuth, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    if (isThrottled(auth.userId)) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'You have submitted several feature requests recently. Please try again later.',
      });
    }

    const title = String(req.body?.title || '').trim();
    const details = String(req.body?.details || '').trim();

    if (!title) return res.status(400).json({ error: 'Title is required' });
    if (title.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({ error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` });
    }
    if (!details) return res.status(400).json({ error: 'Please describe what you would like to see' });
    if (details.length > MAX_DETAILS_LENGTH) {
      return res
        .status(400)
        .json({ error: `Details must be ${MAX_DETAILS_LENGTH} characters or fewer` });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, email: true },
    });
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const created = await prisma.featureRequest.create({
      data: {
        title,
        details,
        category: normalizeCategory(req.body?.category),
        submittedById: user.id,
        submitterEmail: user.email,
      },
      select: selectRequest(),
    });

    res.status(201).json({
      success: true,
      message: "Thanks — your request is with the Orbit admins.",
      request: serializeForSubmitter(created),
    });
  } catch (error) {
    console.error('Error creating feature request:', error);
    res.status(500).json({ error: 'Failed to submit feature request' });
  }
});

/** GET /api/feature-requests/mine — the requests you submitted, and their replies. */
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const requests = await prisma.featureRequest.findMany({
      where: { submittedById: auth.userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: selectRequest(),
    });

    res.json({
      requests: requests.map(serializeForSubmitter),
      statuses: REQUEST_STATUSES,
      categories: UPDATE_CATEGORIES,
    });
  } catch (error) {
    console.error('Error fetching your feature requests:', error);
    res.status(500).json({ error: 'Failed to load your feature requests' });
  }
});

// Everything below is admin-only triage.
router.use(requireAuth, requireAdmin);

/** GET /api/feature-requests?status=NEW|...|all */
router.get('/', async (req, res) => {
  try {
    const status = String(req.query.status || 'all').toUpperCase();
    const where = VALID_STATUSES.has(status) ? { status } : {};

    const requests = await prisma.featureRequest.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
      select: selectRequest(),
    });

    res.json({ requests, statuses: REQUEST_STATUSES, categories: UPDATE_CATEGORIES });
  } catch (error) {
    console.error('Error listing feature requests:', error);
    res.status(500).json({ error: 'Failed to load feature requests' });
  }
});

/** PATCH /api/feature-requests/:id — set the status and/or the reply. */
router.patch('/:id', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const existing = await prisma.featureRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Feature request not found' });

    const data = {};

    if (req.body?.status !== undefined) {
      const status = String(req.body.status).toUpperCase();
      if (!VALID_STATUSES.has(status)) {
        return res.status(400).json({ error: 'Unknown status' });
      }
      data.status = status;
      // "Handled" means someone moved it off the new pile; moving it back to
      // NEW returns it to the queue and drops the handler.
      Object.assign(
        data,
        status === 'NEW'
          ? { handledAt: null, handledById: null }
          : { handledAt: existing.handledAt || new Date(), handledById: existing.handledById || auth?.userId || null },
      );
    }

    if (req.body?.adminNote !== undefined) {
      const note = String(req.body.adminNote || '').trim();
      if (note.length > MAX_NOTE_LENGTH) {
        return res.status(400).json({ error: `Note must be ${MAX_NOTE_LENGTH} characters or fewer` });
      }
      data.adminNote = note || null;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const updated = await prisma.featureRequest.update({
      where: { id: req.params.id },
      data,
      select: selectRequest(),
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating feature request:', error);
    res.status(500).json({ error: 'Failed to update feature request' });
  }
});

/**
 * POST /api/feature-requests/:id/promote — turn a request into a roadmap item.
 *
 * The new item starts as a draft so an admin can edit the wording before it is
 * public, and the request is linked to it and moved to PLANNED. A request that
 * already has an item is returned as-is rather than spawning a duplicate.
 */
router.post('/:id/promote', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const existing = await prisma.featureRequest.findUnique({
      where: { id: req.params.id },
      select: selectRequest(),
    });
    if (!existing) return res.status(404).json({ error: 'Feature request not found' });
    if (existing.roadmapItem) {
      return res.status(409).json({
        error: 'This request is already on the roadmap',
        roadmapItem: existing.roadmapItem,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.roadmapItem.create({
        data: {
          title: existing.title,
          summary: existing.details.slice(0, 1000),
          category: existing.category,
          stage: 'PLANNED',
          status: 'draft',
          createdBy: auth?.userId || null,
        },
        select: { id: true, title: true, stage: true, status: true },
      });

      const request = await tx.featureRequest.update({
        where: { id: existing.id },
        data: {
          roadmapItemId: item.id,
          status: 'PLANNED',
          handledAt: existing.handledAt || new Date(),
          handledById: existing.handledBy?.id || auth?.userId || null,
        },
        select: selectRequest(),
      });

      return { item, request };
    });

    res.status(201).json({ request: result.request, roadmapItem: result.item });
  } catch (error) {
    console.error('Error promoting feature request:', error);
    res.status(500).json({ error: 'Failed to promote feature request' });
  }
});

/** DELETE /api/feature-requests/:id — for clearing noise. */
router.delete('/:id', async (req, res) => {
  try {
    await prisma.featureRequest.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Feature request not found' });
    }
    console.error('Error deleting feature request:', error);
    res.status(500).json({ error: 'Failed to delete feature request' });
  }
});

export default router;
