import { fetchWizAccessToken, normalizeWizGraphqlUrl, wizGraphql } from './wiz.js';

const MAX_PAGES = 60;

/**
 * @param {string} sev
 * @returns {'critical'|'high'|'medium'|'low'|'info'}
 */
function sevToBucket(sev) {
  const s = (sev || '').toString().toUpperCase();
  if (s === 'CRITICAL' || s === 'C' || s === 'FATAL') {
    return 'critical';
  }
  if (s === 'HIGH' || s === 'H') {
    return 'high';
  }
  if (s === 'MEDIUM' || s === 'M' || s === 'MODERATE') {
    return 'medium';
  }
  if (s === 'LOW' || s === 'L') {
    return 'low';
  }
  return 'info';
}

const QUERIES = [
  {
    name: 'issuesV2',
    gql: `query SastExportV2($filter: IssueFilters, $first: Int!, $after: String) {
  issuesV2( first: $first, after: $after, filter: $filter ) {
    pageInfo { hasNextPage endCursor }
    nodes { id severity }
  }
}`,
  },
  {
    name: 'issues',
    gql: `query SastExportI($filter: IssueFilters, $first: Int!, $after: String) {
  issues( first: $first, after: $after, filter: $filter ) {
    pageInfo { hasNextPage endCursor }
    nodes { id severity }
  }
}`,
  },
];

/**
 * Wiz: SAST-only issue counts in a project (folder)
 * @param {{ clientId: string, clientSecret: string }} keys
 * @param {string} graphqlUrl
 * @param {string} projectId
 * @param {object| 'all' | null} timeRange
 */
export async function getWizSastCountsForProject(keys, graphqlUrl, projectId, timeRange) {
  const result = {
    source: 'Wiz SAST',
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    error: /** @type {string|null} */ (null),
  };
  if (!projectId) {
    result.error = 'Wiz project (folder) id is missing';
    return result;
  }
  const url = normalizeWizGraphqlUrl(graphqlUrl);
  const token = await fetchWizAccessToken(keys.clientId, keys.clientSecret);
  const time = timeRange;
  const useTime = time && time !== 'all' && time != null && !time?.all;
  const firstFrom = time?.from ? new Date(time.from) : null;
  const firstTo = time?.to ? new Date(time.to) : null;
  const addTime = (base) => {
    if (!useTime || !firstFrom && !firstTo) {
      return base;
    }
    if (base.firstSeenAt) {
      return base;
    }
    const t = { ...base };
    t.firstSeenAt = {};
    if (firstFrom && !Number.isNaN(firstFrom.getTime())) {
      t.firstSeenAt.from = firstFrom.toISOString();
    }
    if (firstTo && !Number.isNaN(firstTo.getTime())) {
      t.firstSeenAt.to = firstTo.toISOString();
    }
    return t;
  };
  const filterBases = [
    () => addTime({ project: [projectId], dataSources: ['SAST'] }),
    () => addTime({ project: [projectId], dataSource: ['SAST'] }),
    () => addTime({ project: [projectId], type: 'SAST' }),
    () => addTime({ project: [projectId], sourceType: 'SAST' }),
  ];

  let lastErr = 'Wiz: could not read SAST issues (check GraphQL schema)';

  for (const { gql } of QUERIES) {
    for (const makeFilter of filterBases) {
      const filter = makeFilter();
      try {
        const seen = new Set();
        let hasNext = true;
        let after = null;
        result.critical = 0;
        result.high = 0;
        result.medium = 0;
        result.low = 0;
        result.info = 0;
        let page = 0;
        let anyPage = false;
        while (hasNext && page < MAX_PAGES) {
          page += 1;
          const d = await wizGraphql(url, token, gql, {
            filter,
            first: 200,
            after,
          });
          const iss = d?.issuesV2 || d?.issues;
          if (!iss) {
            hasNext = false;
            anyPage = false;
            break;
          }
          anyPage = true;
          const nodes = iss?.nodes || [];
          for (const n of nodes) {
            if (n?.id) {
              if (seen.has(n.id)) {
                continue;
              }
              seen.add(n.id);
            }
            const b = sevToBucket(n?.severity);
            if (b === 'critical') {
              result.critical += 1;
            } else if (b === 'high') {
              result.high += 1;
            } else if (b === 'medium') {
              result.medium += 1;
            } else if (b === 'low') {
              result.low += 1;
            } else {
              result.info += 1;
            }
          }
          hasNext = Boolean(iss?.pageInfo?.hasNextPage);
          after = iss?.pageInfo?.endCursor || null;
        }
        if (anyPage) {
          result.error = null;
          return result;
        }
      } catch (e) {
        const err = /** @type {Error} */ (e);
        lastErr = err.message || 'Wiz GraphQL error';
      }
    }
  }
  result.error = lastErr;
  return result;
}
