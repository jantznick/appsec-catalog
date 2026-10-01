import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getAuthContext } from '../middleware/authContext.js';
import { UPDATE_CATEGORIES, normalizeCategory } from '../utils/productCommunication.js';

const router = express.Router();

/**
 * The roadmap columns, in the order they're read left to right. Exposed on
 * every response so the client renders whatever the server believes in rather
 * than keeping its own copy of the list.
 */
export const ROADMAP_STAGES = [
  { key: 'EXPLORING', label: 'Exploring', description: 'Being scoped — not committed to yet.' },
  { key: 'PLANNED', label: 'Planned', description: 'Committed, waiting its turn.' },
  { key: 'IN_PROGRESS', label: 'In progress', description: 'Actively being built.' },
  { key: 'SHIPPED', label: 'Shipped', description: 'Live in Orbit.' },
];

/**
 * The finer-grained delivery states an IN_PROGRESS item can be in. Null — the
 * default — just means "being built". SCHEDULED_RELEASE is the only one that
 * carries a date, and that date is optional: an admin can say something is
 * scheduled before the day is nailed down.
 */
export const ROADMAP_PROGRESS_STATES = [
  { key: 'BETA_TESTING', label: 'In beta testing' },
  { key: 'HTS_TESTING', label: 'In HTS testing' },
  { key: 'SCHEDULED_RELEASE', label: 'Scheduled for production release' },
];

const VALID_STAGES = new Set(ROADMAP_STAGES.map((stage) => stage.key));
const VALID_PROGRESS_STATES = new Set(ROADMAP_PROGRESS_STATES.map((state) => state.key));
const VALID_STATUSES = new Set(['draft', 'published']);

const MAX_TITLE_LENGTH = 200;
const MAX_SUMMARY_LENGTH = 1000;
const MAX_BODY_LENGTH = 20000;
const MAX_TARGET_LABEL_LENGTH = 60;

function normalizeStage(stage) {
  const normalized = String(stage || 'EXPLORING').trim().toUpperCase();
  return VALID_STAGES.has(normalized) ? normalized : 'EXPLORING';
}

function normalizeStatus(status) {
  const normalized = String(status || 'draft').trim().toLowerCase();
  return VALID_STATUSES.has(normalized) ? normalized : 'draft';
}

function normalizeProgressState(progressState) {
  const normalized = String(progressState || '').trim().toUpperCase();
  return VALID_PROGRESS_STATES.has(normalized) ? normalized : null;
}

/**
 * The progress state and its date only exist inside IN_PROGRESS, and the date
 * only inside SCHEDULED_RELEASE. Deriving both here means a card can never
 * show "scheduled for 12 March" next to a stage that has moved on.
 */
function deliveryPatch(stage, { progressState, scheduledReleaseAt }) {
  if (stage !== 'IN_PROGRESS') {
    return { progressState: null, scheduledReleaseAt: null };
  }

  const state = normalizeProgressState(progressState);
  if (state !== 'SCHEDULED_RELEASE') {
    return { progressState: state, scheduledReleaseAt: null };
  }

  const date = scheduledReleaseAt ? new Date(scheduledReleaseAt) : null;
  return {
    progressState: state,
    scheduledReleaseAt: date && !Number.isNaN(date.getTime()) ? date : null,
  };
}

function selectRoadmapItem() {
  return {
    id: true,
    title: true,
    summary: true,
    body: true,
    category: true,
    stage: true,
    targetLabel: true,
    progressState: true,
    scheduledReleaseAt: true,
    sortOrder: true,
    status: true,
    shippedAt: true,
    linkedUpdateId: true,
    createdAt: true,
    updatedAt: true,
    linkedUpdate: {
      select: { id: true, title: true, status: true, publishedAt: true },
    },
    author: {
      select: { id: true, email: true },
    },
  };
}

/**
 * Items sort by their manual position first so an admin can pin the important
 * work to the top of a column; `updatedAt` breaks ties, which keeps freshly
 * touched items near the top of an untouched ordering.
 */
function roadmapOrderBy() {
  return [{ sortOrder: 'asc' }, { updatedAt: 'desc' }];
}

