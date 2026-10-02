import { graphQlOpNameFromQuery, integrationLog, isIntegrationsVerbose, logExportVendorRequest, safeUrlHost } from './log.js';

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

  logExportVendorRequest({
    provider: 'WIZ',
    method: 'POST',
    url: WIZ_AUTH_URL,
    label: 'OAuth2 client_credentials (wiz-api)',
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
export async function wizGraphql(graphqlUrl, accessToken, query, variables = {}) {
  const started = Date.now();
  const graphqlHost = safeUrlHost(graphqlUrl);
  const opName = graphQlOpNameFromQuery(query);
  logExportVendorRequest({
    provider: 'WIZ',
    method: 'POST',
    url: graphqlUrl,
    label: opName ? `GraphQL ${opName}` : 'GraphQL',
  });
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

const GRAPH_SEARCH_TAGS_QUERY = `
  query WizGraphSearchForTags(
    $query: GraphEntityQueryInput
    $projectId: String!
    $first: Int
    $after: String
  ) {
    graphSearch(
      query: $query
      projectId: $projectId
      first: $first
      after: $after
      # Wiz does not support pagination in quick mode. Tag discovery needs
      # multiple pages so use the regular graph search mode.
      quick: false
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        entities { properties }
      }
    }
  }
`;

function parseWizProperties(properties) {
  if (!properties) return null;
  if (typeof properties === 'object') return properties;
  if (typeof properties !== 'string') return null;
  try {
    return JSON.parse(properties);
  } catch {
    return null;
  }
}

function normalizeWizTagValues(rawTags) {
  if (!rawTags) return [];
  if (Array.isArray(rawTags)) {
    return rawTags.flatMap((tag) => {
      if (typeof tag === 'string') return [tag.trim()];
      if (!tag || typeof tag !== 'object') return [];
      const key = tag.key || tag.name;
      const value = tag.value;
      if (key && value != null) return [`${key}:${value}`];
      if (value != null) return [String(value).trim()];
      return [];
    });
  }
  if (typeof rawTags === 'object') {
    return Object.entries(rawTags).map(([key, value]) => `${key}:${value}`).filter(Boolean);
  }
  return [String(rawTags).trim()];
}

/**
 * List distinct resource tag values inside a company-scoped Wiz folder.
 * The folder is sent as a Wiz server-side filter; it is never applied only
 * in the browser or after an unscoped tenant-wide response.
 *
 * @param {{ clientId: string, clientSecret: string }} decrypted
 * @param {string | null | undefined} graphqlUrl
 * @param {string} folderId
 * @returns {Promise<Array<{ uuid: string, value: string, display_label: string }>>}
 */
/**
 * Resource types the resource listing asks for.
 *
 * Two to start. Widening this is the expected next step and is deliberately a
 * single constant rather than a decision spread across call sites - it becomes
 * company config once the shape is proven. Each type is asked for separately,
 * because an unknown type makes Wiz reject the whole query.
 */
export const WIZ_RESOURCE_TYPES = Object.freeze(['VIRTUAL_MACHINE', 'CONTAINER']);

/**
 * Tag keys Orbit reads. Company-configurable later; the point of naming them here
 * is that nothing else in the codebase should hard-code a key string.
 */
export const WIZ_TAG_KEYS = Object.freeze({
  product: 'Product',
  application: 'Application',
  environment: 'Environment',
  role: 'Role',
});

const GRAPH_SEARCH_RESOURCES_QUERY = `
  query WizResourcesForFolder(
    $query: GraphEntityQueryInput
    $projectId: String!
    $first: Int
    $after: String
  ) {
    graphSearch(query: $query, projectId: $projectId, first: $first, after: $after, quick: false) {
      pageInfo { hasNextPage endCursor }
      nodes {
        entities { id name type properties }
      }
    }
  }
`;

/**
 * A resource's tags as an OBJECT, keyed by tag name.
 *
 * normalizeWizTagValues flattens every tag in a folder into one list of
 * "key:value" strings, which cannot answer "does THIS resource carry both
 * Product=X and Application=Y" - the question the whole filter rests on. This
 * keeps tags attached to the resource they came from.
 *
 * Keys are trimmed. A tag key with a trailing space is a real thing that happens
 * in cloud estates, and `"SupportTeam "` silently not matching `"SupportTeam"`
 * is the kind of fault nobody finds.
 *
 * @param {unknown} rawTags
 * @returns {Record<string, string>}
 */
export function wizTagsToObject(rawTags) {
  const out = {};
  if (!rawTags) return out;

  const put = (key, value) => {
    const k = typeof key === 'string' ? key.trim() : String(key ?? '').trim();
    if (k) out[k] = value == null ? '' : String(value);
  };

  if (Array.isArray(rawTags)) {
    for (const tag of rawTags) {
      if (typeof tag === 'string') {
        const idx = tag.indexOf(':');
        if (idx > 0) put(tag.slice(0, idx), tag.slice(idx + 1).trim());
      } else if (tag && typeof tag === 'object') {
        put(tag.key ?? tag.name, tag.value);
      }
    }
    return out;
  }

  if (typeof rawTags === 'object') {
    for (const [key, value] of Object.entries(rawTags)) put(key, value);
  }
  return out;
}

/** Case-insensitive tag read, because a tag key's case is not ours to rely on. */
export function readWizTag(tags, key) {
  if (!tags || !key) return null;
  if (Object.prototype.hasOwnProperty.call(tags, key)) return tags[key];
  const lower = String(key).toLowerCase();
  for (const [k, v] of Object.entries(tags)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}

/**
 * Candidate `where` shapes for filtering on a tag inside Wiz, most specific first.
 *
 * WHY A LADDER AND NOT ONE SHAPE
 *
 * Pushing the tag filter into Wiz is the difference between asking for the handful
 * of resources an application runs on and pulling every virtual machine in the
 * folder to sift locally. It is obviously right - but GraphEntityQueryInput's
 * predicate syntax for tags is not something this codebase has ever exercised, and
 * getting it wrong means Wiz rejects the whole query rather than returning a few
 * extra rows.
 *
 * So each shape is tried once per tenant and the first one Wiz accepts is reused.
 * If none are accepted the caller falls back to filtering locally, which is slower
 * and chattier but correct. `serverFiltered` in the result says which happened, so
 * nobody has to guess whether the fast path is live.
 *
 * @param {Record<string,string>} pairs tag key -> required value
 * @returns {Array<object>} candidate `where` clauses
 */
function wizTagWhereCandidates(pairs) {
  const entries = Object.entries(pairs).filter(([, v]) => v);
  if (!entries.length) return [];

  return [
    { tags: { EQUALS: entries.map(([key, value]) => ({ key, value })) } },
    { tags: entries.map(([key, value]) => ({ key, value })) },
    Object.fromEntries(entries.map(([key, value]) => [`tags.${key}`, { EQUALS: value }])),
  ];
}

/**
 * The resources in a folder that match a product and/or application tag value.
 *
 * THE FOLDER IS REQUIRED and is the company. No folder, no call - a tenant-wide
 * query is never issued, so one company can never see another's resources through
 * a missing filter.
 *
 * `applicationValue` narrows to resources carrying that Application tag.
 * `productValue` narrows further and is optional, because an application need not
 * belong to a product.
 *
 * `includeUnassigned` also returns resources that carry the product tag but NO
 * application tag. Those are the shared ones - a host serving the product rather
 * than one named application - and leaving them out is how an application page
 * ends up claiming nothing runs its database.
 *
 * Environment and Role are read and returned, never filtered on. They are context
 * on a resource, not part of deciding which resources these are.
 *
 * @param {{ clientId: string, clientSecret: string }} decrypted
 * @param {string | null | undefined} graphqlUrl
 * @param {string} folderId
 * @param {object} options
 * @param {string | null} [options.productValue]
 * @param {string | null} [options.applicationValue]
 * @param {boolean} [options.includeUnassigned]
 * @param {string[]} [options.types]
 * @param {Record<string,string>} [options.tagKeys] per-company key names
 * @param {number} [options.maxPages]
 * @returns {Promise<{ resources: Array<object>, scanned: number, errors: Array<{type: string, message: string}>, serverFiltered: boolean, whereRejected: string|null }>}
 *   `serverFiltered` is false when Wiz rejected every tag predicate and the
 *   narrowing happened locally - correct, but it means `scanned` is the whole
 *   folder rather than a slice of it.
 */
export async function listWizResourcesForFolder(decrypted, graphqlUrl, folderId, options = {}) {
  const started = Date.now();
  const url = normalizeWizGraphqlUrl(graphqlUrl || '');
  const graphqlHost = safeUrlHost(url);

  if (!folderId || typeof folderId !== 'string') {
    const err = new Error('Wiz folder id is required before listing resources');
    err.statusCode = 400;
    throw err;
  }
  if (!decrypted?.clientId || !decrypted?.clientSecret) {
    const err = new Error('Wiz credentials missing clientId or clientSecret');
    err.statusCode = 400;
    throw err;
  }

  const keys = { ...WIZ_TAG_KEYS, ...(options.tagKeys || {}) };
  const types = options.types?.length ? options.types : WIZ_RESOURCE_TYPES;
  const maxPages = options.maxPages ?? 20;
  const productValue = options.productValue ? String(options.productValue).trim() : null;
  const applicationValue = options.applicationValue ? String(options.applicationValue).trim() : null;
  const includeUnassigned = options.includeUnassigned !== false;

  const sameValue = (a, b) =>
    typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();

  const token = await fetchWizAccessToken(decrypted.clientId, decrypted.clientSecret);
  const resources = [];
  const errors = [];
  let scanned = 0;

  // Ask Wiz to do the filtering. Only the product tag is pushed down: resources
  // carrying the product and NO application tag are wanted too (the shared ones),
  // and "has this tag OR does not have it" is not a predicate worth constructing.
  // Narrowing to the product is most of the win anyway - it is the difference
  // between a product's resources and the whole folder.
  const whereCandidates = productValue
    ? wizTagWhereCandidates({ [keys.product]: productValue })
    : [];
  let whereClause = null;
  let serverFiltered = false;
  let whereRejected = null;

  for (const type of types) {
    let after = null;
    let page = 0;
    let candidateIndex = 0;
    try {
      while (page < maxPages) {
        page += 1;

        // Settle on a `where` the first time we query, then stop experimenting.
        let data;
        while (true) {
          const attempt = whereClause
            ?? (candidateIndex < whereCandidates.length ? whereCandidates[candidateIndex] : null);
          try {
            data = await wizGraphql(url, token, GRAPH_SEARCH_RESOURCES_QUERY, {
              first: 50,
              after,
              projectId: folderId,
              query: { select: true, type: [type], ...(attempt ? { where: attempt } : {}) },
            });
            if (attempt && !whereClause) {
              whereClause = attempt;
              serverFiltered = true;
            }
            break;
          } catch (error) {
            // A settled clause failing is a real error; a candidate failing just
            // means try the next shape, then give up and filter locally.
            if (whereClause || candidateIndex >= whereCandidates.length) throw error;
            whereRejected = (error?.message || String(error)).slice(0, 200);
            candidateIndex += 1;
          }
        }

        const connection = data?.graphSearch;
        if (!connection) throw new Error('Wiz graphSearch response was empty');

        for (const node of connection.nodes || []) {
          for (const entity of node?.entities || []) {
            scanned += 1;
            const tags = wizTagsToObject(parseWizProperties(entity?.properties)?.tags);

            const resourceProduct = readWizTag(tags, keys.product);
            const resourceApplication = readWizTag(tags, keys.application);

            if (productValue && !sameValue(resourceProduct, productValue)) continue;

            const hasApplication = Boolean(resourceApplication && String(resourceApplication).trim());
            let match = null;
            if (applicationValue && sameValue(resourceApplication, applicationValue)) {
              match = 'application';
            } else if (!hasApplication && includeUnassigned && productValue) {
              // Carries the product but names no application: shared infrastructure.
              match = 'shared';
            } else if (!applicationValue && !productValue) {
              match = 'all';
            }
            if (!match) continue;

            resources.push({
              id: entity?.id || null,
              name: entity?.name || null,
              type: entity?.type || type,
              match,
              product: resourceProduct || null,
              application: resourceApplication || null,
              environment: readWizTag(tags, keys.environment) || null,
              role: readWizTag(tags, keys.role) || null,
              tags,
            });
          }
        }

        if (!connection.pageInfo?.hasNextPage) break;
        after = connection.pageInfo.endCursor || null;
      }
    } catch (error) {
      // One bad type must not lose the resources the others found. An unknown type
      // makes Wiz reject that query outright, and the type list is going to become
      // company config, so a wrong entry there is a thing to report rather than a
      // reason to return nothing.
      errors.push({ type, message: (error?.message || String(error)).slice(0, 300) });
    }
  }

  integrationLog('info', {
    provider: 'WIZ',
    op: 'list_resources_for_folder',
    graphqlHost,
    folderId,
    types: types.join(','),
    scanned,
    matched: resources.length,
    typeErrors: errors.length,
    serverFiltered,
    durationMs: Date.now() - started,
  });

  return { resources, scanned, errors, serverFiltered, whereRejected };
}

export async function listWizTagsForFolder(decrypted, graphqlUrl, folderId) {
  const started = Date.now();
  const url = normalizeWizGraphqlUrl(graphqlUrl || '');
  const graphqlHost = safeUrlHost(url);
  if (!folderId || typeof folderId !== 'string') {
    const err = new Error('Wiz folder id is required before listing application tags');
    err.statusCode = 400;
    throw err;
  }
  if (!decrypted?.clientId || !decrypted?.clientSecret) {
    const err = new Error('Wiz credentials missing clientId or clientSecret');
    err.statusCode = 400;
    throw err;
  }

  const token = await fetchWizAccessToken(decrypted.clientId, decrypted.clientSecret);
  try {
      const values = new Set();
      let after = null;
      let hasNextPage = true;
      let page = 0;
      while (hasNextPage && page < 100) {
        page += 1;
        const data = await wizGraphql(url, token, GRAPH_SEARCH_TAGS_QUERY, {
          first: 50,
          after,
          projectId: folderId,
          // GraphEntityQueryInput requires a resource type in this tenant.
          // Match the known-good Wiz graphSearch payload supplied for this
          // integration instead of sending a partial input object.
          query: {
            select: true,
            type: ['VIRTUAL_MACHINE'],
          },
        });
        const connection = data?.graphSearch;
        if (!connection) throw new Error('Wiz graphSearch response was empty');
        for (const node of connection.nodes || []) {
          for (const entity of node?.entities || []) {
            const props = parseWizProperties(entity?.properties);
            for (const tag of normalizeWizTagValues(props?.tags)) {
              if (tag) values.add(tag);
            }
          }
        }
        hasNextPage = Boolean(connection.pageInfo?.hasNextPage);
        after = connection.pageInfo?.endCursor || null;
      }
      const tags = [...values]
        .filter((value) => value.startsWith('Application:'))
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
        .map((value) => ({ uuid: value, value, display_label: value }));
      integrationLog('info', {
        provider: 'WIZ',
        op: 'list_tags_for_folder',
        graphqlHost,
        folderId,
        tagCount: tags.length,
        durationMs: Date.now() - started,
      });
      return tags;
  } catch (error) {
    integrationLog('error', {
      provider: 'WIZ',
      op: 'list_tags_for_folder',
      graphqlHost,
      folderId,
      durationMs: Date.now() - started,
      error: error?.message || 'Unable to list Wiz tags for folder',
      detail: error?.detail ? String(error.detail).slice(0, 500) : undefined,
    });
    throw error;
  }
}
