import { spawn } from 'node:child_process';

const VALID_TARGETS = new Set(['frontend', 'backend', 'both']);

/**
 * Triggers a production deploy by launching a short-lived docker runner container
 * that runs `scripts/prod-deploy.sh` from the host-mounted repo directory.
 *
 * This avoids running `docker compose` directly inside the backend container while it is being replaced.
 */
export async function triggerProdDeploy({ target, version }) {
  const t = target || 'both';
  if (!VALID_TARGETS.has(t)) {
    const err = new Error('target must be one of: frontend, backend, both');
    // @ts-ignore
    err.statusCode = 400;
    throw err;
  }

  const hostWorkdir = process.env.DEPLOY_HOST_WORKDIR;
  if (!hostWorkdir) {
    const err = new Error('DEPLOY_HOST_WORKDIR is not configured');
    // @ts-ignore
    err.statusCode = 500;
    throw err;
  }

  const runnerImage = process.env.DEPLOY_RUNNER_IMAGE || 'docker:cli';

  const envPairs = [
    ['APPSEC_CATALOG_API_URL', process.env.APPSEC_CATALOG_API_URL],
    ['APPSEC_CATALOG_DEPLOYMENT_TOKEN', process.env.APPSEC_CATALOG_DEPLOYMENT_TOKEN],
    ['APPSEC_CATALOG_DEPLOY_ENV', process.env.APPSEC_CATALOG_DEPLOY_ENV],
    ['APPSEC_CATALOG_FRONTEND_APP_ID', process.env.APPSEC_CATALOG_FRONTEND_APP_ID],
    ['APPSEC_CATALOG_BACKEND_APP_ID', process.env.APPSEC_CATALOG_BACKEND_APP_ID],
    ['APPSEC_CATALOG_DEPLOY_VERSION', version || undefined],
  ].filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '');

  const dockerArgs = [
    'run',
    '--rm',
    '-v',
    '/var/run/docker.sock:/var/run/docker.sock',
    '-v',
    `${hostWorkdir}:/workspace`,
    '-w',
    '/workspace',
    ...envPairs.flatMap(([k, v]) => ['-e', `${k}=${v}`]),
    runnerImage,
    'sh',
    'scripts/prod-deploy.sh',
    t,
  ];

  return await new Promise((resolve, reject) => {
    const child = spawn('docker', dockerArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true, target: t, output: stdout.trim() });
      } else {
        const error = new Error(`Deploy failed (exit ${code})`);
        // @ts-ignore
        error.statusCode = 500;
        // @ts-ignore
        error.details = { stdout, stderr };
        reject(error);
      }
    });
  });
}

