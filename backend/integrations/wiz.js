import { integrationLog, isIntegrationsVerbose, safeUrlHost } from './log.js';

const WIZ_AUTH_URL = 'https://auth.app.wiz.io/oauth/token';
const WIZ_AUDIENCE = 'wiz-api';

/**
 * Normalize user-provided URL to a POSTable GraphQL endpoint.
 * @param {string} raw
 */
export function normalizeWizGraphqlUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    const err = new Error('Wiz GraphQL URL is required');
    err.statusCode = 400;
    throw err;
  }
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    const e = new Error('Invalid Wiz GraphQL URL');
    e.statusCode = 400;
    throw e;
  }
  if (!url.pathname || url.pathname === '/') {
    url.pathname = '/graphql';
  } else if (!/\/graphql\/?$/i.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/?$/, '/graphql');
  }
  return url.href.replace(/\/$/, '');
}

/**
 * @param {string} clientId
 * @param {string} clientSecret
 * @returns {Promise<string>} Bearer access token
 */
export async function fetchWizAccessToken(clientId, clientSecret) {
  const started = Date.now();
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    audience: WIZ_AUDIENCE,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(WIZ_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    integrationLog('error', {
      provider: 'WIZ',
      op: 'oauth_token',
      authHost: safeUrlHost(WIZ_AUTH_URL),
      durationMs: Date.now() - started,
      httpStatus: res.status,
      error: `Wiz auth failed: ${res.status}`,
    });
    const err = new Error(`Wiz auth failed: ${res.status}`);
    err.statusCode = res.status === 401 || res.status === 403 ? 403 : 502;
    err.detail = text?.slice(0, 500);
    throw err;
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    integrationLog('error', {
      provider: 'WIZ',
      op: 'oauth_token',
      authHost: safeUrlHost(WIZ_AUTH_URL),
      durationMs: Date.now() - started,
      error: 'Invalid JSON from Wiz auth',
    });
    const err = new Error('Invalid response from Wiz auth');
    err.statusCode = 502;
    throw err;
  }

  if (!data.access_token) {
    integrationLog('error', {
      provider: 'WIZ',
      op: 'oauth_token',
      authHost: safeUrlHost(WIZ_AUTH_URL),
      durationMs: Date.now() - started,
      error: 'Wiz auth response missing access_token',
    });
    const err = new Error('Wiz auth response missing access_token');
    err.statusCode = 502;
    throw err;
  }

  integrationLog('info', {
    provider: 'WIZ',
    op: 'oauth_token',
    authHost: safeUrlHost(WIZ_AUTH_URL),
    durationMs: Date.now() - started,
    ok: true,
  });

  return data.access_token;
}

/**
 * @param {string} graphqlUrl
 * @param {string} accessToken
 * @param {string} query
 * @param {object} [variables]
 */
async function wizGraphql(graphqlUrl, accessToken, query, variables = {}) {
  const started = Date.now();
  const graphqlHost = safeUrlHost(graphqlUrl);
  const res = await fetch(graphqlUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    integrationLog('error', {
      provider: 'WIZ',
      op: 'graphql',
      graphqlHost,
      durationMs: Date.now() - started,
      httpStatus: res.status,
      error: 'Response was not valid JSON',
    });
    const err = new Error(`Wiz GraphQL invalid JSON: ${res.status}`);
    err.statusCode = 502;
    err.detail = text?.slice(0, 300);
    throw err;
  }

  if (!res.ok) {
    integrationLog('error', {
      provider: 'WIZ',
      op: 'graphql',
      graphqlHost,
      durationMs: Date.now() - started,
      httpStatus: res.status,
      error: `Wiz GraphQL HTTP ${res.status}`,
    });
    const err = new Error(`Wiz GraphQL HTTP ${res.status}`);
    err.statusCode = 502;
    err.detail = text?.slice(0, 500);
    throw err;
  }

  if (data.errors?.length) {
    const msg = data.errors.map((e) => e.message).join('; ') || 'GraphQL error';
    integrationLog('error', {
      provider: 'WIZ',
      op: 'graphql',
      graphqlHost,
      durationMs: Date.now() - started,
      httpStatus: res.status,
      error: msg.slice(0, 400),
    });
    const err = new Error(msg);
    err.statusCode = 502;
    err.detail = JSON.stringify(data.errors).slice(0, 800);
    throw err;
  }

  return data.data;
}

