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
 * One constant rather than a decision spread across call sites; it becomes
 * company config once the shape is proven.
 *
 * ASKED FOR IN ONE QUERY, THEN ONE AT A TIME. Wiz takes an array of types, and
 * forty-eight separate round trips per page load is not a page load. So all of
 * them go in one query first - and because an unknown type makes Wiz reject that
 * whole query rather than skip the bad entry, a rejection falls back to querying
 * each type alone, where the bad one reports itself and the other forty-seven
 * still return their resources.
 */
export const WIZ_RESOURCE_TYPES = Object.freeze([
  // Compute
  'VIRTUAL_MACHINE', 'CONTAINER', 'CONTAINER_IMAGE', 'SERVERLESS', 'SERVERLESS_PACKAGE',
  // Network edge
  'LOAD_BALANCER', 'API_GATEWAY', 'FIREWALL', 'FIREWALL_CONFIGURATION',
  'KUBERNETES_INGRESS', 'KUBERNETES_SERVICE', 'ENDPOINT', 'API_ENDPOINT',
  // Build and supply chain
  'REPOSITORY', 'REPOSITORY_BRANCH', 'CI_WORKFLOW', 'CICD_SERVICE',
  'ARTIFACT_REGISTRY', 'ARTIFACT_REPOSITORY', 'CONTAINER_REGISTRY', 'CONTAINER_REPOSITORY',
  // Secrets and identity
  'SECRET', 'SECRET_INSTANCE', 'CERTIFICATE', 'MANAGED_CERTIFICATE', 'ENCRYPTION_KEY',
  'ACCESS_KEY', 'SERVICE_ACCOUNT', 'ACCESS_ROLE', 'ACCESS_ROLE_BINDING',
  'AUTHENTICATION_CONFIGURATION', 'AUTHENTICATION_POLICY',
  // Application and data
  'HOSTED_APPLICATION', 'HOSTED_TECHNOLOGY', 'WEB_SERVICE', 'APPLICATION',
  'DATABASE', 'BUCKET',
  // Kubernetes
  'KUBERNETES_CLUSTER', 'KUBERNETES_POD_TEMPLATE', 'KUBERNETES_NETWORK_POLICY',
  'NAMESPACE', 'DAEMON_SET', 'DEPLOYMENT', 'STATEFUL_SET',
  // Findings
  'SAST_FINDING', 'ATTACK_SURFACE_FINDING', 'VULNERABILITY',
]);

/**
 * Tag keys Orbit reads. Company-configurable later; the point of naming them here
 * is that nothing else in the codebase should hard-code a key string.
 */
/**
 * The Application tag value meaning "serves the product, not one named
 * application" - a host, a database, a reverse proxy.
 *
 * A resource carries one value per tag key, so a shared host cannot name one
 * application without being wrong for every other workload on it. Tagging it
 * `_shared` says so deliberately; leaving the Application tag off says the same
 * thing by accident. Both are treated the same way, because for the purpose of
 * "what powers this application" they mean the same thing.
 *
 * Reserved: Orbit refuses an application of this name.
 */
export const WIZ_SHARED_APPLICATION_VALUE = '_shared';

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

/** Case- and whitespace-insensitive tag value comparison. */
function sameTagValue(a, b) {
  return (
    typeof a === 'string'
    && typeof b === 'string'
    && a.trim().toLowerCase() === b.trim().toLowerCase()
  );
}

/**
 * Why a resource belongs on an application's list, or null if it does not.
 *
 * Extracted from the paging loop so the rule can be tested without a tenant - the
 * decision is the part worth being sure about, and the part around it is HTTP.
 *
 *   'application' - carries exactly this application's tag
 *   'shared'      - carries the product and is shared: tagged _shared on purpose,
 *                   or carrying no application tag at all. One value per tag key
 *                   means a host serving several applications cannot name one of
 *                   them without being wrong for the rest.
 *   'product'     - a product was asked for and no application, so everything in
 *                   the product belongs in the answer
 *   'all'         - no filter was asked for
 *
 * @param {object} args
 * @param {unknown} args.resourceApplication the resource's Application tag
 * @param {string|null} args.applicationValue the application being viewed
 * @param {string|null} args.productValue
 * @param {boolean} [args.includeUnassigned]
 * @returns {'application'|'shared'|'all'|null}
 */
