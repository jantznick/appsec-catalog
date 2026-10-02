import { prisma } from '../prisma/client.js';
import {
  PRIMARY_ENVIRONMENT_KIND,
  canonicalEnvironmentName,
  normalizeEnvironmentName,
} from './environmentNaming.js';

/** What a company's production environment is called until someone renames it. */
export const DEFAULT_PRODUCTION_ENVIRONMENT_NAME = canonicalEnvironmentName(PRIMARY_ENVIRONMENT_KIND, null);

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
 * ONE INDEXED LOOKUP. Every string an environment answers to - its canonical name
 * and every extra spelling - is a row in EnvironmentName, unique per company, so
 * this is a primary-key hit rather than a scan-and-compare.
 *
 * NO INFERENCE, EVER. A string that matches no row does not fall back to a kind, a
 * fuzzy match or a nearest neighbour - it goes to Unassigned. "production" does not
 * quietly become "prod". That looks unhelpful and is the entire point: the mismatch
 * between what a pipeline sends and what the company configured is exactly the
 * misconfiguration this feature exists to surface, and absorbing it silently would
 * mean a company could never find out. The fix is to add the string as an alias -
 * one click from the Unassigned bucket - not to guess.
 *
 * Deliberately does NOT create a missing environment either. One typo in a pipeline
 * yaml would otherwise invent an environment that then appears in the environment
 * selector and the Wiz tag picker as though it were real.
 *
 * Retired environments still resolve. The deploy really happened, and refusing to
 * record where would lose more than it protects.
 *
 * @param {string} companyId
 * @param {unknown} rawEnvironment value as submitted
 * @returns {Promise<{ normalizedName: string | null, environment: { id: string, name: string, kind: string } | null, matchedAlias: boolean }>}
 */
export async function resolveEnvironmentForDeployment(companyId, rawEnvironment) {
  const normalizedName = normalizeEnvironmentName(rawEnvironment);
  if (!companyId || !normalizedName) {
    return { normalizedName, environment: null, matchedAlias: false };
  }

  const match = await prisma.environmentName.findUnique({
    where: { companyId_value: { companyId, value: normalizedName } },
    select: {
      isCanonical: true,
      environment: { select: { id: true, name: true, kind: true } },
    },
  });

  if (!match?.environment) {
    return { normalizedName, environment: null, matchedAlias: false };
  }

  return {
    normalizedName,
    environment: match.environment,
    matchedAlias: !match.isCanonical,
  };
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
  const { normalizedName, environment, matchedAlias } = await resolveEnvironmentForDeployment(
    companyId,
    rawEnvironment,
  );

  if (!environment) {
    return {
      environmentId: null,
      applicationEnvironmentId: null,
      matched: false,
      matchedAlias: false,
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
    matchedAlias,
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
    select: {
      id: true,
      name: true,
      kind: true,
      names: { select: { value: true, isCanonical: true }, orderBy: { isCanonical: 'desc' } },
    },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  });
}

/**
 * Give an application a production environment instance, creating the company's
 * PRODUCTION vocabulary row first if it does not have one.
 *
 * Called when an application is created. Without it the "every application has at
 * least one environment" invariant holds only for the 91 rows the migration seeded
 * and decays from there: nothing else creates an instance except an actual deploy,
 * so a freshly onboarded application would have no environments, no primary, and a
 * null currentVersion that reads as a gap nobody can fill through the UI.
 *
 * The instance is created EMPTY. No version, no branch. The point is to have the
 * structure in place, not to invent facts - "we know nothing about this
 * application's environments" is the honest state and completeness reports it.
 *
 * Creating the vocabulary row here does not contradict the never-auto-create rule
 * in resolveEnvironmentForDeployment. That rule is about not inventing environments
 * from untrusted pipeline strings; this is a company that demonstrably has
 * production and simply has not been asked to name it yet. The name defaults to
 * "production" and the settings screen is where they change it to whatever they
 * actually call it.
 *
 * @param {object} args
 * @param {string} args.applicationId
 * @param {string} args.companyId
 * @param {import('@prisma/client').PrismaClient | object} [args.client] transaction client
 * @returns {Promise<{ id: string } | null>}
 */
export async function ensureDefaultEnvironmentInstance({ applicationId, companyId, client = prisma }) {
  if (!applicationId || !companyId) {
    return null;
  }

  let environment = await client.environment.findFirst({
    where: { companyId, kind: PRIMARY_ENVIRONMENT_KIND },
    select: { id: true },
  });

  if (!environment) {
    environment = await client.environment.create({
      data: {
        companyId,
        name: DEFAULT_PRODUCTION_ENVIRONMENT_NAME,
        kind: PRIMARY_ENVIRONMENT_KIND,
        description: 'Created automatically so every application has a production environment. Add the names your pipelines actually send to it in settings.',
        // The canonical name has to exist as a row too, or nothing resolves to this
        // environment and a later OTHER could claim "production" for itself.
        names: {
          create: [{ companyId, value: DEFAULT_PRODUCTION_ENVIRONMENT_NAME, isCanonical: true }],
        },
      },
      select: { id: true },
    });
  }

  return client.applicationEnvironment.upsert({
    where: {
      applicationId_environmentId: { applicationId, environmentId: environment.id },
    },
    create: { applicationId, environmentId: environment.id },
    update: {},
    select: { id: true },
  });
}
