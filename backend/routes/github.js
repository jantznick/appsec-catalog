import express from 'express';
import crypto from 'node:crypto';
import { prisma } from '../prisma/client.js';
import { requireAuth } from '../middleware/auth.js';
import { getAuthContext } from '../middleware/authContext.js';
import { encryptIntegrationPayload } from '../utils/integrationCrypto.js';
import { integrationLog } from '../integrations/log.js';
import { PROVIDER_GITHUB } from '../integrations/constants.js';
import {
  isGithubConfigured,
  buildInstallUrl,
  exchangeOAuthCode,
  listInstallationRepos,
  fetchRepoIntel,
  saveRepoDependencies,
} from '../services/github.js';

const router = express.Router();

function frontendBase() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/** Redirect back to the Integration settings page with a status flag. */
function redirectToSettings(res, status) {
  res.redirect(`${frontendBase()}/settings/integrations?github=${status}`);
}

/** Load the caller's GitHub connection, or send a 400. Returns null if none. */
async function getCallerConnection(req, res) {
  const { userId } = getAuthContext(req);
  const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
  if (!connection) {
    res.status(400).json({
      error: 'GitHub not connected',
      message: 'Connect your GitHub account before linking repositories.',
    });
    return null;
  }
  return connection;
}

/** Serialize a repo's cached intel for the UI (no secrets). */
function serializeRepo(repo) {
  if (!repo) return null;
  return {
    id: repo.id,
    githubRepoId: repo.githubRepoId,
    fullName: repo.fullName,
    owner: repo.owner,
    name: repo.name,
    htmlUrl: repo.htmlUrl,
    defaultBranch: repo.defaultBranch,
    description: repo.description,
    isPrivate: repo.isPrivate,
    topics: repo.topics || [],
    license: repo.license,
    languages: repo.languages || {},
    lastSyncedAt: repo.lastSyncedAt,
    dependencies: (repo.dependencies || []).map((d) => ({
      ecosystem: d.ecosystem,
      name: d.name,
      version: d.version,
      versionRange: d.versionRange,
      isFramework: d.isFramework,
      framework: d.framework,
      source: d.source,
    })),
  };
}

/**
 * GET /api/integrations/github/status — the caller's connection state (no secrets).
 */
router.get('/integrations/github/status', requireAuth, async (req, res) => {
  const { userId } = getAuthContext(req);
  const connection = await prisma.gitHubConnection.findUnique({ where: { userId } });
  res.json({
    configured: isGithubConfigured(),
    connected: Boolean(connection),
    login: connection?.githubLogin ?? null,
    avatarUrl: connection?.avatarUrl ?? null,
    connectedAt: connection?.createdAt ?? null,
  });
});

/**
 * GET /api/integrations/github/connect — start the GitHub App install/OAuth flow.
 */
router.get('/integrations/github/connect', requireAuth, async (req, res) => {
  if (!isGithubConfigured()) {
    return res.status(503).json({ error: 'GitHub App is not configured' });
  }
  try {
    const state = crypto.randomBytes(24).toString('hex');
    const installUrl = buildInstallUrl(state); // may throw (503) if slug missing — before session write
    req.session.githubOAuthState = state;
    // Persist the session before redirecting so the state survives the round-trip.
    req.session.save((err) => {
      if (err) {
        console.error('Failed to persist GitHub OAuth state:', err);
        return res.status(500).json({ error: 'Failed to start GitHub connect flow' });
      }
      res.redirect(installUrl);
    });
  } catch (e) {
    if (e.statusCode === 503) {
      return res.status(503).json({ error: e.message });
    }
    console.error('GitHub connect error:', e);
    res.status(500).json({ error: 'Failed to start GitHub connect flow' });
  }
});

/**
 * GET /api/integrations/github/callback — install/OAuth callback. Validates state,
 * exchanges the code for the user's identity, stores the connection, redirects to settings.
 */
