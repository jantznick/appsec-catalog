/**
 * Stored files for program content assets. See PROGRAM_CONTENT_PLAN.md.
 *
 * Files live under backend/storage/program-content/<program>/<releaseId>/, which
 * is inside the existing `backend_storage` Docker volume so persistence is
 * already handled. Critically, this subtree is NOT served statically: the
 * /storage mount is scoped to /storage/domain-snapshots, so the only way to
 * read one of these is the authenticated download route.
 *
 * Trust model: the client supplies bytes and a filename, nothing else. Every
 * path component is server-generated, so there is no request value that can
 * steer a write or read outside the storage root.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const STORAGE_ROOT = path.resolve(process.cwd(), 'storage', 'program-content');

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * Extension allowlist, deny-by-default. Anything absent is rejected, which is
 * why there's no matching blocklist — but note deliberately absent entries:
 *
 *   .html/.htm/.svg/.xhtml — active content. Even though downloads are forced
 *   with Content-Disposition: attachment, a stored HTML or SVG file is a
 *   standing XSS payload the moment anyone serves this subtree inline or a
 *   future change relaxes the disposition. Not worth the risk for a file type
 *   nobody needs to hand out as meeting material.
 *
 * The extension is authoritative. A browser's reported MIME type is advisory
 * and inconsistent (Office types especially), so it's checked loosely: it must
 * either match the extension or be a generic binary type.
 */
const ALLOWED = {
  '.pdf': ['application/pdf'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.doc': ['application/msword'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.xls': ['application/vnd.ms-excel'],
  '.csv': ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
  '.txt': ['text/plain'],
  '.md': ['text/markdown', 'text/plain', 'text/x-markdown'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.gif': ['image/gif'],
  '.zip': ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip'],
};

const GENERIC_MIMES = new Set([
  'application/octet-stream',
  'binary/octet-stream',
  '',
]);

export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED);

/**
 * Strip a client filename down to something safe to echo back in a
 * Content-Disposition header and store for display. Keeps the visible name
 * recognizable without letting it influence anything on disk.
 */
export function sanitizeFileName(raw) {
  const base = path.basename(String(raw || '')); // drops any directory portion
  const cleaned = base
    // Control characters (header injection), quotes (they would terminate the
    // filename parameter), and both path separators — basename only strips the
    // running platform's, so a Windows-style name keeps its backslashes.
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f"\\/]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 200) || 'download';
}

/**
 * @param {{ originalname: string, mimetype: string, size: number, buffer: Buffer }} file
 * @returns {{ ok: true, ext: string } | { ok: false, error: string }}
 */
export function validateUpload(file) {
  if (!file?.buffer?.length) {
    return { ok: false, error: 'No file was received' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `File is larger than the ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB limit`,
    };
  }

  const ext = path.extname(String(file.originalname || '')).toLowerCase();
  const permittedMimes = ALLOWED[ext];
  if (!permittedMimes) {
    return {
      ok: false,
      error: `Files of type "${ext || 'unknown'}" are not accepted. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  const reported = String(file.mimetype || '').toLowerCase().split(';')[0].trim();
  if (!permittedMimes.includes(reported) && !GENERIC_MIMES.has(reported)) {
    return {
      ok: false,
      error: `That file claims to be "${reported}", which doesn't match a ${ext} file`,
    };
  }

  return { ok: true, ext };
}

/**
 * Write an uploaded buffer and return the columns to persist on the asset.
 * The on-disk name is a fresh UUID plus the validated extension — the client's
 * filename never touches the filesystem.
 */
export async function writeAssetFile({ program, releaseId, file, ext }) {
  // program and releaseId are server-side values (a fixed program key and a
  // cuid we just read from the database), but they're still constrained here so
  // this stays safe if a future caller passes something looser.
  const safeProgram = String(program).replace(/[^a-z]/g, '');
  const safeRelease = String(releaseId).replace(/[^A-Za-z0-9_-]/g, '');
  if (!safeProgram || !safeRelease) {
    throw new Error('Refusing to write asset file with an unsafe path component');
  }

  const dir = path.join(STORAGE_ROOT, safeProgram, safeRelease);
  await fs.mkdir(dir, { recursive: true });

  const diskName = `${crypto.randomUUID()}${ext}`;
  await fs.writeFile(path.join(dir, diskName), file.buffer);

  return {
    // Relative to STORAGE_ROOT, with forward slashes, so the value is portable
    // and can never be mistaken for an absolute path.
    storagePath: `${safeProgram}/${safeRelease}/${diskName}`,
    fileName: sanitizeFileName(file.originalname),
    mimeType: String(file.mimetype || 'application/octet-stream').split(';')[0].trim(),
    sizeBytes: file.size,
    checksumSha256: crypto.createHash('sha256').update(file.buffer).digest('hex'),
  };
}

/**
 * Turn a stored relative path back into an absolute one, refusing anything that
 * escapes the storage root. Mirrors the guard used for domain snapshots.
 *
 * @returns {string|null} absolute path, or null if the value is unsafe
 */
export function resolveAssetPath(storagePath) {
  if (!storagePath || typeof storagePath !== 'string') return null;
  if (path.isAbsolute(storagePath)) return null;

  const absolute = path.resolve(STORAGE_ROOT, storagePath);
  const rootWithSep = STORAGE_ROOT.endsWith(path.sep) ? STORAGE_ROOT : `${STORAGE_ROOT}${path.sep}`;
  if (!absolute.startsWith(rootWithSep)) return null;

  return absolute;
}

/**
 * Remove one stored file. Prisma's cascade deletes rows, not bytes, so callers
 * that delete an asset or a release must call this or the volume accumulates
 * orphans nothing references.
 *
 * Missing files are not an error: the row is being removed either way, and
 * failing the delete would leave the user unable to clean up.
 */
export async function deleteAssetFile(storagePath) {
  const absolute = resolveAssetPath(storagePath);
  if (!absolute) return;
  try {
    await fs.unlink(absolute);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.error('Failed to delete program content file', storagePath, error);
    }
  }
}

/**
 * Remove a whole release's directory, used when the release itself is deleted.
 */
export async function deleteReleaseFiles(program, releaseId) {
  const safeProgram = String(program).replace(/[^a-z]/g, '');
  const safeRelease = String(releaseId).replace(/[^A-Za-z0-9_-]/g, '');
  if (!safeProgram || !safeRelease) return;

  const dir = path.join(STORAGE_ROOT, safeProgram, safeRelease);
  if (!resolveAssetPath(`${safeProgram}/${safeRelease}`)) return;

  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    console.error('Failed to delete program content directory', dir, error);
  }
}
