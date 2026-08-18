/**
 * Azure DevOps Services adapter for the SCM provider interface.
 *
 * Auth model: a Microsoft Entra ID (Azure AD) app registration with delegated Azure DevOps
 * permissions. Users authorize the app; we store the access token + refresh token (encrypted)
 * on ScmConnection. Access tokens expire (~1h), so API calls decrypt the stored token and
 * refresh on 401.
 *
 * Implements the provider contract consumed by services/scm/index.js:
 *   isConfigured() · startConnect(state) · exchangeOAuthCode(code) · listRepos(conn) ·
 *   fetchRepoIntel(conn, owner, name)
 *
 * Azure DevOps Server (on-prem) is a different host/API and is not implemented here.
 *
 * Owner/name mapping: Azure DevOps repos are org/project/repo. We store
 *   owner = "{organization}/{project}"  and  name = "{repository}"
 * so the existing two-argument fetch/link contract still works.
 */
import { PROVIDER_AZURE_DEVOPS } from '../../integrations/constants.js';
import { integrationLog } from '../../integrations/log.js';
import { decryptIntegrationPayload, encryptIntegrationPayload } from '../../utils/integrationCrypto.js';
import { prisma } from '../../prisma/client.js';
import { detectDependencies } from './parsers.js';

const HOST = 'dev.azure.com';
const ADO_RESOURCE = '499b84ac-1321-427f-aa17-267ca6975798';
const API_VERSION = '7.1';
const SCOPES = `offline_access ${ADO_RESOURCE}/.default`;

function isConfigured() {
  return Boolean(process.env.AZURE_DEVOPS_CLIENT_ID && process.env.AZURE_DEVOPS_CLIENT_SECRET);
}

function clientId() {
  return process.env.AZURE_DEVOPS_CLIENT_ID;
}

function clientSecret() {
  return process.env.AZURE_DEVOPS_CLIENT_SECRET;
}

function tenantId() {
  return (process.env.AZURE_DEVOPS_TENANT_ID || 'organizations').trim() || 'organizations';
}

function tokenUrl() {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId())}/oauth2/v2.0/token`;
}

function authorizeUrl() {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId())}/oauth2/v2.0/authorize`;
}

/**
 * Entra requires this exact URI on authorize and token exchange.
 * Production (Caddy same-origin) can use FRONTEND_URL/api/...; local dev is the backend port.
 */
function redirectUri() {
  const explicit = process.env.AZURE_DEVOPS_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const frontend = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  if (frontend && !/localhost|127\.0\.0\.1/.test(frontend)) {
    return `${frontend}/api/integrations/scm/callback`;
  }
  return `http://localhost:${process.env.PORT || 5000}/api/integrations/scm/callback`;
}

function requireConfigured() {
  if (!isConfigured()) {
    const err = new Error(
      'Azure DevOps is not configured. Set AZURE_DEVOPS_CLIENT_ID and AZURE_DEVOPS_CLIENT_SECRET.',
    );
    err.statusCode = 503;
    throw err;
  }
}

/** The authorize redirect URL to start a connection. */
function startConnect(state) {
  requireConfigured();
  const u = new URL(authorizeUrl());
  u.searchParams.set('client_id', clientId());
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', redirectUri());
  u.searchParams.set('response_mode', 'query');
  u.searchParams.set('scope', SCOPES);
  u.searchParams.set('state', state);
  u.searchParams.set('prompt', 'select_account');
  return u.toString();
}

async function requestToken(body) {
  requireConfigured();
  const res = await fetch(tokenUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      ...body,
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      payload.error_description || payload.error || `Azure DevOps token error (${res.status})`,
    );
    err.status = res.status;
    throw err;
  }
  return payload;
}

function adoErrorMessage(payload, status) {
  return payload?.message || payload?.error?.message || payload?.error || `Azure DevOps API error (${status})`;
}

async function apiJson(url, accessToken) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(adoErrorMessage(payload, res.status));
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
  const token = await requestToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    scope: SCOPES,
  });
  const profile = await apiJson(
    `https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=${API_VERSION}`,
    token.access_token,
  );
  return {
    token: token.access_token,
    refreshToken: token.refresh_token || null,
    externalUserId: String(profile.id || profile.publicAlias),
    login: profile.emailAddress || profile.publicAlias || profile.displayName,
    avatarUrl: profile._links?.avatar?.href || profile.coreAttributes?.Avatar?.value?.value || null,
    scopes: token.scope || null,
  };
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
    const err = new Error(
      'Azure DevOps access token expired and no refresh token is stored. Reconnect Azure DevOps.',
    );
    err.status = 401;
    throw err;
  }
  const refreshToken = decryptIntegrationPayload(connection.encryptedRefreshToken);
  const token = await requestToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: SCOPES,
  });
  await persistTokens(connection, token.access_token, token.refresh_token || null);
  return token.access_token;
}

async function accessTokenFor(connection) {
  if (!connection.encryptedToken) {
    const err = new Error('Azure DevOps connection has no access token. Reconnect Azure DevOps.');
    err.status = 401;
    throw err;
  }
  return decryptIntegrationPayload(connection.encryptedToken);
}

/** Fetch JSON from an absolute URL, refreshing the stored token once on 401. */
async function connectedJson(connection, url) {
  let token = await accessTokenFor(connection);
  const attempt = async (accessToken) => {
    const res = await fetch(url, {
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
    const err = new Error(adoErrorMessage(payload, res.status));
    err.status = res.status;
    throw err;
  }
  return payload;
}

function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.value)) return payload.value;
  return [];
}

