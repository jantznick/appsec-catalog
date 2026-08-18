import express from 'express';
import crypto from 'node:crypto';
import { prisma } from '../prisma/client.js';
import { requireAuth } from '../middleware/auth.js';
import { getAuthContext } from '../middleware/authContext.js';
import { encryptIntegrationPayload } from '../utils/integrationCrypto.js';
import { integrationLog } from '../integrations/log.js';
import { PROVIDER_GITHUB } from '../integrations/constants.js';
import { scanDependenciesForOsv } from '../integrations/osv.js';
import {
  getScmProvider,
  listConfiguredProviders,
  fetchRepoIntel,
  listReposForConnection,
  saveRepoDependencies,
  topLanguagesString,
  frameworkLabelsString,
} from '../services/scm/index.js';

// Routes stay under /integrations/scm/* for now (frontend compatibility). Internally they are
// provider-agnostic — the connection's `provider` selects the adapter — so adding GitLab/Bitbucket/
// Azure DevOps is a new adapter, not new route logic.
const router = express.Router();

function frontendBase() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function redirectToSettings(res, status) {
  res.redirect(`${frontendBase()}/settings/integrations?scm=${status}`);
}

/** All of the caller's SCM connections. */
function getUserConnections(userId) {
  return prisma.scmConnection.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
}

/**
 * Resolve which connection to act through: by explicit id, by provider+host, or (when the user has
 * a single connection) that one. Sends a 400 and returns null if none can be resolved.
 */
async function resolveConnection(req, res, { connectionId, provider, host } = {}) {
  const { userId } = getAuthContext(req);
  let connection = null;
  if (connectionId) {
    connection = await prisma.scmConnection.findFirst({ where: { id: connectionId, userId } });
  } else if (provider && host) {
    connection = await prisma.scmConnection.findFirst({ where: { userId, provider, host } });
  } else {
    connection = await prisma.scmConnection.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }
  if (!connection) {
    res.status(400).json({
      error: 'Not connected',
      message: 'Connect a source-control account before linking repositories.',
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
    provider: repo.provider,
    host: repo.host,
    externalId: repo.externalId,
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
      osvScanned: d.osvScanned ?? false,
      osvVulnIds: Array.isArray(d.osvVulnIds) ? d.osvVulnIds : [],
      osvVulns: Array.isArray(d.osvVulns) ? d.osvVulns : [],
    })),
  };
}

/**
 * GET /api/integrations/scm/status — the caller's connections + which providers can be connected.
 */
router.get('/integrations/scm/status', requireAuth, async (req, res) => {
  const { userId } = getAuthContext(req);
  const connections = await getUserConnections(userId);
  const providers = listConfiguredProviders();
  res.json({
    configured: providers.length > 0,
    providers, // [{ id, host }] configured providers available to connect
    connections: connections.map((c) => ({
      id: c.id,
      provider: c.provider,
      host: c.host,
      login: c.externalLogin,
      avatarUrl: c.avatarUrl,
      connectedAt: c.createdAt,
    })),
    // Back-compat convenience fields (first connection):
    connected: connections.length > 0,
    login: connections[0]?.externalLogin ?? null,
    avatarUrl: connections[0]?.avatarUrl ?? null,
  });
});

/**
 * GET /api/integrations/scm/connect?provider= — start a connection flow for a provider.
 */
router.get('/integrations/scm/connect', requireAuth, async (req, res) => {
  const providerId = typeof req.query.provider === 'string' ? req.query.provider : PROVIDER_GITHUB;
  let provider;
  try {
    provider = getScmProvider(providerId);
  } catch {
    return res.status(400).json({ error: `Unsupported provider: ${providerId}` });
  }
  if (!provider.isConfigured()) {
    return res.status(503).json({ error: `${providerId} is not configured` });
  }
  try {
    const state = crypto.randomBytes(24).toString('hex');
    const authUrl = provider.startConnect(state); // may throw (503) before session write
    req.session.scmConnect = { state, provider: providerId, host: provider.host };
    req.session.save((err) => {
      if (err) {
        console.error('Failed to persist SCM connect state:', err);
        return res.status(500).json({ error: 'Failed to start connect flow' });
      }
      res.redirect(authUrl);
    });
  } catch (e) {
    if (e.statusCode === 503) return res.status(503).json({ error: e.message });
    console.error('SCM connect error:', e);
    res.status(500).json({ error: 'Failed to start connect flow' });
  }
});