export function wizResourceMatchReason({
  resourceApplication,
  applicationValue,
  productValue,
  includeUnassigned = true,
}) {
  const applicationText = resourceApplication ? String(resourceApplication).trim() : '';
  const isShared =
    !applicationText || sameTagValue(applicationText, WIZ_SHARED_APPLICATION_VALUE);

  // No application asked for means no application filter. Everything that reached
  // here already passed the product filter, or there was no filter at all, so it
  // belongs in the answer. This clause used to be last and guarded on
  // `!productValue`, which made asking for a product alone return only its SHARED
  // resources - every named application in the product fell through to null.
  if (!applicationValue) return productValue ? 'product' : 'all';

  if (sameTagValue(applicationText, applicationValue)) return 'application';
  if (isShared && includeUnassigned && productValue) return 'shared';
  return null;
}

/**
 * Is this error Wiz saying "I do not know one of those types", or is it the
 * network having a bad day?
 *
 * The per-type fallback exists for the first case: an unknown type makes Wiz
 * reject the whole query, and asking one at a time makes the bad one name
 * itself. It is actively harmful for the second - a 504 on a heavy query became
 * forty-eight sequential retries of the same heavy query, which is slower than
 * the thing that just timed out and no more likely to work.
 *
 * Validation failures come back as 4xx or as a GraphQL error naming the type.
 * Timeouts and gateway errors are 5xx and get no retry.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
function looksLikeTypeRejection(error) {
  const status = /** @type {{ statusCode?: number }} */ (error)?.statusCode;
  if (typeof status === 'number' && status >= 500) return false;
  if (typeof status === 'number' && status >= 400) return true;
  // No status at all: a GraphQL-level error. Only worth splitting up if it
  // mentions the thing we would be splitting.
  const message = String(error?.message || '').toLowerCase();
  return message.includes('type') || message.includes('enum') || message.includes('invalid');
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
export function wizTagWhereCandidates(pairs) {
  const entries = Object.entries(pairs).filter(([, v]) => v);
  if (!entries.length) return [];

  // Wiz's EQUALS is CASE-SENSITIVE. Orbit's own comparison is not, which means
  // the same assigned value behaved differently depending on whether the server
  // predicate ran - "OptimiseRX" found nothing while "OptimiseRx" found
  // everything, and locally both would have matched.
  //
  // EQUALS takes an array, which behaves as OR, so the common casings go in
  // together. That covers what people actually type - as-assigned, lower, upper,
  // and Title - and the authoritative comparison is still the case-insensitive
  // one done on the rows that come back, so nothing extra slips through.
  //
  // It does NOT cover arbitrary casing ("OpTiMiSe"). A resource tagged that way
  // is invisible to the fast path, which is why the result carries
  // `serverFiltered` - a company whose tags are inconsistent enough to hit this
  // should be told rather than quietly under-counted.
  const withCasings = ([key, value]) => {
    const variants = new Set([
      value,
      value.toLowerCase(),
      value.toUpperCase(),
      value.charAt(0).toUpperCase() + value.slice(1).toLowerCase(),
    ]);
    return [...variants].map((v) => ({ key, value: v }));
  };

  return [
    { tags: { EQUALS: entries.flatMap(withCasings) } },
    { tags: entries.flatMap(withCasings) },
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
 * `productValue` narrows further and is optional - an application need not belong
 * to a product, and an application belonging to SEVERAL is left unfiltered by
 * product rather than guessing which one. Less specific beats wrong: an
 * application's resources must all come back, and losing one because the wrong
 * product was picked is the worse failure.
 *
 * With a product and no application, every resource in the product comes back.
 *
 * `includeUnassigned` also returns the product's SHARED resources: those tagged
 * `Application=_shared` on purpose, and those carrying no application tag at all.
 * A resource holds one value per tag key, so a host serving several applications
 * cannot name one of them without being wrong for the rest. Leaving these out is
 * how an application page ends up claiming nothing runs its database.
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

  const token = await fetchWizAccessToken(decrypted.clientId, decrypted.clientSecret);
  const resources = [];
  const errors = [];
  let scanned = 0;

  // Ask Wiz to do the filtering. Only the product tag is pushed down: resources
  // carrying the product and NO application tag are wanted too (the shared ones),
  // and "has this tag OR does not have it" is not a predicate worth constructing.
  // Narrowing to the product is most of the win anyway.
  const whereCandidates = productValue
    ? wizTagWhereCandidates({ [keys.product]: productValue })
    : [];
  let whereClause = null;
  let serverFiltered = false;
  let whereRejected = null;
  let candidateIndex = 0;

  /** One page, settling on a `where` shape the first time it succeeds. */
  async function fetchPage(typeList, after) {
    for (;;) {
      const attempt = whereClause
        ?? (candidateIndex < whereCandidates.length ? whereCandidates[candidateIndex] : null);
      try {
        const data = await wizGraphql(url, token, GRAPH_SEARCH_RESOURCES_QUERY, {
          first: 50,
          after,
          projectId: folderId,
          query: { select: true, type: typeList, ...(attempt ? { where: attempt } : {}) },
        });
        if (attempt && !whereClause) {
          whereClause = attempt;
          serverFiltered = true;
        }
        return data;
      } catch (error) {
        // A settled clause failing is a real error. A candidate failing just means
        // try the next shape, then give up and filter locally.
        if (whereClause || candidateIndex >= whereCandidates.length) throw error;
        whereRejected = (error?.message || String(error)).slice(0, 200);
        candidateIndex += 1;
      }
    }
  }

  /** Page through one query, collecting matches. */
  async function collect(typeList) {
    let after = null;
    let page = 0;
    while (page < maxPages) {
      page += 1;
      const data = await fetchPage(typeList, after);
      const connection = data?.graphSearch;
      if (!connection) throw new Error('Wiz graphSearch response was empty');

      for (const node of connection.nodes || []) {
        for (const entity of node?.entities || []) {
          scanned += 1;
          const tags = wizTagsToObject(parseWizProperties(entity?.properties)?.tags);

          const resourceProduct = readWizTag(tags, keys.product);
          const resourceApplication = readWizTag(tags, keys.application);

          if (productValue && !sameTagValue(resourceProduct, productValue)) continue;

          const match = wizResourceMatchReason({
            resourceApplication,
            applicationValue,
            productValue,
            includeUnassigned,
          });
          if (!match) continue;

          resources.push({
            id: entity?.id || null,
            name: entity?.name || null,
            type: entity?.type || (typeList.length === 1 ? typeList[0] : null),
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
  }

  // All types in one query. Forty-eight round trips per page load is not a page
  // load, and Wiz takes an array.
  let perTypeFallback = false;
  try {
    await collect([...types]);
  } catch (error) {
    if (!looksLikeTypeRejection(error)) {
      // A timeout or a gateway error is the query being too heavy, not a bad type
      // name. Retrying it forty-eight times is slower than the thing that just
      // timed out and no more likely to succeed.
      throw error;
    }

    // An unknown type makes Wiz reject the WHOLE query rather than skip the bad
    // entry, so one wrong name in a configurable list would return nothing at all.
    // Asking one at a time makes the bad one report itself while the others still
    // return their resources.
    perTypeFallback = true;
    resources.length = 0;
    scanned = 0;
    errors.push({ type: '(all types)', message: (error?.message || String(error)).slice(0, 300) });

    for (const type of types) {
      try {
        await collect([type]);
      } catch (typeError) {
        errors.push({ type, message: (typeError?.message || String(typeError)).slice(0, 300) });
      }
    }
  }

  integrationLog('info', {
    provider: 'WIZ',
    op: 'list_resources_for_folder',
    graphqlHost,
    folderId,
    typeCount: types.length,
    perTypeFallback,
    scanned,
    matched: resources.length,
    typeErrors: errors.length,
    serverFiltered,
    durationMs: Date.now() - started,
  });

  return { resources, scanned, errors, serverFiltered, whereRejected, perTypeFallback };
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
