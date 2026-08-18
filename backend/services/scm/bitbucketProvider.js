/**
 * Bitbucket Cloud adapter for the SCM provider interface.
 *
 * Auth model: a workspace OAuth 2.0 consumer. Users authorize the consumer; we store the access
 * token + refresh token (encrypted) on ScmConnection. Access tokens expire (~2h), so API calls
 * decrypt the stored token and refresh on 401.
 *
 * Implements the provider contract consumed by services/scm/index.js:
 *   isConfigured() · startConnect(state) · exchangeOAuthCode(code) · listRepos(conn) ·
 *   fetchRepoIntel(conn, owner, name)
 *
 * Bitbucket Server / Data Center is a different API and is not implemented here.
 */
import { PROVIDER_BITBUCKET } from '../../integrations/constants.js';
import { integrationLog } from '../../integrations/log.js';
import { decryptIntegrationPayload, encryptIntegrationPayload } from '../../utils/integrationCrypto.js';
import { prisma } from '../../prisma/client.js';
import { detectDependencies } from './parsers.js';

const HOST = 'bitbucket.org';
const AUTH_BASE = 'https://bitbucket.org/site/oauth2';
const API_BASE = 'https://api.bitbucket.org/2.0';
const SCOPES = 'account repository';

function isConfigured() {
  return Boolean(process.env.BITBUCKET_CLIENT_ID && process.env.BITBUCKET_CLIENT_SECRET);
}

function clientId() {
  return process.env.BITBUCKET_CLIENT_ID;
}

function clientSecret() {
  return process.env.BITBUCKET_CLIENT_SECRET;
}

function basicAuthHeader() {
  return `Basic ${Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64')}`;
}

/** Strip Bitbucket's `{uuid}` braces so ids match across API responses. */
function normalizeUuid(value) {
  if (!value) return null;
  return String(value).replace(/[{}]/g, '');
}

function requireConfigured() {
  if (!isConfigured()) {
    const err = new Error(
      'Bitbucket is not configured. Set BITBUCKET_CLIENT_ID and BITBUCKET_CLIENT_SECRET.',
    );
    err.statusCode = 503;
    throw err;
  }
}

/** The authorize redirect URL to start a connection. */
function startConnect(state) {
  requireConfigured();
  const u = new URL(`${AUTH_BASE}/authorize`);
  u.searchParams.set('client_id', clientId());
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('state', state);
  u.searchParams.set('scope', SCOPES);
  return u.toString();
}

