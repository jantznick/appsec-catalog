import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function getRepoRoot() {
  return process.env.PRODUCT_UPDATES_GIT_WORKDIR
    || process.env.DEPLOY_HOST_WORKDIR
    || path.resolve(process.cwd(), '..');
}

export async function getRecentGitCommits(limit = 25) {
  const safeLimit = Math.min(Math.max(Number.parseInt(String(limit), 10) || 25, 1), 100);
  const format = '%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s';
  const { stdout } = await execFileAsync(
    'git',
    ['-c', `safe.directory=${getRepoRoot()}`, 'log', `--max-count=${safeLimit}`, `--pretty=format:${format}`],
    {
      cwd: getRepoRoot(),
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    },
  );

  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash, shortHash, authorName, authorEmail, committedAt, subject] = line.split('\x1f');
      return {
        hash,
        shortHash,
        authorName,
        authorEmail,
        committedAt,
        subject,
      };
    });
}
