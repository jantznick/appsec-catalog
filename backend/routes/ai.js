/**
 * AI admin + status routes.
 *
 * Admin (requireAdmin): global config, price book, per-company access rules,
 * and usage/cost rollups. Authenticated: availability check (does my company
 * have AI for a feature?) and a company-scoped usage view.
 */
import express from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { getAuthContext } from '../middleware/authContext.js';
import { prisma } from '../prisma/client.js';
import {
  getAiConfig,
  updateAiConfig,
  listPricing,
  setPricing,
  listAccessRules,
  setCompanyAccess,
  getUsageSummary,
  listRecentRequests,
  resolveAccess,
  isAiConfigured,
  listFeatures,
} from '../services/ai/index.js';

const router = express.Router();

// ---- Config ---------------------------------------------------------------

// Global AI config + whether the server has an API key + feature registry.
router.get('/config', requireAdmin, async (req, res) => {
  try {
    const config = await getAiConfig();
    res.json({
      config,
      configured: isAiConfigured(config.defaultProvider),
      providerKeys: {
        anthropic: isAiConfigured('anthropic'),
        openai: isAiConfigured('openai'),
      },
      features: listFeatures(),
    });
  } catch (error) {
    console.error('Get AI config error:', error);
    res.status(500).json({ error: 'Failed to load AI config' });
  }
});

router.put('/config', requireAdmin, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const config = await updateAiConfig(req.body || {}, auth?.userId || null);
    res.json({
      config,
      configured: isAiConfigured(config.defaultProvider),
      providerKeys: {
        anthropic: isAiConfigured('anthropic'),
        openai: isAiConfigured('openai'),
      },
    });
  } catch (error) {
    console.error('Update AI config error:', error);
    res.status(error.status || 400).json({ error: 'Failed to update AI config', message: error.message });
  }
});

// ---- Pricing --------------------------------------------------------------

router.get('/pricing', requireAdmin, async (req, res) => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    res.json(await listPricing({ activeOnly }));
  } catch (error) {
    console.error('List AI pricing error:', error);
    res.status(500).json({ error: 'Failed to load pricing' });
  }
});

// Set the current price for a provider/model (closes the old row, inserts new).
router.post('/pricing', requireAdmin, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const row = await setPricing(req.body || {}, auth?.userId || null);
    res.status(201).json(row);
  } catch (error) {
    console.error('Set AI pricing error:', error);
    res.status(error.status || 400).json({ error: 'Failed to save pricing', message: error.message });
  }
});

// ---- Access rules ---------------------------------------------------------

// All access rules + the list of companies (so the admin UI can add rules).
router.get('/access', requireAdmin, async (req, res) => {
  try {
    const [rules, companies, config] = await Promise.all([
      listAccessRules(),
      prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      getAiConfig(),
    ]);
    res.json({
      rules,
      companies,
      globalDefault: { provider: config.defaultProvider, model: config.defaultModel },
      providerKeys: {
        anthropic: isAiConfigured('anthropic'),
        openai: isAiConfigured('openai'),
      },
    });
  } catch (error) {
    console.error('List AI access error:', error);
    res.status(500).json({ error: 'Failed to load access rules' });
  }
});

// Create/update the company-wide access rule.
router.put('/access/:companyId', requireAdmin, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const rule = await setCompanyAccess(req.params.companyId, req.body || {}, auth?.userId || null);
    res.json(rule);
  } catch (error) {
    console.error('Set AI access error:', error);
    res.status(error.status || 400).json({ error: 'Failed to update access', message: error.message });
  }
});

// ---- Usage ----------------------------------------------------------------

// Admin: instance-wide (or per-company via ?companyId) usage rollup.
router.get('/usage', requireAdmin, async (req, res) => {
  try {
    const { from, to, companyId, status } = req.query;
    const [summary, recent] = await Promise.all([
      getUsageSummary({ companyId: companyId || null, from, to, status: status || 'success' }),
      listRecentRequests({ companyId: companyId || null, limit: req.query.limit }),
    ]);
    res.json({ summary, recent });
  } catch (error) {
    console.error('AI usage error:', error);
    res.status(500).json({ error: 'Failed to load usage' });
  }
});

// Company member: usage scoped to their own company (future dashboard #2).
router.get('/usage/mine', requireAuth, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    if (!auth?.companyId) {
      return res.json({ summary: null, recent: [], message: 'No company associated with your account' });
    }
    const { from, to } = req.query;
    const [summary, recent] = await Promise.all([
      getUsageSummary({ companyId: auth.companyId, from, to }),
      listRecentRequests({ companyId: auth.companyId, limit: req.query.limit }),
    ]);
    res.json({ summary, recent });
  } catch (error) {
    console.error('AI usage (mine) error:', error);
    res.status(500).json({ error: 'Failed to load usage' });
  }
});

// ---- Availability ---------------------------------------------------------

// Is a feature available to the caller for a given application? Used by feature
// UIs (e.g. the threat-model co-pilot) to show/hide the "Draft with AI" action.
router.get('/availability', requireAuth, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const feature = req.query.feature || null;
    let companyId = req.query.companyId || auth?.companyId || null;

    // Resolve companyId from an application when provided (admins act cross-company).
    if (req.query.applicationId) {
      const app = await prisma.application.findUnique({
        where: { id: req.query.applicationId },
        select: { companyId: true },
      });
      if (app) companyId = app.companyId;
    }

    const decision = await resolveAccess({ companyId, userId: auth?.userId || null, feature });
    // Fail closed if the company's resolved provider has no credential.
    const resolvedProvider = decision.rule?.provider || decision.config?.defaultProvider;
    if (!isAiConfigured(resolvedProvider)) {
      return res.json({ available: false, reason: 'ai_not_configured' });
    }
    res.json({ available: decision.allowed, reason: decision.reason });
  } catch (error) {
    console.error('AI availability error:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

export default router;