async function requestToken(body) {
  requireConfigured();
  const res = await fetch(`${AUTH_BASE}/access_token`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(payload.error_description || payload.error || `Bitbucket token error (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return payload;
}

/**
 * Exchange an OAuth `code` for the connecting user's identity + tokens.
 * @returns {Promise<{ token, refreshToken, externalUserId, login, avatarUrl, scopes }>}
 */
async function exchangeOAuthCode(code) {
  const token = await requestToken({ grant_type: 'authorization_code', code });
  const user = await apiJson('/user', token.access_token);
  return {
    token: token.access_token,
    refreshToken: token.refresh_token || null,
    externalUserId: normalizeUuid(user.uuid) || String(user.account_id || user.username),
    login: user.username || user.nickname || user.display_name,
    avatarUrl: user.links?.avatar?.href || null,
    scopes: token.scopes || null,
  };
}

async function apiJson(path, accessToken) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(payload.error?.message || payload.error || `Bitbucket API error (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return payload;
}

async function persistTokens(connection, accessToken, refreshToken) {
  const data = { encryptedToken: encryptIntegrationPayload(accessToken) };
  if (refreshToken) data.encryptedRefreshToken = encryptIntegrationPayload(refreshToken);
  connection.encryptedToken = data.encryptedToken;
  if (refreshToken) connection.encryptedRefreshToken = data.encryptedRefreshToken;
  if (connection.id) {
    await prisma.scmConnection.update({ where: { id: connection.id }, data });
  }
}

async function refreshAccessToken(connection) {
  if (!connection.encryptedRefreshToken) {
    const err = new Error('Bitbucket access token expired and no refresh token is stored. Reconnect Bitbucket.');
    err.status = 401;
    throw err;
  }
  const refreshToken = decryptIntegrationPayload(connection.encryptedRefreshToken);
  const token = await requestToken({ grant_type: 'refresh_token', refresh_token: refreshToken });
  await persistTokens(connection, token.access_token, token.refresh_token || null);
  return token.access_token;
}

async function accessTokenFor(connection) {
  if (!connection.encryptedToken) {
    const err = new Error('Bitbucket connection has no access token. Reconnect Bitbucket.');
    err.status = 401;
    throw err;
  }
  return decryptIntegrationPayload(connection.encryptedToken);
}

/** Fetch JSON, refreshing the stored token once on 401. */
async function connectedJson(connection, path) {
  let token = await accessTokenFor(connection);
  const attempt = async (accessToken) => {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    const payload = await res.json().catch(() => ({}));
    return { res, payload };
  };
  let { res, payload } = await attempt(token);
  if (res.status === 401) {
    token = await refreshAccessToken(connection);
    ({ res, payload } = await attempt(token));
  }
  if (!res.ok) {
    const err = new Error(payload.error?.message || payload.error || `Bitbucket API error (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return payload;
}

/** Follow Bitbucket's `next` pagination links until exhausted. */
function nextPagePath(next) {
  if (!next) return null;
  if (next.startsWith(API_BASE)) return next.slice(API_BASE.length);
  if (next.startsWith('http')) {
    const u = new URL(next);
    return u.pathname.replace(/^\/2\.0/, '') + u.search;
  }
  return next.startsWith('/2.0') ? next.slice('/2.0'.length) : next;
}

async function paginate(connection, firstPath) {
  const values = [];
  let path = firstPath;
  while (path) {
    const page = await connectedJson(connection, path);
    if (Array.isArray(page.values)) values.push(...page.values);
    path = nextPagePath(page.next);
  }
  return values;
}

function mapRepo(connection, r) {
  const fullName = r.full_name || `${r.workspace?.slug || r.owner?.username}/${r.slug || r.name}`;
  const owner = r.workspace?.slug || r.owner?.username || fullName.split('/')[0];
  const name = r.slug || r.name;
  return {
    provider: PROVIDER_BITBUCKET,
    host: connection.host || HOST,
    connectionId: connection.id,
    externalId: normalizeUuid(r.uuid) || fullName,
    fullName,
    owner,
    name,
    htmlUrl: r.links?.html?.href || `https://bitbucket.org/${fullName}`,
    defaultBranch: r.mainbranch?.name || null,
    isPrivate: Boolean(r.is_private),
    description: r.description || null,
  };
}

/** List repositories the connected user can access. */
async function listRepos(connection) {
  const repos = await paginate(connection, '/repositories?role=member&pagelen=100');
  return repos.map((r) => mapRepo(connection, r));
}

/** Fetch a text file from a repo (404-tolerant). */
async function fetchFileText(connection, owner, name, ref, path) {
  const encodedPath = String(path)
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  const encodedRef = encodeURIComponent(ref || 'HEAD');
  const url = `${API_BASE}/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/src/${encodedRef}/${encodedPath}`;
  const attempt = async (accessToken) =>
    fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

  let token = await accessTokenFor(connection);
  let res = await attempt(token);
  if (res.status === 401) {
    token = await refreshAccessToken(connection);
    res = await attempt(token);
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const err = new Error(payload.error?.message || payload.error || `Bitbucket API error (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  // Directories come back as JSON listings; treat those as missing files.
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && (Array.isArray(parsed.values) || parsed.type === 'commit_directory')) return null;
    } catch {
      // fall through — a JSON manifest is still a file
    }
  }
  return text;
}

function licenseLabel(license) {
  if (!license) return null;
  if (typeof license === 'string') return license;
  return license.name || license.key || null;
}

/**
 * Pull metadata + language + a normalized top-level dependency inventory for a repo.
 * @returns {Promise<{ metadata, languages, dependencies }>}
 */
async function fetchRepoIntel(connection, owner, name) {
  const repo = await connectedJson(
    connection,
    `/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
  );
  const mapped = mapRepo(connection, repo);
  const ref = mapped.defaultBranch || 'HEAD';

  const metadata = {
    ...mapped,
    topics: [],
    license: licenseLabel(repo.license),
  };

  const language = typeof repo.language === 'string' && repo.language.trim() ? repo.language.trim() : null;
  const languages = language ? { [language]: 1 } : {};

  const dependencies = await detectDependencies((path) => fetchFileText(connection, owner, name, ref, path), {
    onWarn: (file, e) =>
      integrationLog('warn', {
        provider: PROVIDER_BITBUCKET,
        op: 'parse_manifest',
        file,
        repo: mapped.fullName,
        error: e.message,
      }),
  });

  integrationLog('info', {
    provider: PROVIDER_BITBUCKET,
    op: 'fetch_repo_intel',
    repo: mapped.fullName,
    languageCount: Object.keys(languages).length,
    dependencyCount: dependencies.length,
    frameworkCount: dependencies.filter((d) => d.isFramework).length,
  });

  return { metadata, languages, dependencies };
}

/** @type {import('./index.js').ScmProvider} */
export const bitbucketProvider = {
  id: PROVIDER_BITBUCKET,
  host: HOST,
  isConfigured,
  startConnect,
  exchangeOAuthCode,
  listRepos,
  fetchRepoIntel,
};
