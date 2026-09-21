import { prisma } from '../prisma/client.js';
import { normalizeEnvironmentName } from './environmentNaming.js';

/**
 * Resolving a submitted environment string (from CI or the deployment form) to one
 * of a company's Environment rows, and keeping the matching ApplicationEnvironment
 * instance up to date.
 *
 * Both deployment write paths go through here so they cannot drift:
 *   - routes/deploymentTokens.js  (CI push)
 *   - routes/applications.js      (manual entry)
 */

/**
 * Find the company's environment matching a submitted string.
 *
 * Deliberately does NOT create a missing environment. One typo in a pipeline yaml
 * would otherwise invent an environment that then appears in the environment
 * selector and the Wiz tag picker as though it were real. Unmatched deployments are
 * recorded with a null environmentId and surface as "Unassigned" instead.
 *
 * @param {string} companyId
 * @param {unknown} rawEnvironment value as submitted
 * @returns {Promise<{ normalizedName: string | null, environment: { id: string, name: string, kind: string } | null }>}
 */
export async function resolveEnvironmentForDeployment(companyId, rawEnvironment) {
  const normalizedName = normalizeEnvironmentName(rawEnvironment);
  if (!companyId || !normalizedName) {
    return { normalizedName, environment: null };
  }

  const environment = await prisma.environment.findUnique({
    where: { companyId_name: { companyId, name: normalizedName } },
    select: { id: true, name: true, kind: true },
  });

  return { normalizedName, environment: environment || null };
}

/**
 * Point an application at an environment and record what is deployed there.
 *
 * The instance row is created on demand: once the environment itself is known to
 * the company, an application deploying to it for the first time is a normal event,
 * not something to reject.
 *
 * Version and branch are OVERWRITTEN, not only-filled-when-empty. A deploy is
 * authoritative for its own environment; the previous only-when-null behaviour on
 * Application meant those values froze after the very first deploy. Absent values
 * are left alone, so a deploy that reports no version does not erase a known one.
 *
 * @param {object} args
 * @param {string} args.applicationId
 * @param {string} args.environmentId
 * @param {string | null} [args.version]
 * @param {string | null} [args.gitBranch]
 * @returns {Promise<{ id: string } | null>}
 */
export async function recordDeploymentInstance({
  applicationId,
  environmentId,
  version = null,
  gitBranch = null,
}) {
  if (!applicationId || !environmentId) {
    return null;
  }

  const deployedFields = {};
  if (version) {
    deployedFields.currentVersion = version;
  }
  if (gitBranch) {
    deployedFields.gitBranch = gitBranch;
  }

  return prisma.applicationEnvironment.upsert({
    where: { applicationId_environmentId: { applicationId, environmentId } },
    create: {
      applicationId,
      environmentId,
      ...deployedFields,
    },
    update: deployedFields,
    select: { id: true },
  });
}

/**
 * The whole per-deployment side effect in one call: resolve the string, and when it
 * matches, create or refresh the instance.
 *
 * Returns `environmentId: null` when the string matched nothing — the caller should
 * still record the deployment, leaving it unassigned.
 *
 * @param {object} args
 * @param {string} args.applicationId
 * @param {string} args.companyId
 * @param {unknown} args.rawEnvironment
 * @param {string | null} [args.version]
 * @param {string | null} [args.gitBranch]
 * @returns {Promise<{ environmentId: string | null, applicationEnvironmentId: string | null, matched: boolean, normalizedName: string | null }>}
 */
export async function attachDeploymentToEnvironment({
  applicationId,
  companyId,
  rawEnvironment,
  version = null,
  gitBranch = null,
}) {
  const { normalizedName, environment } = await resolveEnvironmentForDeployment(
    companyId,
    rawEnvironment,
  );

  if (!environment) {
    return {
      environmentId: null,
      applicationEnvironmentId: null,
      matched: false,
      normalizedName,
    };
  }

  const instance = await recordDeploymentInstance({
    applicationId,
    environmentId: environment.id,
    version,
    gitBranch,
  });

  return {
    environmentId: environment.id,
    applicationEnvironmentId: instance?.id || null,
    matched: true,
    normalizedName,
  };
}

/**
 * The environments a company can have deployments assigned to, for the deployment
 * form and for the CI sample payload on the token setup screen.
 *
 * @param {string} companyId
 * @returns {Promise<Array<{ id: string, name: string, kind: string }>>}
 */
export async function listActiveEnvironments(companyId) {
  if (!companyId) {
    return [];
  }
  return prisma.environment.findMany({
    where: { companyId, status: 'active' },
    select: { id: true, name: true, kind: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  });
}
