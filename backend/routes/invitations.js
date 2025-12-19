import express from 'express';
import { prisma } from '../prisma/client.js';
import { validateInvitation, markInvitationUsed } from '../utils/invitation.js';
import bcrypt from 'bcrypt';

const router = express.Router();

/**
 * Get invitation details (public)
 * GET /api/invitations/:token
 */
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const validation = await validateInvitation(token);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid invitation',
        message: validation.error
      });
    }

    res.json({
      invitation: {
        email: validation.invitation.email,
        company: validation.invitation.company,
        isAdmin: validation.invitation.isAdmin,
        expiresAt: validation.invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error('Get invitation error:', error);
    res.status(500).json({
      error: 'Failed to get invitation',
      message: 'An error occurred while fetching the invitation'
    });
  }
});

/**
 * Accept invitation and set password
 * POST /api/invitations/:token/accept
 * 
 * Request body:
 * - password: string (required) - Password to set
 */
router.post('/:token/accept', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'Password is required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'Password must be at least 8 characters long'
      });
    }

    // Validate invitation
    const validation = await validateInvitation(token);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid invitation',
        message: validation.error
      });
    }

    const { invitation } = validation;
    const emailLower = invitation.email.toLowerCase();

    // Check if user already exists (should exist from invitation)
    let user = await prisma.user.findUnique({
      where: { email: emailLower },
    });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    if (user) {
      // User exists (created during invitation) - update password and verify account
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          verifiedAccount: true,
          // Update company and admin status from invitation if not already set
          companyId: invitation.companyId || user.companyId,
          isAdmin: invitation.isAdmin || user.isAdmin,
        },
        select: {
          id: true,
          email: true,
          verifiedAccount: true,
          isAdmin: true,
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } else {
      // User doesn't exist (shouldn't happen, but handle gracefully)
      // Create new user
      user = await prisma.user.create({
        data: {
          email: emailLower,
          password: hashedPassword,
          verifiedAccount: true,
          isAdmin: invitation.isAdmin,
          companyId: invitation.companyId || null,
        },
        select: {
          id: true,
          email: true,
          verifiedAccount: true,
          isAdmin: true,
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    }

    // Mark invitation as used
    await markInvitationUsed(token);

    // Create session to automatically log the user in
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.verified = user.verifiedAccount;
    req.session.isAdmin = user.isAdmin;
    req.session.companyId = user.companyId;

    res.json({
      message: 'Account created successfully',
      user,
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({
      error: 'Failed to accept invitation',
      message: 'An error occurred while accepting the invitation'
    });
  }
});

export default router;

