/**
 * SCM provider registry + provider-agnostic helpers.
 *
 * To add a provider (GitLab, self-hosted variants): implement the
 * ScmProvider contract in a new adapter and register it in PROVIDERS below. GitHub, Bitbucket
 * Cloud, and Azure DevOps are already registered. Everything else — the routes, the
 * dependency/framework/language detection, the storage, and the whole frontend — is
 * already provider-agnostic.
 *
 * @typedef {Object} ScmProvider
 * @property {string} id
 * @property {string} host
 * @property {() => boolean} isConfigured
 * @property {(state: string) => string} startConnect         // begin an OAuth/app connection
 * @property {(code: string) => Promise<{token, refreshToken?, externalUserId, login, avatarUrl, scopes}>} exchangeOAuthCode
 * @property {(connection: object) => Promise<Array<object>>} listRepos
 * @property {(connection: object, owner: string, name: string) => Promise<{metadata, languages, dependencies}>} fetchRepoIntel
 */
import { githubProvider } from './githubProvider.js';
import { bitbucketProvider } from './bitbucketProvider.js';
import { azureDevopsProvider } from './azureDevopsProvider.js';
import { PROVIDER_GITHUB, PROVIDER_BITBUCKET, PROVIDER_AZURE_DEVOPS } from '../../integrations/constants.js';

/** @type {Record<string, ScmProvider>} */
const PROVIDERS = {
  [PROVIDER_GITHUB]: githubProvider,
  [PROVIDER_BITBUCKET]: bitbucketProvider,
  [PROVIDER_AZURE_DEVOPS]: azureDevopsProvider,
};

/** @returns {ScmProvider} */
export function getScmProvider(providerId) {
  const provider = PROVIDERS[providerId];
  if (!provider) {
    const err = new Error(`Unsupported SCM provider: ${providerId}`);
    err.statusCode = 400;
    throw err;
  }
  return provider;
}

/** Provider ids that are fully configured (env present) — for the connect UI. */
export function listConfiguredProviders() {
  return Object.values(PROVIDERS)
    .filter((p) => p.isConfigured())
    .map((p) => ({ id: p.id, host: p.host }));
}

/** Fetch repo intel using the connection's provider adapter. */
export function fetchRepoIntel(connection, owner, name) {
  return getScmProvider(connection.provider).fetchRepoIntel(connection, owner, name);
}

/** List a connection's accessible repos using its provider adapter. */
export function listReposForConnection(connection) {
  return getScmProvider(connection.provider).listRepos(connection);
}

/**
 * Replace the stored dependency inventory for a repo (delete-all + recreate), so a re-sync reflects
 * added and removed packages. Provider-agnostic (writes RepoDependency).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} scmRepoId ScmRepo.id (our cuid)
 * @param {Array<object>} rows
 */
export async function saveRepoDependencies(prisma, scmRepoId, rows) {
  await prisma.$transaction([
    prisma.repoDependency.deleteMany({ where: { githubRepoId: scmRepoId } }),
    ...(rows.length
      ? [
          prisma.repoDependency.createMany({
            data: rows.map((r) => ({
              githubRepoId: scmRepoId,
              ecosystem: r.ecosystem,
              name: r.name,
              version: r.version,
              versionRange: r.versionRange,
              isFramework: r.isFramework,
              framework: r.framework,
              source: r.source,
              resolvedFrom: r.resolvedFrom,
              osvScanned: r.osvScanned ?? false,
              osvVulnIds: r.osvVulnIds ?? undefined,
              osvVulns: r.osvVulns ?? undefined,
              osvScannedAt: r.osvScannedAt ?? undefined,
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);
}

export { topLanguagesString, frameworkLabelsString } from './parsers.js';
