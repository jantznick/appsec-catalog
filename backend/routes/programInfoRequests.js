import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getAuthContext } from '../middleware/authContext.js';

const router = express.Router();

/**
 * Canonical list of programs a visitor can express interest in. This is the
 * single source of truth — the public options endpoint below serves it to the
 * request modal, and submissions are validated against it, so the two can't
 * drift apart.
 *
 * `docPage` maps a documentation slug to the program it describes, so the modal
 * can pre-select whatever the reader was actually looking at.
 */
const PROGRAM_OPTIONS = [
  {
    key: 'exposure-management',
    label: 'Exposure Management (overall)',
    description: 'The full service — everything below, plus onboarding to Orbit.',
  },
  {
    key: 'appsec-program',
    label: 'AppSec Program',
    description: 'The application security lifecycle, policy baseline, and maturity tracking.',
    docPage: ['program-overview', 'program-policy-baseline', 'program-samm', 'program-glossary'],
  },
  {
    key: 'ascoe',
    label: 'AppSec Center of Excellence',
    description: 'The quarterly cross-company AppSec gathering.',
    docPage: ['program-center-of-excellence'],
  },
  {
    key: 'security-champions',
    label: 'Security Champions Program',
    description: 'Turnkey monthly content for running your own champions meetings.',
    docPage: ['program-security-champions'],
  },
  { key: 'penetration-testing', label: 'Penetration Testing', description: 'Available for an additional fee.' },
  { key: 'vulnerability-management', label: 'Vulnerability Management' },
  { key: 'data-security', label: 'Data Security' },
  { key: 'domain-security', label: 'Domain Security Monitoring', docPage: ['domains'] },
];

const VALID_KEYS = new Set(PROGRAM_OPTIONS.map((p) => p.key));

const MAX_MESSAGE_LENGTH = 2000;
const MAX_EMAIL_LENGTH = 254; // RFC 5321 practical maximum

// This is the only public write endpoint in the app, so it gets a small
// in-process throttle to keep a bad actor (or a stuck retry loop) from filling
// the table. Deliberately simple: the cap is per-IP and resets on restart,
// which is proportionate for an internal tool. If this ever needs to hold up
// under real abuse, move it to a shared store alongside a proper rate limiter.
const SUBMIT_WINDOW_MS = 60 * 60 * 1000;
const SUBMIT_MAX_PER_WINDOW = 5;
const submitLog = new Map(); // ip -> number[] (timestamps)

function isRateLimited(ip) {
  const now = Date.now();
  const hits = (submitLog.get(ip) || []).filter((t) => now - t < SUBMIT_WINDOW_MS);
  if (hits.length >= SUBMIT_MAX_PER_WINDOW) {
    submitLog.set(ip, hits);
    return true;
  }
  hits.push(now);
  submitLog.set(ip, hits);
  // Opportunistically drop stale entries so the map doesn't grow unbounded.
  if (submitLog.size > 5000) {
    for (const [key, times] of submitLog) {
      if (!times.some((t) => now - t < SUBMIT_WINDOW_MS)) submitLog.delete(key);
    }
  }
  return false;
}

