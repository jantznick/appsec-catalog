import { prisma } from '../prisma/client.js';
import crypto from 'crypto';

const TOKEN_LENGTH = 32;
const INVITATION_EXPIRATION_DAYS = 7;

/**
 * Generate a secure random token for invitations
 * @returns {string} Random token
 */
function generateToken() {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Create an invitation for a user
 * @param {string} email - Email address to invite
 * @param {string} invitedBy - User ID who is sending the invitation
 * @param {string|null} companyId - Optional company ID to assign user to
 * @param {boolean} isAdmin - Whether to make user an admin
 * @returns {Promise<{token: string, expiresAt: Date}>} Invitation token and expiration
 */
export async function createInvitation(email, invitedBy, companyId = null, isAdmin = false) {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRATION_DAYS);

  const invitation = await prisma.invitation.create({
    data: {
      token,
      email: email.toLowerCase(),
      companyId,
      isAdmin,
      invitedBy,
      expiresAt,
    },
  });

  return { token, expiresAt, invitation };
}

/**
 * Validate and get invitation details
 * @param {string} token - Invitation token
 * @returns {Promise<{valid: boolean, invitation?: object, error?: string}>}
 */
export async function validateInvitation(token) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!invitation) {
    return { valid: false, error: 'Invalid invitation token' };
  }

  if (invitation.usedAt) {
    return { valid: false, error: 'This invitation has already been used' };
  }

  if (new Date() > invitation.expiresAt) {
    return { valid: false, error: 'This invitation has expired' };
  }

  return { valid: true, invitation };
}

/**
 * Mark an invitation as used
 * @param {string} token - Invitation token
 * @returns {Promise<void>}
 */
export async function markInvitationUsed(token) {
  await prisma.invitation.update({
    where: { token },
    data: { usedAt: new Date() },
  });
}

