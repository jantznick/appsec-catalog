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
 * @property {((connection: object, owner: string, name: string, branch: string) => Promise<BranchProtection>)} [fetchBranchProtection]
 *           Optional. Omit it and the registry reports the provider as unsupported
 *           rather than the repo as unprotected — see fetchBranchProtection below.
 *
 * @typedef {Object} BranchProtection
 * Normalised branch protection, provider-agnostic. Every field is nullable:
 * null means "unknown", which is deliberately distinct from false.
 * @property {string|null} protectedBranch
 * @property {boolean|null} branchProtectionEnabled
 * @property {number|null} requiredApprovingReviewCount
 * @property {boolean|null} dismissStaleReviews
 * @property {boolean|null} requireCodeOwnerReviews
 * @property {boolean|null} requiresStatusChecks
 * @property {boolean|null} enforcedForAdmins
 * @property {boolean|null} allowsForcePushes
 * @property {string|null} branchProtectionError
 */
import { githubProvider } from './githubProvider.js';
import { bitbucketProvider } from './bitbucketProvider.js';
import { azureDevopsProvider } from './azureDevopsProvider.js';
import { PROVIDER_GITHUB, PROVIDER_BITBUCKET, PROVIDER_AZURE_DEVOPS } from '../../integrations/constants.js';
import { unknownPrTemplate } from './prTemplate.js';

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

/** A BranchProtection with everything unknown, carrying the reason. */
export function unknownBranchProtection(reason, branch = null) {
  return {
    protectedBranch: branch,
    branchProtectionEnabled: null,
    requiredApprovingReviewCount: null,
    dismissStaleReviews: null,
    requireCodeOwnerReviews: null,
    requiresStatusChecks: null,
    enforcedForAdmins: null,
    allowsForcePushes: null,
    branchProtectionError: reason,
  };
}

/**
 * Read branch protection for a repo's default branch.
 *
 * A provider that does not implement it yields "unknown" with a reason rather
 * than an unprotected-looking result. That distinction matters: reporting an
 * Azure DevOps repo as having no required reviewers, when we simply never
 * asked, would fail its applications for a control they may well satisfy.
 *
 * @param {object} connection
 * @param {string} owner
 * @param {string} name
 * @param {string|null} branch default branch; null lets the provider resolve it
 * @returns {Promise<BranchProtection>}
 */
/**
 * Find the repo's pull-request template and whether it prompts for security.
 *
 * Same contract as fetchBranchProtection: never throws, and a provider without
 * an implementation yields "unknown" rather than "no template" — absence of an
 * adapter is not evidence about the repo.
 *
 * @returns {Promise<import('./prTemplate.js').PullRequestTemplate>}
 */
export async function fetchPullRequestTemplate(connection, owner, name) {
  try {
    const provider = getScmProvider(connection?.provider);
    if (typeof provider.fetchPullRequestTemplate !== 'function') {
      return unknownPrTemplate(`Pull request template detection is not supported for ${provider.id} yet`);
    }
    return await provider.fetchPullRequestTemplate(connection, owner, name);
  } catch (e) {
    return unknownPrTemplate(e?.message || 'Failed to read pull request template');
  }
}

export async function fetchBranchProtection(connection, owner, name, branch = null) {
  // getScmProvider throws on an unregistered provider id, so it belongs inside
  // the try: this function is called during repo sync and must never be the
  // reason a sync fails.
  try {
    const provider = getScmProvider(connection?.provider);
    if (typeof provider.fetchBranchProtection !== 'function') {
      return unknownBranchProtection(`Branch protection is not supported for ${provider.id} yet`, branch);
    }
    return await provider.fetchBranchProtection(connection, owner, name, branch);
  } catch (e) {
    return unknownBranchProtection(e?.message || 'Failed to read branch protection', branch);
  }
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