router.get('/integrations/github/callback', async (req, res) => {
  const auth = getAuthContext(req);
  if (!auth?.userId) {
    return redirectToSettings(res, 'error');
  }

  const { code, state, installation_id: installationId } = req.query;
  const expectedState = req.session?.githubOAuthState;
  // One-time use: clear regardless of outcome.
  if (req.session) {
    delete req.session.githubOAuthState;
  }

  if (!state || !expectedState || state !== expectedState) {
    integrationLog('warn', { provider: PROVIDER_GITHUB, op: 'callback', error: 'state_mismatch' });
    return redirectToSettings(res, 'error');
  }
  if (!code || !installationId) {
    integrationLog('warn', {
      provider: PROVIDER_GITHUB,
      op: 'callback',
      error: 'missing_code_or_installation',
    });
    return redirectToSettings(res, 'error');
  }

  try {
    const identity = await exchangeOAuthCode(String(code));
    await prisma.gitHubConnection.upsert({
      where: { userId: auth.userId },
      create: {
        userId: auth.userId,
        githubUserId: identity.githubUserId,
        githubLogin: identity.login,
        avatarUrl: identity.avatarUrl,
        installationId: String(installationId),
        encryptedToken: identity.token ? encryptIntegrationPayload(identity.token) : null,
        scopes: identity.scopes,
      },
      update: {
        githubUserId: identity.githubUserId,
        githubLogin: identity.login,
        avatarUrl: identity.avatarUrl,
        installationId: String(installationId),
        encryptedToken: identity.token ? encryptIntegrationPayload(identity.token) : null,
        scopes: identity.scopes,
      },
    });
    integrationLog('info', {
      provider: PROVIDER_GITHUB,
      op: 'callback',
      result: 'connected',
      login: identity.login,
    });
    redirectToSettings(res, 'success');
  } catch (e) {
    integrationLog('error', { provider: PROVIDER_GITHUB, op: 'callback', error: e.message });
    console.error('GitHub callback error:', e);
    redirectToSettings(res, 'error');
  }
});

/**
 * DELETE /api/integrations/github/connection — disconnect the caller's GitHub.
 */
router.delete('/integrations/github/connection', requireAuth, async (req, res) => {
  const { userId } = getAuthContext(req);
  await prisma.gitHubConnection.deleteMany({ where: { userId } });
  res.json({ ok: true });
});

/**
 * GET /api/integrations/github/repos — repos the caller's installation can access.
 */
router.get('/integrations/github/repos', requireAuth, async (req, res) => {
  const connection = await getCallerConnection(req, res);
  if (!connection) return;
  try {
    const repos = await listInstallationRepos(connection.installationId);
    res.json({ repos });
  } catch (e) {
    integrationLog('error', { provider: PROVIDER_GITHUB, op: 'list_repos', error: e.message });
    console.error('List installation repos error:', e);
    res.status(502).json({
      error: 'GitHub API error',
      message: 'Could not list your repositories. Try reconnecting GitHub.',
    });
  }
});

/**
 * GET /api/integrations/github/dependencies?name=&ecosystem= — cross-application package search.
 * Scoped to apps the caller can see (admin → all; else own company). For CVE / security triage.
 */
router.get('/integrations/github/dependencies', requireAuth, async (req, res) => {
  const auth = getAuthContext(req);
  const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
  const ecosystem = typeof req.query.ecosystem === 'string' ? req.query.ecosystem.trim() : '';
  if (!name) {
    return res.status(400).json({ error: 'query param "name" is required' });
  }

  const rows = await prisma.repoDependency.findMany({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(ecosystem ? { ecosystem } : {}),
    },
    include: {
      repo: {
        include: {
          applications: {
            include: {
              application: { select: { id: true, name: true, companyId: true } },
            },
          },
        },
      },
    },
  });

  const results = [];
  for (const dep of rows) {
    for (const link of dep.repo?.applications || []) {
      const app = link.application;
      if (!app) continue;
      if (!auth.isAdmin && auth.companyId !== app.companyId) continue;
      results.push({
        applicationId: app.id,
        applicationName: app.name,
        repoFullName: dep.repo.fullName,
        ecosystem: dep.ecosystem,
        name: dep.name,
        version: dep.version,
        versionRange: dep.versionRange,
      });
    }
  }
  res.json({ results });
});

/**
 * GET /api/integrations/github/sbom — company-scoped dependency inventory across applications.
 * Returns one row per (application × dependency), for a browsable/filterable SBOM view.
 * Scope: admins see all applications (optionally narrowed by ?companyId); everyone else is
 * restricted to their own company. Filtering/sorting/paging is done client-side.
 */
