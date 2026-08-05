/**
 * GitHub adapter for the SCM provider interface.
 *
 * Auth model: a single GitHub App. Users authorize the app (OAuth user-to-server) and install it on
 * the repos they choose. We store the installation id + user identity (ScmConnection); repo reads
 * use installation access tokens minted on demand from the App private key (never persisted).
 *
 * Implements the provider contract consumed by services/scm/index.js:
 *   isConfigured() · startConnect(state) · exchangeOAuthCode(code) · listRepos(conn) ·
 *   fetchRepoIntel(conn, owner, name)
 */
import { App, Octokit } from 'octokit';
import { integrationLog } from '../../integrations/log.js';
import { PROVIDER_GITHUB } from '../../integrations/constants.js';
import { detectDependencies } from './parsers.js';

const HOST = 'github.com';
let cachedApp = null;

/** Normalize the configured private key: raw PEM, PEM with escaped `\n`, or base64-encoded PEM. */
function normalizePrivateKey(raw) {
  const value = String(raw || '').trim();
  if (value.includes('BEGIN') && value.includes('PRIVATE KEY')) {
    return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
  }
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    if (decoded.includes('PRIVATE KEY')) return decoded;
  } catch {
    // fall through
  }
  return value;
}

function isConfigured() {
  return Boolean(
    process.env.GITHUB_APP_ID &&
      process.env.GITHUB_APP_SLUG &&
      process.env.GITHUB_APP_CLIENT_ID &&
      process.env.GITHUB_APP_CLIENT_SECRET &&
      process.env.GITHUB_APP_PRIVATE_KEY,
  );
}

/** The install/authorize redirect URL to start a connection. */
function startConnect(state) {
  const slug = process.env.GITHUB_APP_SLUG;
  if (!slug) {
    const err = new Error('GITHUB_APP_SLUG is not configured');
    err.statusCode = 503;
    throw err;
  }
  const u = new URL(`https://github.com/apps/${slug}/installations/new`);
  u.searchParams.set('state', state);
  return u.toString();
}

function getApp() {
  if (cachedApp) return cachedApp;
  if (!isConfigured()) {
    const err = new Error(
      'GitHub App is not configured. Set GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET and GITHUB_APP_PRIVATE_KEY.',
    );
    err.statusCode = 503;
    throw err;
  }
  cachedApp = new App({
    appId: process.env.GITHUB_APP_ID,
    privateKey: normalizePrivateKey(process.env.GITHUB_APP_PRIVATE_KEY),
    oauth: {
      clientId: process.env.GITHUB_APP_CLIENT_ID,
      clientSecret: process.env.GITHUB_APP_CLIENT_SECRET,
    },
  });
  return cachedApp;
}

/**
 * Exchange an OAuth `code` (from the install callback) for the connecting user's identity.
 * @returns {Promise<{ token, externalUserId, login, avatarUrl, scopes }>}
 */
async function exchangeOAuthCode(code) {
  const app = getApp();
  const { authentication } = await app.oauth.createToken({ code });
  const token = authentication.token;
  const userOctokit = new Octokit({ auth: token });
  const { data: user } = await userOctokit.rest.users.getAuthenticated();
  return {
    token,
    externalUserId: String(user.id),
    login: user.login,
    avatarUrl: user.avatar_url || null,
    scopes: Array.isArray(authentication.scopes) ? authentication.scopes.join(',') : null,
  };
}

async function getInstallationOctokit(installationId) {
  const app = getApp();
  return app.getInstallationOctokit(Number(installationId));
}

/** List repositories a connection can access, tagged with provider/host/connection for routing. */
async function listRepos(connection) {
  const octokit = await getInstallationOctokit(connection.installationId);
  const repos = await octokit.paginate('GET /installation/repositories', { per_page: 100 });
  return repos.map((r) => ({
    provider: PROVIDER_GITHUB,
    host: connection.host || HOST,
    connectionId: connection.id,
    externalId: String(r.id),
    fullName: r.full_name,
    owner: r.owner?.login ?? r.full_name.split('/')[0],
    name: r.name,
    htmlUrl: r.html_url,
    defaultBranch: r.default_branch || null,
    isPrivate: Boolean(r.private),
    description: r.description || null,
  }));
}

/** Fetch a text file from a repo (404-tolerant). Falls back to the blob API for large files. */
async function fetchFileText(octokit, owner, repo, path) {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path });
    if (Array.isArray(data) || data.type !== 'file') return null;
    if (data.content) {
      return Buffer.from(data.content, data.encoding || 'base64').toString('utf8');
    }
    if (data.sha) {
      const { data: blob } = await octokit.rest.git.getBlob({ owner, repo, file_sha: data.sha });
      return Buffer.from(blob.content, blob.encoding || 'base64').toString('utf8');
    }
    return null;
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

/**
 * Pull metadata + languages + a normalized top-level dependency inventory for a repo.
 * @returns {Promise<{ metadata, languages, dependencies }>}
 */
async function fetchRepoIntel(connection, owner, name) {
  const octokit = await getInstallationOctokit(connection.installationId);

  const [repoRes, langRes] = await Promise.all([
    octokit.rest.repos.get({ owner, repo: name }),
    octokit.rest.repos.listLanguages({ owner, repo: name }).catch(() => ({ data: {} })),
  ]);
  const repo = repoRes.data;

  const metadata = {
    provider: PROVIDER_GITHUB,
    host: connection.host || HOST,
    externalId: String(repo.id),
    fullName: repo.full_name,
    owner: repo.owner?.login ?? owner,
    name: repo.name,
    htmlUrl: repo.html_url,
    defaultBranch: repo.default_branch || null,
    description: repo.description || null,
    isPrivate: Boolean(repo.private),
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    license: repo.license?.spdx_id || repo.license?.name || null,
  };

  const dependencies = await detectDependencies((path) => fetchFileText(octokit, owner, name, path), {
    onWarn: (file, e) =>
      integrationLog('warn', {
        provider: PROVIDER_GITHUB,
        op: 'parse_manifest',
        file,
        repo: repo.full_name,
        error: e.message,
      }),
  });

  integrationLog('info', {
    provider: PROVIDER_GITHUB,
    op: 'fetch_repo_intel',
    repo: repo.full_name,
    languageCount: Object.keys(langRes.data || {}).length,
    dependencyCount: dependencies.length,
    frameworkCount: dependencies.filter((d) => d.isFramework).length,
  });

  return { metadata, languages: langRes.data || {}, dependencies };
}

/** @type {import('./index.js').ScmProvider} */
export const githubProvider = {
  id: PROVIDER_GITHUB,
  host: HOST,
  isConfigured,
  startConnect,
  exchangeOAuthCode,
  listRepos,
  fetchRepoIntel,
};