function branchName(ref) {
  if (!ref || typeof ref !== 'string') return null;
  return ref.replace(/^refs\/heads\//, '') || null;
}

function parseOwnerName(owner, name) {
  const ownerParts = String(owner || '')
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
  const nameParts = String(name || '')
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
  if (ownerParts.length >= 2 && nameParts.length >= 1) {
    return { organization: ownerParts[0], project: ownerParts.slice(1).join('/'), repo: nameParts.join('/') };
  }
  if (ownerParts.length === 1 && nameParts.length >= 2) {
    return {
      organization: ownerParts[0],
      project: nameParts.slice(0, -1).join('/'),
      repo: nameParts[nameParts.length - 1],
    };
  }
  return null;
}

function mapRepo(connection, organization, r) {
  const project = r.project?.name || r.project?.id;
  const repoName = r.name;
  const owner = project ? `${organization}/${project}` : organization;
  const htmlUrl = r.webUrl || r.remoteUrl || `https://dev.azure.com/${organization}/${encodeURIComponent(project)}/_git/${encodeURIComponent(repoName)}`;
  return {
    provider: PROVIDER_AZURE_DEVOPS,
    host: connection.host || HOST,
    connectionId: connection.id,
    externalId: r.id ? `${organization}:${r.id}` : `${owner}/${repoName}`,
    fullName: `${owner}/${repoName}`,
    owner,
    name: repoName,
    htmlUrl,
    defaultBranch: branchName(r.defaultBranch),
    isPrivate: true,
    description: null,
  };
}

async function listOrgRepos(connection, organization) {
  const url = `https://dev.azure.com/${encodeURIComponent(organization)}/_apis/git/repositories?api-version=${API_VERSION}`;
  const payload = await connectedJson(connection, url);
  return asList(payload).filter((r) => r && !r.isDisabled && r.name);
}

/** List Git repositories across every Azure DevOps org the user belongs to. */
async function listRepos(connection) {
  const profile = await connectedJson(
    connection,
    `https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=${API_VERSION}`,
  );
  const memberId = profile.id;
  if (!memberId) return [];

  const accountsPayload = await connectedJson(
    connection,
    `https://app.vssps.visualstudio.com/_apis/accounts?memberId=${encodeURIComponent(memberId)}&api-version=${API_VERSION}`,
  );
  const accounts = asList(accountsPayload);
  const orgs = accounts.map((a) => a.accountName).filter(Boolean);

  const perOrg = await Promise.all(
    orgs.map((org) =>
      listOrgRepos(connection, org).catch((e) => {
        integrationLog('warn', {
          provider: PROVIDER_AZURE_DEVOPS,
          op: 'list_repos',
          org,
          error: e.message,
        });
        return [];
      }),
    ),
  );

  return perOrg.flatMap((repos, i) => repos.map((r) => mapRepo(connection, orgs[i], r)));
}

/** Fetch a text file from a repo (404-tolerant). */
async function fetchFileText(connection, organization, project, repo, path) {
  const normalized = `/${String(path).replace(/^\/+/, '')}`;
  const url = new URL(
    `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repo)}/items`,
  );
  url.searchParams.set('path', normalized);
  url.searchParams.set('includeContent', 'true');
  url.searchParams.set('api-version', API_VERSION);

  const attempt = async (accessToken) =>
    fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });

  let token = await accessTokenFor(connection);
  let res = await attempt(token);
  if (res.status === 401) {
    token = await refreshAccessToken(connection);
    res = await attempt(token);
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const err = new Error(adoErrorMessage(payload, res.status));
    err.status = res.status;
    throw err;
  }
  const payload = await res.json().catch(() => null);
  if (!payload || payload.gitObjectType === 'tree' || payload.isFolder) return null;
  if (typeof payload.content === 'string') return payload.content;
  return null;
}

/**
 * Pull metadata + a normalized top-level dependency inventory for a repo.
 * Azure DevOps has no languages-by-bytes API, so languages is empty unless later inferred.
 * @returns {Promise<{ metadata, languages, dependencies }>}
 */
async function fetchRepoIntel(connection, owner, name) {
  const parsed = parseOwnerName(owner, name);
  if (!parsed) {
    const err = new Error('Azure DevOps repositories need organization, project, and repository name.');
    err.status = 400;
    throw err;
  }
  const { organization, project, repo: repoName } = parsed;
  const repo = await connectedJson(
    connection,
    `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repoName)}?api-version=${API_VERSION}`,
  );
  const mapped = mapRepo(connection, organization, repo);

  const metadata = {
    ...mapped,
    topics: [],
    license: null,
  };

  const dependencies = await detectDependencies(
    (path) => fetchFileText(connection, organization, project, repoName, path),
    {
      onWarn: (file, e) =>
        integrationLog('warn', {
          provider: PROVIDER_AZURE_DEVOPS,
          op: 'parse_manifest',
          file,
          repo: mapped.fullName,
          error: e.message,
        }),
    },
  );

  integrationLog('info', {
    provider: PROVIDER_AZURE_DEVOPS,
    op: 'fetch_repo_intel',
    repo: mapped.fullName,
    languageCount: 0,
    dependencyCount: dependencies.length,
    frameworkCount: dependencies.filter((d) => d.isFramework).length,
  });

  return { metadata, languages: {}, dependencies };
}

/** @type {import('./index.js').ScmProvider} */
export const azureDevopsProvider = {
  id: PROVIDER_AZURE_DEVOPS,
  host: HOST,
  isConfigured,
  startConnect,
  exchangeOAuthCode,
  listRepos,
  fetchRepoIntel,
};