router.get('/integrations/github/sbom', requireAuth, async (req, res) => {
  const auth = getAuthContext(req);
  const MAX_ROWS = 10000;

  // Resolve the company scope on the SERVER — never trust the client for this.
  let companyScope = null; // null = all companies (admin only)
  if (!auth.isAdmin) {
    if (!auth.companyId) {
      return res.json({ rows: [], facets: { ecosystems: [], companies: [] }, total: 0, truncated: false });
    }
    companyScope = auth.companyId;
  } else if (typeof req.query.companyId === 'string' && req.query.companyId.trim()) {
    companyScope = req.query.companyId.trim();
  }

  const deps = await prisma.repoDependency.findMany({
    where: {
      repo: {
        applications: companyScope
          ? { some: { application: { companyId: companyScope } } }
          : { some: {} },
      },
    },
    include: {
      repo: {
        select: {
          id: true,
          fullName: true,
          htmlUrl: true,
          applications: {
            include: {
              application: {
                select: {
                  id: true,
                  name: true,
                  companyId: true,
                  company: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ name: 'asc' }],
  });

  const rows = [];
  const ecosystems = new Set();
  const companies = new Map();
  let truncated = false;

  outer: for (const dep of deps) {
    for (const link of dep.repo?.applications || []) {
      const app = link.application;
      if (!app) continue;
      // Per-row company enforcement: a shared repo may link to apps in OTHER companies —
      // those must never leak to a non-admin (or to an admin filtering by companyId).
      if (companyScope && app.companyId !== companyScope) continue;

      if (rows.length >= MAX_ROWS) {
        truncated = true;
        break outer;
      }
      rows.push({
        id: `${dep.id}:${app.id}`,
        applicationId: app.id,
        applicationName: app.name,
        companyId: app.companyId,
        companyName: app.company?.name ?? null,
        repoId: dep.repo.id,
        repoFullName: dep.repo.fullName,
        repoHtmlUrl: dep.repo.htmlUrl,
        ecosystem: dep.ecosystem,
        name: dep.name,
        version: dep.version,
        versionRange: dep.versionRange,
        isFramework: dep.isFramework,
        framework: dep.framework,
        source: dep.source,
      });
      ecosystems.add(dep.ecosystem);
      if (app.company) companies.set(app.company.id, app.company.name);
    }
  }

  if (truncated) {
    integrationLog('warn', {
      provider: PROVIDER_GITHUB,
      op: 'sbom',
      note: 'row cap reached',
      cap: MAX_ROWS,
    });
  }

  res.json({
    rows,
    total: rows.length,
    truncated,
    facets: {
      ecosystems: [...ecosystems].sort(),
      companies: [...companies.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    },
  });
});

// ---- Application-scoped repo linking -------------------------------------------------------

/** Load an application and enforce the same access rule as other app-link routes. */
async function loadAppForLink(req, res) {
  const { id } = req.params;
  const app = await prisma.application.findUnique({
    where: { id },
    select: { id: true, companyId: true },
  });
  if (!app) {
    res.status(404).json({ error: 'Application not found' });
    return null;
  }
  const auth = getAuthContext(req);
  if (!auth.isAdmin && auth.companyId !== app.companyId) {
    res.status(403).json({ error: 'Permission denied', message: 'You cannot access this application' });
    return null;
  }
  return app;
}

/** Fetch intel + upsert the shared GitHubRepo (+ dependencies). Returns the repo row id. */
async function upsertRepoWithIntel(connection, userId, ownerName, repoName) {
  const { metadata, languages, dependencies } = await fetchRepoIntel(
    connection.installationId,
    ownerName,
    repoName,
  );
  const now = new Date();
  const repo = await prisma.gitHubRepo.upsert({
    where: { githubRepoId: metadata.githubRepoId },
    create: {
      githubRepoId: metadata.githubRepoId,
      fullName: metadata.fullName,
      owner: metadata.owner,
      name: metadata.name,
      htmlUrl: metadata.htmlUrl,
      defaultBranch: metadata.defaultBranch,
      description: metadata.description,
      isPrivate: metadata.isPrivate,
      topics: metadata.topics,
      license: metadata.license,
      languages,
      lastSyncedAt: now,
      lastSyncedById: userId,
    },
    update: {
      fullName: metadata.fullName,
      owner: metadata.owner,
      name: metadata.name,
      htmlUrl: metadata.htmlUrl,
      defaultBranch: metadata.defaultBranch,
      description: metadata.description,
      isPrivate: metadata.isPrivate,
      topics: metadata.topics,
      license: metadata.license,
      languages,
      lastSyncedAt: now,
      lastSyncedById: userId,
    },
  });
  await saveRepoDependencies(prisma, repo.id, dependencies);
  return repo.id;
}

/** Reload the app's linked repo with dependencies, for a response body. */
async function loadAppRepoLink(applicationId) {
  const link = await prisma.applicationGitHubRepo.findUnique({
    where: { applicationId },
    include: { repo: { include: { dependencies: { orderBy: [{ isFramework: 'desc' }, { name: 'asc' }] } } } },
  });
  return link ? serializeRepo(link.repo) : null;
}

/**
 * PUT /api/applications/:id/github/link — link a repo (from the caller's installation) to the app.
 * body: { owner, name }  (owner/name of the repo to link)
 */
router.put('/applications/:id/github/link', requireAuth, async (req, res) => {
  const app = await loadAppForLink(req, res);
  if (!app) return;
  const connection = await getCallerConnection(req, res);
  if (!connection) return;

  const owner = typeof req.body.owner === 'string' ? req.body.owner.trim() : '';
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!owner || !name) {
    return res.status(400).json({ error: 'owner and name are required' });
  }

  try {
    const { userId } = getAuthContext(req);
    const repoId = await upsertRepoWithIntel(connection, userId, owner, name);
    await prisma.applicationGitHubRepo.upsert({
      where: { applicationId: app.id },
      create: { applicationId: app.id, githubRepoId: repoId, linkedById: userId },
      update: { githubRepoId: repoId, linkedById: userId },
    });
    res.json({ ok: true, repo: await loadAppRepoLink(app.id) });
  } catch (e) {
    integrationLog('error', { provider: PROVIDER_GITHUB, op: 'link_repo', error: e.message });
    console.error('GitHub link repo error:', e);
    if (e.status === 404) {
      return res.status(404).json({ error: 'Repository not found or not accessible to your installation' });
    }
    res.status(502).json({ error: 'GitHub API error', message: 'Could not read that repository.' });
  }
});

/**
 * POST /api/applications/:id/github/sync — refresh the linked repo's snapshot + dependencies.
 */
router.post('/applications/:id/github/sync', requireAuth, async (req, res) => {
  const app = await loadAppForLink(req, res);
  if (!app) return;
  const connection = await getCallerConnection(req, res);
  if (!connection) return;

  const link = await prisma.applicationGitHubRepo.findUnique({
    where: { applicationId: app.id },
    include: { repo: true },
  });
  if (!link) {
    return res.status(400).json({ error: 'No repository linked to this application' });
  }

  try {
    const { userId } = getAuthContext(req);
    await upsertRepoWithIntel(connection, userId, link.repo.owner, link.repo.name);
    res.json({ ok: true, repo: await loadAppRepoLink(app.id) });
  } catch (e) {
    integrationLog('error', { provider: PROVIDER_GITHUB, op: 'sync_repo', error: e.message });
    console.error('GitHub sync repo error:', e);
    res.status(502).json({ error: 'GitHub API error', message: 'Could not sync that repository.' });
  }
});

/**
 * POST /api/applications/:id/github/apply — write detected values into the app's official fields.
 * body: { fields?: ['language','framework'] }  (defaults to both)
 */
router.post('/applications/:id/github/apply', requireAuth, async (req, res) => {
  const app = await loadAppForLink(req, res);
  if (!app) return;

  const link = await prisma.applicationGitHubRepo.findUnique({
    where: { applicationId: app.id },
    include: { repo: { include: { dependencies: true } } },
  });
  if (!link) {
    return res.status(400).json({ error: 'No repository linked to this application' });
  }

  const requested = Array.isArray(req.body.fields) ? req.body.fields : ['language', 'framework'];
  const data = {};

  if (requested.includes('language')) {
    const langs = link.repo.languages || {};
    const top = Object.entries(langs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang]) => lang);
    if (top.length) data.language = top.join(', ');
  }
  if (requested.includes('framework')) {
    const labels = [
      ...new Set(
        (link.repo.dependencies || [])
          .filter((d) => d.isFramework && d.framework)
          .map((d) => d.framework),
      ),
    ];
    if (labels.length) data.framework = labels.join(', ');
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Nothing detected to apply' });
  }

  const updated = await prisma.application.update({
    where: { id: app.id },
    data,
    select: { id: true, language: true, framework: true },
  });
  res.json({ ok: true, application: updated });
});

/**
 * DELETE /api/applications/:id/github/link — unlink the repo (leaves the shared repo + deps intact).
 */
router.delete('/applications/:id/github/link', requireAuth, async (req, res) => {
  const app = await loadAppForLink(req, res);
  if (!app) return;
  await prisma.applicationGitHubRepo.deleteMany({ where: { applicationId: app.id } });
  res.json({ ok: true });
});

export default router;
