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
    '-lc',
    // Ensure runner has prerequisites. `docker compose` is a plugin on Alpine via docker-cli-compose.
    // Also install `git` (for fetch/pull) and `wget` (for optional deployment recording).
    [
      'set -eu',
      'apk add --no-cache git docker-cli-compose wget >/dev/null 2>&1 || true',
      // Git may refuse to operate on a bind-mounted repo owned by a different UID (dubious ownership).
      // This is safe in the ephemeral runner container and avoids false "not a repo" detection.
      'git config --global --add safe.directory /workspace >/dev/null 2>&1 || true',
      // If the host repo is behind (e.g. new file added), pull before trying to run.
      'if [ ! -f scripts/prod-deploy.sh ]; then',
      '  echo "[deploy] scripts/prod-deploy.sh missing; attempting git fetch/pull in host workdir"',
      '  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then',
      '    git fetch --prune || true',
      '    git pull --ff-only || true',
      '  else',
      '    echo "[deploy] not a git repo; cannot auto-pull updates" >&2',
      '  fi',
      'fi',
      'if [ ! -f scripts/prod-deploy.sh ]; then',
      '  echo "[deploy] still missing scripts/prod-deploy.sh at $(pwd)" >&2',
      '  echo "[deploy] contents of scripts/:" >&2',
      '  ls -la scripts 2>/dev/null || true',
      '  exit 2',
      'fi',
      `sh scripts/prod-deploy.sh ${t}`,
    ].join('; '),
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

