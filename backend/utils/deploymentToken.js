import crypto from 'crypto';
import bcrypt from 'bcrypt';

const TOKEN_LENGTH = 32; // 32 bytes = 64 hex characters

/**
 * Generate a secure random token for deployment API access
 * @returns {string} Random token (hex format)
 */
export function generateDeploymentToken() {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Hash a deployment token for secure storage
 * @param {string} token - Plaintext token
 * @returns {Promise<string>} Hashed token
 */
export async function hashDeploymentToken(token) {
  return bcrypt.hash(token, 10);
}

/**
 * Verify a deployment token against its hash
 * @param {string} token - Plaintext token to verify
 * @param {string} hash - Hashed token to compare against
 * @returns {Promise<boolean>} True if token matches hash
 */
export async function verifyDeploymentToken(token, hash) {
  return bcrypt.compare(token, hash);
}

