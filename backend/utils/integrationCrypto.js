import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derive 32-byte key from INTEGRATIONS_ENCRYPTION_KEY (hex string or any passphrase).
 */
export function getIntegrationsKey() {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw || raw.trim() === '') {
    throw new Error(
      'INTEGRATIONS_ENCRYPTION_KEY is not set. Set a 64-character hex key (32 bytes) or a passphrase in the environment.',
    );
  }
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

/**
 * @param {string} plaintext
 * @returns {string} base64(iv + ciphertext + auth tag)
 */
export function encryptIntegrationPayload(plaintext) {
  const key = getIntegrationsKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString('base64');
}

/**
 * @param {string} payloadBase64
 * @returns {string} plaintext
 */
export function decryptIntegrationPayload(payloadBase64) {
  const key = getIntegrationsKey();
  const buf = Buffer.from(payloadBase64, 'base64');
  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted payload');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(buf.length - AUTH_TAG_LENGTH);
  const data = buf.subarray(IV_LENGTH, buf.length - AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function maskAccessKeyHint(accessKey) {
  if (!accessKey || typeof accessKey !== 'string' || accessKey.length < 4) {
    return null;
  }
  return `…${accessKey.slice(-4)}`;
}