/**
 * GET /api/integrations/scm/callback — OAuth/app callback. Validates state, exchanges the code
 * for the user's identity, upserts the connection (one row per distinct account), redirects.
 */
router.get('/integrations/scm/callback', async (req, res) => {
  const auth = getAuthContext(req);
  if (!auth?.userId) return redirectToSettings(res, 'error');

  const { code, state, installation_id: installationId } = req.query;
  const pending = req.session?.scmConnect;
  if (req.session) delete req.session.scmConnect; // one-time use

  if (!state || !pending || state !== pending.state) {
    integrationLog('warn', { provider: pending?.provider, op: 'callback', error: 'state_mismatch' });
    return redirectToSettings(res, 'error');
  }
  if (!code) {
    integrationLog('warn', { provider: pending.provider, op: 'callback', error: 'missing_code' });
    return redirectToSettings(res, 'error');
  }

  try {
    const provider = getScmProvider(pending.provider);
    const identity = await provider.exchangeOAuthCode(String(code));
    const data = {
      avatarUrl: identity.avatarUrl,
      installationId: installationId ? String(installationId) : null,
      encryptedToken: identity.token ? encryptIntegrationPayload(identity.token) : null,
      scopes: identity.scopes,
      externalLogin: identity.login,
    };
    if (identity.refreshToken) {
      data.encryptedRefreshToken = encryptIntegrationPayload(identity.refreshToken);
    }
    await prisma.scmConnection.upsert({
      where: {
        userId_provider_host_externalUserId: {
          userId: auth.userId,
          provider: pending.provider,
          host: pending.host,
          externalUserId: identity.externalUserId,
        },
      },
      create: {
        userId: auth.userId,
        provider: pending.provider,
        host: pending.host,
        externalUserId: identity.externalUserId,
        ...data,
      },
      update: data,
    });
    integrationLog('info', {
      provider: pending.provider,
      op: 'callback',
      result: 'connected',
      login: identity.login,
    });
    redirectToSettings(res, 'success');
  } catch (e) {
    integrationLog('error', { provider: pending.provider, op: 'callback', error: e.message });
    console.error('SCM callback error:', e);
    redirectToSettings(res, 'error');
  }
});

/**
 * DELETE /api/integrations/scm/connection?id= — disconnect one connection (or all if no id).
 */
router.delete('/integrations/scm/connection', requireAuth, async (req, res) => {
  const { userId } = getAuthContext(req);
  const id = typeof req.query.id === 'string' ? req.query.id : null;
  await prisma.scmConnection.deleteMany({ where: { userId, ...(id ? { id } : {}) } });
  res.json({ ok: true });
});

/**
 * GET /api/integrations/scm/repos — repos across ALL of the caller's connections.
 */
router.get('/integrations/scm/repos', requireAuth, async (req, res) => {
  const { userId } = getAuthContext(req);
  const connections = await getUserConnections(userId);
  if (connections.length === 0) {
    return res.status(400).json({ error: 'Not connected', message: 'Connect a source-control account first.' });
  }
  try {
    const perConnection = await Promise.all(
      connections.map((c) =>
        listReposForConnection(c).catch((e) => {
          integrationLog('error', { provider: c.provider, op: 'list_repos', error: e.message });
          return [];
        }),
      ),
    );
    res.json({ repos: perConnection.flat() });
  } catch (e) {
    console.error('List repos error:', e);
    res.status(502).json({ error: 'SCM API error', message: 'Could not list your repositories.' });
  }
});

/**
 * GET /api/integrations/scm/repo-intel?owner=&name=&connectionId= — preview a repo's detected
 * language/framework WITHOUT linking it (prefill for the New Application form).
 */