const PROJECTS_QUERY = `
  query WizProjectsForFolders($first: Int!, $after: String) {
    projects(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        isFolder
      }
    }
  }
`;

/** Fallback if tenant schema omits isFolder on Project */
const PROJECTS_QUERY_NO_FOLDER_FLAG = `
  query WizProjectsAll($first: Int!, $after: String) {
    projects(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
      }
    }
  }
`;

async function fetchAllProjectPages(url, token, query, filterFolderOnly) {
  const out = [];
  let hasNextPage = true;
  let after = null;
  const pageSize = 100;
  let pageIndex = 0;
  const graphqlHost = safeUrlHost(url);

  while (hasNextPage) {
    pageIndex += 1;
    const data = await wizGraphql(url, token, query, {
      first: pageSize,
      after,
    });

    const conn = data?.projects;
    const nodes = Array.isArray(conn?.nodes) ? conn.nodes : [];
    for (const n of nodes) {
      if (!n?.id || !n?.name) continue;
      if (filterFolderOnly) {
        if (n.isFolder === true) {
          out.push({ id: n.id, name: n.name });
        }
      } else {
        out.push({ id: n.id, name: n.name });
      }
    }

    if (isIntegrationsVerbose()) {
      integrationLog('info', {
        provider: 'WIZ',
        op: 'projects_page',
        graphqlHost,
        pageIndex,
        nodesInPage: nodes.length,
        accumulated: out.length,
        filterFolderOnly,
        hasNextPage: Boolean(conn?.pageInfo?.hasNextPage),
      });
    }

    hasNextPage = Boolean(conn?.pageInfo?.hasNextPage);
    after = conn?.pageInfo?.endCursor || null;
    if (!hasNextPage || nodes.length < pageSize) {
      break;
    }
  }

  return out;
}

/**
 * List Wiz folders (projects with isFolder true when available). Requires decrypted payload
 * { clientId, clientSecret } and IntegrationCredential.baseUrl = GraphQL endpoint.
 *
 * @param {{ clientId: string, clientSecret: string }} decrypted
 * @param {string | null | undefined} graphqlUrl
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function listWizFolders(decrypted, graphqlUrl) {
  const started = Date.now();
  const url = normalizeWizGraphqlUrl(graphqlUrl || '');
  const graphqlHost = safeUrlHost(url);
  const clientId = decrypted.clientId;
  const clientSecret = decrypted.clientSecret;
  if (!clientId || !clientSecret) {
    integrationLog('error', {
      provider: 'WIZ',
      op: 'list_folders',
      graphqlHost,
      durationMs: Date.now() - started,
      error: 'Wiz credentials missing clientId or clientSecret',
    });
    const err = new Error('Wiz credentials missing clientId or clientSecret');
    err.statusCode = 400;
    throw err;
  }

  const oauthStarted = Date.now();
  const token = await fetchWizAccessToken(clientId, clientSecret);
  const oauthMs = Date.now() - oauthStarted;

  let folders;
  let listVariant = 'isFolder';
  try {
    folders = await fetchAllProjectPages(url, token, PROJECTS_QUERY, true);
  } catch (e) {
    const msg = `${e.message || ''} ${e.detail || ''}`;
    if (msg.includes('isFolder') || msg.includes('Cannot query field')) {
      integrationLog('warn', {
        provider: 'WIZ',
        op: 'list_folders',
        graphqlHost,
        durationMs: Date.now() - started,
        message: 'isFolder query failed; retrying without folder filter (all projects)',
        priorError: (e.message || String(e)).slice(0, 200),
      });
      folders = await fetchAllProjectPages(url, token, PROJECTS_QUERY_NO_FOLDER_FLAG, false);
      listVariant = 'all_projects';
    } else {
      integrationLog('error', {
        provider: 'WIZ',
        op: 'list_folders',
        graphqlHost,
        durationMs: Date.now() - started,
        oauthMs,
        error: (e.message || String(e)).slice(0, 400),
        httpStatus: /** @type {{ statusCode?: number }} */ (e).statusCode,
      });
      throw e;
    }
  }

  folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  integrationLog('info', {
    provider: 'WIZ',
    op: 'list_folders',
    graphqlHost,
    listVariant,
    folderCount: folders.length,
    oauthMs,
    durationMs: Date.now() - started,
  });

  return folders;
}
