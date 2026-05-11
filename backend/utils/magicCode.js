import { prisma } from '../prisma/client.js';

const CODE_LENGTH = 6;
const CODE_EXPIRATION_MINUTES = 15;

/**
 * Generate a random 6-character alphanumeric code
 * @returns {string} Random code
 */
function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Create a magic code for a user
 * @param {string} userId - User ID
 * @returns {Promise<{code: string, expiresAt: Date}>} Magic code and expiration
 */
export async function createMagicCode(userId) {
  const code = generateCode();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + CODE_EXPIRATION_MINUTES);

  await prisma.magicCode.create({
    data: {
      code,
      userId,
      expiresAt,
    },
  });

  return { code, expiresAt };
}

/**
 * Clean up expired magic codes
 * @returns {Promise<number>} Number of deleted codes
 */
export async function cleanupExpiredMagicCodes() {
  const now = new Date();
  const result = await prisma.magicCode.deleteMany({
    where: {
      expiresAt: {
        lt: now, // Expired
      },
    },
  });
  return result.count;
}

/**
 * Validate and use a magic code
 * @param {string} code - Magic code to validate
 * @returns {Promise<{valid: boolean, userId?: string, error?: string}>}
 */
export async function validateMagicCode(code) {
  const magicCode = await prisma.magicCode.findFirst({
    where: {
      code,
      expiresAt: {
        gt: new Date(), // Not expired
      },
      usedAt: null, // Not used
    },
    include: {
      user: true,
    },
  });

  if (!magicCode) {
    return { valid: false, error: 'Invalid or expired magic code' };
  }

  // Mark code as used
  await prisma.magicCode.update({
    where: { id: magicCode.id },
    data: { usedAt: new Date() },
  });

  return { valid: true, userId: magicCode.userId };
}