/** Read the body fields shared by create and update, or return an error string. */
function readItemInput(body) {
  const title = String(body?.title || '').trim();
  const summary = String(body?.summary || '').trim();

  if (!title) return { error: 'Title is required' };
  if (title.length > MAX_TITLE_LENGTH) {
    return { error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` };
  }
  if (!summary) return { error: 'Summary is required' };
  if (summary.length > MAX_SUMMARY_LENGTH) {
    return { error: `Summary must be ${MAX_SUMMARY_LENGTH} characters or fewer` };
  }

  const detail = String(body?.body || '').trim();
  if (detail.length > MAX_BODY_LENGTH) {
    return { error: `Details must be ${MAX_BODY_LENGTH} characters or fewer` };
  }

  const targetLabel = String(body?.targetLabel || '').trim();
  if (targetLabel.length > MAX_TARGET_LABEL_LENGTH) {
    return { error: `Target must be ${MAX_TARGET_LABEL_LENGTH} characters or fewer` };
  }

  const sortOrderRaw = Number.parseInt(String(body?.sortOrder ?? '0'), 10);

  return {
    data: {
      title,
      summary,
      body: detail || null,
      category: normalizeCategory(body?.category),
      stage: normalizeStage(body?.stage),
      status: normalizeStatus(body?.status),
      targetLabel: targetLabel || null,
      ...deliveryPatch(normalizeStage(body?.stage), {
        progressState: body?.progressState,
        scheduledReleaseAt: body?.scheduledReleaseAt,
      }),
      sortOrder: Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0,
      linkedUpdateId: String(body?.linkedUpdateId || '').trim() || null,
    },
  };
}

/**
 * `shippedAt` is derived, never submitted: it's stamped the first time an item
 * lands in SHIPPED and cleared if it moves back out, so a card can't claim a
 * ship date for work that isn't shipped.
 */
function shippedAtPatch(nextStage, existing) {
  if (nextStage === 'SHIPPED') {
    return existing?.shippedAt ? {} : { shippedAt: new Date() };
  }
  return existing?.shippedAt ? { shippedAt: null } : {};
}

/** Reject a linked update that doesn't exist, so the FK error never surfaces. */
async function assertLinkedUpdateExists(linkedUpdateId) {
  if (!linkedUpdateId) return true;
  const update = await prisma.productUpdate.findUnique({
    where: { id: linkedUpdateId },
    select: { id: true },
  });
  return Boolean(update);
}

// GET /api/roadmap — published items for any signed-in user.
router.get('/', requireAuth, async (req, res) => {
  try {
    const items = await prisma.roadmapItem.findMany({
      where: { status: 'published' },
      orderBy: roadmapOrderBy(),
      select: selectRoadmapItem(),
    });

    // A linked release note that is itself still a draft shouldn't leak out
    // through the roadmap, so the link is dropped unless the note is live.
    const visible = items.map((item) => ({
      ...item,
      linkedUpdate:
        item.linkedUpdate && item.linkedUpdate.status === 'published' ? item.linkedUpdate : null,
    }));

    res.json({ items: visible, stages: ROADMAP_STAGES, progressStates: ROADMAP_PROGRESS_STATES, categories: UPDATE_CATEGORIES });
  } catch (error) {
    console.error('Error fetching roadmap:', error);
    res.status(500).json({ error: 'Failed to load the roadmap' });
  }
});

// Everything below is admin-only authoring.
router.use(requireAuth, requireAdmin);

// GET /api/roadmap/admin — every item, drafts included.
router.get('/admin', async (req, res) => {
  try {
    const status = req.query.status ? normalizeStatus(req.query.status) : null;
    const items = await prisma.roadmapItem.findMany({
      where: status ? { status } : {},
      orderBy: roadmapOrderBy(),
      select: selectRoadmapItem(),
    });

    res.json({ items, stages: ROADMAP_STAGES, progressStates: ROADMAP_PROGRESS_STATES, categories: UPDATE_CATEGORIES });
  } catch (error) {
    console.error('Error fetching roadmap for admin:', error);
    res.status(500).json({ error: 'Failed to load the roadmap' });
  }
});

router.post('/admin', async (req, res) => {
  try {
    const { error, data } = readItemInput(req.body || {});
    if (error) return res.status(400).json({ error });

    if (!(await assertLinkedUpdateExists(data.linkedUpdateId))) {
      return res.status(400).json({ error: 'Linked product update not found' });
    }

    const item = await prisma.roadmapItem.create({
      data: {
        ...data,
        ...shippedAtPatch(data.stage, null),
        createdBy: getAuthContext(req)?.userId || null,
      },
      select: selectRoadmapItem(),
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Error creating roadmap item:', error);
    res.status(500).json({ error: 'Failed to create roadmap item' });
  }
});

router.put('/admin/:id', async (req, res) => {
  try {
    const existing = await prisma.roadmapItem.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Roadmap item not found' });

    const { error, data } = readItemInput(req.body || {});
    if (error) return res.status(400).json({ error });

    if (!(await assertLinkedUpdateExists(data.linkedUpdateId))) {
      return res.status(400).json({ error: 'Linked product update not found' });
    }

    const item = await prisma.roadmapItem.update({
      where: { id: req.params.id },
      data: { ...data, ...shippedAtPatch(data.stage, existing) },
      select: selectRoadmapItem(),
    });

    res.json(item);
  } catch (error) {
    console.error('Error updating roadmap item:', error);
    res.status(500).json({ error: 'Failed to update roadmap item' });
  }
});

/**
 * PATCH /api/roadmap/admin/:id — move an item without opening the editor.
 * Accepts any subset of { stage, status, sortOrder }; the board uses it for
 * stage changes and the list for publish/unpublish.
 */
router.patch('/admin/:id', async (req, res) => {
  try {
    const existing = await prisma.roadmapItem.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Roadmap item not found' });

    const data = {};
    if (req.body?.status !== undefined) data.status = normalizeStatus(req.body.status);
    if (req.body?.sortOrder !== undefined) {
      const sortOrder = Number.parseInt(String(req.body.sortOrder), 10);
      if (Number.isFinite(sortOrder)) data.sortOrder = sortOrder;
    }
    if (req.body?.stage !== undefined) data.stage = normalizeStage(req.body.stage);

    // A stage change can invalidate the delivery state on its own (moving out
    // of IN_PROGRESS), so the two are always recomputed together.
    const stage = data.stage || existing.stage;
    const touchesDelivery =
      req.body?.stage !== undefined ||
      req.body?.progressState !== undefined ||
      req.body?.scheduledReleaseAt !== undefined;

    if (touchesDelivery) {
      Object.assign(
        data,
        deliveryPatch(stage, {
          progressState:
            req.body?.progressState !== undefined ? req.body.progressState : existing.progressState,
          scheduledReleaseAt:
            req.body?.scheduledReleaseAt !== undefined
              ? req.body.scheduledReleaseAt
              : existing.scheduledReleaseAt,
        }),
      );
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const item = await prisma.roadmapItem.update({
      where: { id: req.params.id },
      data: { ...data, ...shippedAtPatch(stage, existing) },
      select: selectRoadmapItem(),
    });

    res.json(item);
  } catch (error) {
    console.error('Error patching roadmap item:', error);
    res.status(500).json({ error: 'Failed to update roadmap item' });
  }
});

/**
 * POST /api/roadmap/admin/reorder — rewrite the manual order of one column.
 * The client sends the ids in their new top-to-bottom order; positions are
 * written as 0..n-1 in a transaction so a half-applied reorder can't leave two
 * items fighting over the same slot.
 */
router.post('/admin/reorder', async (req, res) => {
  try {
    const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds : [];
    if (orderedIds.length === 0) {
      return res.status(400).json({ error: 'orderedIds is required' });
    }

    const ids = orderedIds.map((id) => String(id)).slice(0, 500);
    const found = await prisma.roadmapItem.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      return res.status(400).json({ error: 'One or more roadmap items no longer exist' });
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.roadmapItem.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering roadmap items:', error);
    res.status(500).json({ error: 'Failed to reorder roadmap items' });
  }
});

router.delete('/admin/:id', async (req, res) => {
  try {
    await prisma.roadmapItem.delete({ where: { id: req.params.id } });
    res.json({ message: 'Roadmap item deleted successfully' });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Roadmap item not found' });
    }
    console.error('Error deleting roadmap item:', error);
    res.status(500).json({ error: 'Failed to delete roadmap item' });
  }
});

export default router;