function serialize(row) {
  return {
    id: row.id,
    email: row.email,
    message: row.message,
    programs: String(row.programs || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    sourcePage: row.sourcePage,
    status: row.status,
    createdAt: row.createdAt,
    handledAt: row.handledAt,
    handledBy: row.handledBy ? { id: row.handledBy.id, email: row.handledBy.email } : null,
  };
}

/** GET /api/program-requests/options — public; drives the request modal. */
router.get('/options', (req, res) => {
  res.json({ programs: PROGRAM_OPTIONS });
});

/**
 * POST /api/program-requests — public, no auth.
 * Submitted from the documentation site by people who don't have access yet.
 */
router.post('/', async (req, res) => {
  try {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'You have submitted several requests recently. Please try again later.',
      });
    }

    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const programs = Array.isArray(req.body?.programs) ? req.body.programs : [];
    const sourcePage = typeof req.body?.sourcePage === 'string' ? req.body.sourcePage.trim() : '';
    const requestType = typeof req.body?.requestType === 'string' ? req.body.requestType.trim().toUpperCase() : 'PROGRAM_INFO';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (email.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` });
    }

    // Account-access requests reuse this table (no dedicated model). They are
    // tagged with sourcePage='account-request' and carry the requester's name in
    // the message, since there is no name column. The `programs` field is
    // required (non-null), so it gets the same sentinel tag rather than a
    // program key.
    if (requestType === 'ACCOUNT') {
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      if (name.length > 200) {
        return res.status(400).json({ error: 'Name must be 200 characters or fewer' });
      }
      const composed = `Name: ${name}${message ? `\n\n${message}` : ''}`.slice(0, MAX_MESSAGE_LENGTH * 3);
      // Dedupe against this requester's own untriaged account request only, so a
      // pending program-info request from the same email is left untouched.
      const existing = await prisma.programInfoRequest.findFirst({
        where: { email, status: 'NEW', sourcePage: 'account-request' },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        await prisma.programInfoRequest.update({
          where: { id: existing.id },
          data: { message: composed },
        });
      } else {
        await prisma.programInfoRequest.create({
          data: {
            email,
            message: composed,
            programs: 'account-request',
            sourcePage: 'account-request',
          },
        });
      }
      return res.status(201).json({
        success: true,
        message: "Thanks — your account request has been submitted. An administrator will review it.",
      });
    }

    const selected = [...new Set(programs.filter((k) => VALID_KEYS.has(k)))];
    if (selected.length === 0) {
      return res.status(400).json({ error: 'Select at least one program you would like to hear about' });
    }

    // Collapse repeat submissions: if this email already has an untriaged
    // request in, update it rather than handing admins duplicates to work
    // through. The response is the same either way so the sender can't tell
    // whether a prior request exists.
    const existing = await prisma.programInfoRequest.findFirst({
      where: { email, status: 'NEW' },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const merged = [
        ...new Set([...existing.programs.split(',').map((k) => k.trim()).filter(Boolean), ...selected]),
      ];
      // Keep both messages when someone follows up with something new —
      // overwriting would silently drop what they said the first time.
      let mergedMessage = existing.message;
      if (message && message !== existing.message) {
        mergedMessage = existing.message ? `${existing.message}\n\n---\n\n${message}` : message;
      }
      await prisma.programInfoRequest.update({
        where: { id: existing.id },
        data: {
          programs: merged.join(','),
          message: mergedMessage ? mergedMessage.slice(0, MAX_MESSAGE_LENGTH * 3) : null,
          sourcePage: sourcePage || existing.sourcePage,
        },
      });
    } else {
      await prisma.programInfoRequest.create({
        data: {
          email,
          message: message || null,
          programs: selected.join(','),
          sourcePage: sourcePage || null,
        },
      });
    }

    return res.status(201).json({
      success: true,
      message: "Thanks — we've got your request and will be in touch.",
    });
  } catch (error) {
    console.error('Error creating program info request:', error);
    return res.status(500).json({ error: 'Failed to submit request' });
  }
});

// Everything below is admin-only triage.
router.use(requireAuth, requireAdmin);

/** GET /api/program-requests/count — number of untriaged requests (badge poll). */
router.get('/count', async (req, res) => {
  try {
    const count = await prisma.programInfoRequest.count({ where: { status: 'NEW' } });
    res.json({ count });
  } catch (error) {
    console.error('Error counting program info requests:', error);
    res.status(500).json({ error: 'Failed to count requests' });
  }
});

/** GET /api/program-requests?status=NEW|HANDLED|all */
router.get('/', async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : 'ALL';
    const where = status === 'NEW' || status === 'HANDLED' ? { status } : {};

    const requests = await prisma.programInfoRequest.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { handledBy: { select: { id: true, email: true } } },
      take: 500,
    });

    res.json({ requests: requests.map(serialize), programs: PROGRAM_OPTIONS });
  } catch (error) {
    console.error('Error listing program info requests:', error);
    res.status(500).json({ error: 'Failed to load requests' });
  }
});

/** PATCH /api/program-requests/:id — mark handled, or reopen. */
router.patch('/:id', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const status = String(req.body?.status || '').toUpperCase();
    if (status !== 'NEW' && status !== 'HANDLED') {
      return res.status(400).json({ error: 'status must be NEW or HANDLED' });
    }

    const existing = await prisma.programInfoRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const updated = await prisma.programInfoRequest.update({
      where: { id: req.params.id },
      data:
        status === 'HANDLED'
          ? { status, handledAt: new Date(), handledById: auth?.userId || null }
          : { status, handledAt: null, handledById: null },
      include: { handledBy: { select: { id: true, email: true } } },
    });

    res.json(serialize(updated));
  } catch (error) {
    console.error('Error updating program info request:', error);
    res.status(500).json({ error: 'Failed to update request' });
  }
});

/** DELETE /api/program-requests/:id — for clearing spam. */
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.programInfoRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Request not found' });
    }
    await prisma.programInfoRequest.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting program info request:', error);
    res.status(500).json({ error: 'Failed to delete request' });
  }
});

export default router;
