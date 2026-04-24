import { randomUUID } from 'node:crypto';

/** @type {Map<string, { status: 'queued'|'running'|'complete'|'error', message?: string, createdAt: number, csv?: string, error?: string }>} */
const store = new Map();
const MAX_AGE_MS = 45 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [id, j] of store) {
    if (now - j.createdAt > MAX_AGE_MS) {
      store.delete(id);
    }
  }
}
setInterval(cleanup, 60_000);

export function createJob() {
  const id = randomUUID();
  store.set(id, { status: 'queued', message: 'Queued', createdAt: Date.now() });
  return id;
}

export function updateJob(id, patch) {
  const j = store.get(id);
  if (!j) {
    return;
  }
  store.set(id, { ...j, ...patch, createdAt: j.createdAt });
}

export function getJob(id) {
  return store.get(id);
}