router.get('/integrations/scm/repo-intel', requireAuth, async (req, res) => {
  const connectionId = typeof req.query.connectionId === 'string' ? req.query.connectionId : null;
  const connection = await resolveConnection(req, res, { connectionId });
  if (!connection) return;
  const owner = typeof req.query.owner === 'string' ? req.query.owner.trim() : '';
  const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
  if (!owner || !name) {
    return res.status(400).json({ error: 'owner and name are required' });
  }
  try {
    const { metadata, languages, dependencies } = await fetchRepoIntel(connection, owner, name);
    res.json({
      htmlUrl: metadata.htmlUrl,
      fullName: metadata.fullName,
      language: topLanguagesString(languages),
      framework: frameworkLabelsString(dependencies),
    });
  } catch (e) {
    integrationLog('error', { provider: connection.provider, op: 'repo_intel', error: e.message });
    if (e.status === 404) {
      return res.status(404).json({ error: 'Repository not found or not accessible' });
    }
    if (e.status === 400) {
      return res.status(400).json({ error: e.message });
    }
    res.status(502).json({ error: 'SCM API error', message: 'Could not read that repository.' });
  }
});

/**
 * GET /api/integrations/scm/dependencies?name=&ecosystem= — cross-application package search.
 */
router.get('/integrations/scm/dependencies', requireAuth, async (req, res) => {
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
 * GET /api/integrations/scm/sbom — company-scoped dependency inventory across applications.
 */
router.get('/integrations/scm/sbom', requireAuth, async (req, res) => {
  const auth = getAuthContext(req);
  const MAX_ROWS = 10000;

  let companyScope = null; // null = all companies (admin only)
  let divisionScope = null; // null = all divisions (admin only)
  if (!auth.isAdmin) {
    if (!auth.companyId) {
      return res.json({ rows: [], facets: { ecosystems: [], companies: [] }, total: 0, truncated: false });
    }
    companyScope = auth.companyId;
  } else if (typeof req.query.companyId === 'string' && req.query.companyId.trim()) {
    companyScope = req.query.companyId.trim();
  } else if (typeof req.query.divisionId === 'string' && req.query.divisionId.trim()) {
    divisionScope = req.query.divisionId.trim();
  }

  // Prisma filter on the owning application, from the active scope.
  const applicationScope = companyScope
    ? { companyId: companyScope }
    : divisionScope
      ? { company: { divisionId: divisionScope } }
      : null;

  const deps = await prisma.repoDependency.findMany({
    where: {
      repo: {
        applications: applicationScope
          ? { some: { application: applicationScope } }
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
                  company: { select: { id: true, name: true, divisionId: true } },
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
      if (companyScope && app.companyId !== companyScope) continue;
      if (divisionScope && app.company?.divisionId !== divisionScope) continue;

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
    integrationLog('warn', { provider: 'SCM', op: 'sbom', note: 'row cap reached', cap: MAX_ROWS });
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

/** Parse a repo URL (GitHub/GitLab/Bitbucket/Azure DevOps https or ssh) into { owner, name }, or null. */
function decodeUrlSeg(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseRepoUrl(url) {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Azure DevOps Services: https://dev.azure.com/{org}/{project}/_git/{repo}
  let m = trimmed.match(/dev\.azure\.com\/([^/\s]+)\/([^/\s]+)\/_git\/([^/\s#?]+)/i);
  if (m) return { owner: `${decodeUrlSeg(m[1])}/${decodeUrlSeg(m[2])}`, name: decodeUrlSeg(m[3]).replace(/\.git$/i, '') };

  // Legacy visualstudio.com: https://{org}.visualstudio.com/[DefaultCollection/]{project}/_git/{repo}
  m = trimmed.match(/([^.\/\s]+)\.visualstudio\.com\/(?:DefaultCollection\/)?([^/\s]+)\/_git\/([^/\s#?]+)/i);
  if (m) return { owner: `${decodeUrlSeg(m[1])}/${decodeUrlSeg(m[2])}`, name: decodeUrlSeg(m[3]).replace(/\.git$/i, '') };

  // SSH: git@ssh.dev.azure.com:v3/{org}/{project}/{repo}
  m = trimmed.match(/ssh\.dev\.azure\.com:v3\/([^/\s]+)\/([^/\s]+)\/([^/\s#?]+)/i);
  if (m) return { owner: `${decodeUrlSeg(m[1])}/${decodeUrlSeg(m[2])}`, name: decodeUrlSeg(m[3]).replace(/\.git$/i, '') };

  m = trimmed.match(/(?:github|gitlab|bitbucket)\.[a-z.]+[/:]([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[/#?].*)?$/i);
  if (!m) return null;
  return { owner: m[1], name: m[2] };
}

/** Fetch intel + upsert the shared ScmRepo (+ dependencies), and set the application's repoUrl. */
async function upsertRepoWithIntel(connection, userId, ownerName, repoName, applicationId) {
  const { metadata, languages, dependencies } = await fetchRepoIntel(connection, ownerName, repoName);
  const now = new Date();
  const fields = {
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
  };
  const repo = await prisma.scmRepo.upsert({
    where: {
      provider_host_externalId: {
        provider: metadata.provider,
        host: metadata.host,
        externalId: metadata.externalId,
      },
    },
    create: { provider: metadata.provider, host: metadata.host, externalId: metadata.externalId, ...fields },
    update: fields,
  });
  // Best-effort OSV advisory flagging (annotates each dep with osvScanned/osvVulnIds in place).
  // Never throws — a scan failure leaves rows unscanned (shown as "couldn't check" in the UI)
  // rather than blocking the repo sync. Wiz remains the source of truth for vuln data.
  await scanDependenciesForOsv(dependencies);
  await saveRepoDependencies(prisma, repo.id, dependencies);

  // repoUrl always tracks the linked repo. Language/framework are set separately via .../apply.
  if (applicationId) {
    await prisma.application.update({ where: { id: applicationId }, data: { repoUrl: metadata.htmlUrl } });
  }
  return repo.id;
}

async function loadAppRepoLink(applicationId) {
  const link = await prisma.applicationScmRepo.findUnique({
    where: { applicationId },
    include: { repo: { include: { dependencies: { orderBy: [{ isFramework: 'desc' }, { name: 'asc' }] } } } },
  });
  return link ? serializeRepo(link.repo) : null;
}

/**
 * PUT /api/applications/:id/scm/link — link a repo to the app.
 * body: { owner, name } OR { url }, plus optional { connectionId } to pick which account.
 */
router.put('/applications/:id/scm/link', requireAuth, async (req, res) => {
  const app = await loadAppForLink(req, res);
  if (!app) return;
  const connection = await resolveConnection(req, res, {
    connectionId: typeof req.body.connectionId === 'string' ? req.body.connectionId : null,
  });
  if (!connection) return;

  let owner = typeof req.body.owner === 'string' ? req.body.owner.trim() : '';
  let name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if ((!owner || !name) && typeof req.body.url === 'string') {
    const parsed = parseRepoUrl(req.body.url);
    if (parsed) {
      owner = parsed.owner;
      name = parsed.name;
    }
  }
  if (!owner || !name) {
    return res.status(400).json({ error: 'Provide owner and name, or a valid repository URL' });
  }

  try {
    const { userId } = getAuthContext(req);
    const repoId = await upsertRepoWithIntel(connection, userId, owner, name, app.id);
    await prisma.applicationScmRepo.upsert({
      where: { applicationId: app.id },
      create: { applicationId: app.id, githubRepoId: repoId, linkedById: userId },
      update: { githubRepoId: repoId, linkedById: userId },
    });
    res.json({ ok: true, repo: await loadAppRepoLink(app.id) });
  } catch (e) {
    integrationLog('error', { provider: connection.provider, op: 'link_repo', error: e.message });
    console.error('Link repo error:', e);
    if (e.status === 404) {
      return res.status(404).json({ error: 'Repository not found or not accessible' });
    }
    if (e.status === 400) {
      return res.status(400).json({ error: e.message });
    }
    res.status(502).json({ error: 'SCM API error', message: 'Could not read that repository.' });
  }
});

/**
 * POST /api/applications/:id/scm/sync — refresh the linked repo's snapshot + dependencies.
 */
router.post('/applications/:id/scm/sync', requireAuth, async (req, res) => {
  const app = await loadAppForLink(req, res);
  if (!app) return;

  const link = await prisma.applicationScmRepo.findUnique({
    where: { applicationId: app.id },
    include: { repo: true },
  });
  if (!link) {
    return res.status(400).json({ error: 'No repository linked to this application' });
  }

  // Use the caller's connection for the linked repo's provider/host.
  const connection = await resolveConnection(req, res, {
    provider: link.repo.provider,
    host: link.repo.host,
  });
  if (!connection) return;

  try {
    const { userId } = getAuthContext(req);
    await upsertRepoWithIntel(connection, userId, link.repo.owner, link.repo.name, app.id);
    res.json({ ok: true, repo: await loadAppRepoLink(app.id) });
  } catch (e) {
    integrationLog('error', { provider: connection.provider, op: 'sync_repo', error: e.message });
    console.error('Sync repo error:', e);
    res.status(502).json({ error: 'SCM API error', message: 'Could not sync that repository.' });
  }
});

/**
 * POST /api/applications/:id/scm/rescan-advisories — re-run the OSV advisory scan against the
 * dependencies already stored for the linked repo, without re-fetching from the SCM provider.
 * Useful because OSV advisories change over time even when the code doesn't. Wiz remains the
 * source of truth for vulnerability data.
 */
router.post('/applications/:id/scm/rescan-advisories', requireAuth, async (req, res) => {
  const app = await loadAppForLink(req, res);
  if (!app) return;

  const link = await prisma.applicationScmRepo.findUnique({
    where: { applicationId: app.id },
    include: { repo: { include: { dependencies: true } } },
  });
  if (!link) {
    return res.status(400).json({ error: 'No repository linked to this application' });
  }

  const deps = link.repo.dependencies;
  try {
    const summary = await scanDependenciesForOsv(deps); // annotates each dep in place; never throws
    if (deps.length) {
      await prisma.$transaction(
        deps.map((d) =>
          prisma.repoDependency.update({
            where: { id: d.id },
            data: {
              osvScanned: d.osvScanned ?? false,
              osvVulnIds: Array.isArray(d.osvVulnIds) ? d.osvVulnIds : [],
              osvVulns: Array.isArray(d.osvVulns) ? d.osvVulns : [],
              osvScannedAt: d.osvScannedAt ?? null,
            },
          }),
        ),
      );
    }
    res.json({ ok: true, summary, repo: await loadAppRepoLink(app.id) });
  } catch (e) {
    integrationLog('error', { provider: 'OSV', op: 'rescan_advisories', error: e.message });
    console.error('Rescan advisories error:', e);
    res.status(502).json({ error: 'OSV scan error', message: 'Could not rescan advisories.' });
  }
});

/**
 * POST /api/applications/:id/scm/apply — write language/framework into the app's official fields.
 * Body may pass explicit `{ language?, framework? }`; when omitted, the detected values are used.
 */
router.post('/applications/:id/scm/apply', requireAuth, async (req, res) => {
  const app = await loadAppForLink(req, res);
  if (!app) return;

  const link = await prisma.applicationScmRepo.findUnique({
    where: { applicationId: app.id },
    include: { repo: { include: { dependencies: true } } },
  });
  if (!link) {
    return res.status(400).json({ error: 'No repository linked to this application' });
  }

  const data = {};
  if (typeof req.body.language === 'string') {
    data.language = req.body.language.trim();
  } else {
    const language = topLanguagesString(link.repo.languages);
    if (language) data.language = language;
  }
  if (typeof req.body.framework === 'string') {
    data.framework = req.body.framework.trim();
  } else {
    const framework = frameworkLabelsString(link.repo.dependencies);
    if (framework) data.framework = framework;
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Nothing to apply' });
  }

  const updated = await prisma.application.update({
    where: { id: app.id },
    data,
    select: { id: true, language: true, framework: true },
  });
  res.json({ ok: true, application: updated });
});

/**
 * DELETE /api/applications/:id/scm/link — unlink the repo (clears repoUrl; keeps language/framework).
 */
router.delete('/applications/:id/scm/link', requireAuth, async (req, res) => {
  const app = await loadAppForLink(req, res);
  if (!app) return;
  await prisma.applicationScmRepo.deleteMany({ where: { applicationId: app.id } });
  await prisma.application.update({ where: { id: app.id }, data: { repoUrl: null } });
  res.json({ ok: true });
});

export default router;
