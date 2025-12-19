import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin, requireAdminOrCompanyMember } from '../middleware/auth.js';
import { createInvitation } from '../utils/invitation.js';
import { hashPassword, comparePassword } from '../utils/password.js';

const router = express.Router();

/**
 * Get pending (unverified) users
 * GET /api/users/pending
 * - Admin: see all unverified users
 * - Company member: see unverified users in their company
 */
router.get('/pending', requireAuth, async (req, res) => {
  try {
    let whereClause = {
      verifiedAccount: false,
    };

    // If not admin, only show users from their company
    if (!req.session.isAdmin) {
      if (!req.session.companyId) {
        return res.json({ users: [] });
      }
      whereClause.companyId = req.session.companyId;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        verifiedAccount: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        email: 'asc',
      },
    });

    res.json({ users });
  } catch (error) {
    console.error('Get pending users error:', error);
    res.status(500).json({ 
      error: 'Failed to get pending users',
      message: 'An error occurred while fetching pending users'
    });
  }
});

/**
 * Verify/approve a user
 * POST /api/users/:id/verify
 * - Admin: can verify any user and set company/admin status
 * - Company member: can verify users in their company (no company/admin changes)
 * 
 * Request body (optional):
 * - companyId: string - Assign user to a company (admin only)
 * - isAdmin: boolean - Make user an admin (admin only)
 */
router.post('/:id/verify', requireAuth, requireAdminOrCompanyMember, async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, isAdmin: makeAdmin } = req.body;
    const isRequesterAdmin = req.session.isAdmin;

    // Get the target user
    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!targetUser) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'The user you are trying to verify does not exist'
      });
    }

    // Build update data
    const updateData = {
      verifiedAccount: true,
    };

    // Only admins can set company and admin status
    if (isRequesterAdmin) {
      if (companyId !== undefined) {
        // If companyId is provided, validate it exists
        if (companyId) {
          const company = await prisma.company.findUnique({
            where: { id: companyId },
          });
          if (!company) {
            return res.status(404).json({
              error: 'Company not found',
              message: 'The specified company does not exist'
            });
          }
        }
        updateData.companyId = companyId || null;
      }

      if (makeAdmin !== undefined) {
        updateData.isAdmin = Boolean(makeAdmin);
      }
    } else {
      // Company members can assign users with no company to their company
      if (!targetUser.companyId && req.session.companyId) {
        updateData.companyId = req.session.companyId;
      }
    }

    // Verify the user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        verifiedAccount: true,
        isAdmin: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      message: 'User verified successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({ 
      error: 'Failed to verify user',
      message: 'An error occurred while verifying the user'
    });
  }
});

/**
 * Update current user's password
 * PUT /api/users/me/password
 * - Authenticated users can update their own password
 * 
 * Request body:
 * - currentPassword: string (optional if user has no password) - Current password for verification
 * - newPassword: string (required) - New password to set
 */
router.put('/me/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'New password is required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'Password must be at least 8 characters long'
      });
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found'
      });
    }

    // If user has a password, require current password verification
    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({
          error: 'Current password required',
          message: 'Please provide your current password to update it'
        });
      }

      const passwordValid = await comparePassword(currentPassword, user.password);
      if (!passwordValid) {
        return res.status(401).json({
          error: 'Invalid password',
          message: 'Current password is incorrect'
        });
      }
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    res.json({
      message: user.password ? 'Password updated successfully' : 'Password set successfully',
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      error: 'Failed to update password',
      message: 'An error occurred while updating the password'
    });
  }
});

/**
 * Get all users
 * GET /api/users
 * - Admin: see all users
 * - Company member: see users in their company OR users with no company (allows them to add unassigned users to their company)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    let whereClause = {};

    // If not admin, show users from their company OR users with no company
    if (!req.session.isAdmin) {
      if (!req.session.companyId) {
        // If user has no company, only show unassigned users
        whereClause.companyId = null;
      } else {
        // Show users in their company OR users with no company
        whereClause.OR = [
          { companyId: req.session.companyId },
          { companyId: null },
        ];
      }
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        verifiedAccount: true,
        isAdmin: true,
        companyId: true,
        password: true, // Need to check if password exists, but won't send it
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        email: 'asc',
      },
    });

    // Map users to include hasPassword boolean instead of password hash
    const usersWithHasPassword = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return {
        ...userWithoutPassword,
        hasPassword: password !== null && password !== undefined,
      };
    });

    res.json({ users: usersWithHasPassword });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ 
      error: 'Failed to get users',
      message: 'An error occurred while fetching users'
    });
  }
});

/**
 * Update a user (Admin only)
 * PUT /api/users/:id
 * - Admin: can update company and admin status
 * 
 * Request body (optional):
 * - companyId: string | null - Assign user to a company or remove assignment
 * - isAdmin: boolean - Set admin status
 */
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { companyId, isAdmin: makeAdmin } = req.body;

    // Get the target user
    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'The user you are trying to update does not exist'
      });
    }

    // Build update data
    const updateData = {};

    if (companyId !== undefined) {
      // If companyId is provided, validate it exists (or allow null to remove assignment)
      if (companyId) {
        const company = await prisma.company.findUnique({
          where: { id: companyId },
        });
        if (!company) {
          return res.status(404).json({
            error: 'Company not found',
            message: 'The specified company does not exist'
          });
        }
      }
      updateData.companyId = companyId || null;
    }

    if (makeAdmin !== undefined) {
      updateData.isAdmin = Boolean(makeAdmin);
    }

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        verifiedAccount: true,
        isAdmin: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      message: 'User updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ 
      error: 'Failed to update user',
      message: 'An error occurred while updating the user'
    });
  }
});

/**
 * Invite a user
 * POST /api/users/invite
 * - Admin: can invite users with optional company and admin status
 * - Company member: can invite users to their company (no admin status)
 * 
 * Request body:
 * - email: string (required) - Email address to invite
 * - companyId: string (optional, admin only) - Company to assign user to
 * - isAdmin: boolean (optional, admin only) - Make user an admin
 */
router.post('/invite', requireAuth, async (req, res) => {
  try {
    const { email, companyId, isAdmin: makeAdmin } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'Email is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        message: 'Please provide a valid email address'
      });
    }

    const emailLower = email.toLowerCase();

    // Check if user already exists
    let existingUser = await prisma.user.findUnique({
      where: { email: emailLower },
    });

    const isRequesterAdmin = req.session.isAdmin;
    let finalCompanyId = companyId || null;
    let finalIsAdmin = Boolean(makeAdmin);

    // If not admin, restrict to their company and no admin status
    if (!isRequesterAdmin) {
      if (!req.session.companyId) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'You must be assigned to a company to invite users'
        });
      }
      finalCompanyId = req.session.companyId;
      finalIsAdmin = false; // Company members cannot create admins
    } else {
      // Admin can specify company, validate if provided
      if (companyId) {
        const company = await prisma.company.findUnique({
          where: { id: companyId },
        });
        if (!company) {
          return res.status(404).json({
            error: 'Company not found',
            message: 'The specified company does not exist'
          });
        }
      }
    }

    // If user doesn't exist, create them (unverified, no password) so they show up in the users list
    if (!existingUser) {
      existingUser = await prisma.user.create({
        data: {
          email: emailLower,
          password: null,
          verifiedAccount: false,
          isAdmin: finalIsAdmin,
          companyId: finalCompanyId,
        },
      });
    } else {
      // User exists - check if they're already verified
      if (existingUser.verifiedAccount) {
        return res.status(400).json({
          error: 'User already exists',
          message: 'A verified user with this email address already exists'
        });
      }
      // Update existing unverified user with invitation details
      existingUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          companyId: finalCompanyId,
          isAdmin: finalIsAdmin,
        },
      });
    }

    // Create invitation
    const { token, expiresAt, invitation } = await createInvitation(
      emailLower,
      req.session.userId,
      finalCompanyId,
      finalIsAdmin
    );

    // Generate invitation URL (in production, this would be the actual frontend URL)
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const invitationUrl = `${baseUrl}/invite/${token}`;

    // In production, send email here
    // For now, log it
    console.log(`\n📧 Invitation for ${emailLower}:`);
    console.log(`   URL: ${invitationUrl}`);
    console.log(`   Expires at: ${expiresAt.toISOString()}\n`);

    res.json({
      message: 'Invitation created successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
      },
      invitationUrl, // Return URL for development/testing
    });
  } catch (error) {
    console.error('Create invitation error:', error);
    res.status(500).json({
      error: 'Failed to create invitation',
      message: 'An error occurred while creating the invitation'
    });
  }
});

/**
 * Regenerate invitation link for a user
 * POST /api/users/:id/regenerate-invite
 * - Admin: can regenerate invite for any unverified user
 * - Company member: can regenerate invite for unverified users in their company
 */
router.post('/:id/regenerate-invite', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Find the user
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        company: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The specified user does not exist'
      });
    }

    // Check if user is already verified
    const isRequesterAdmin = req.session.isAdmin;

    // Only admins can create invite links for verified users (password reset function)
    // Non-admins can only create invites for unverified users
    if (user.verifiedAccount && !isRequesterAdmin) {
      return res.status(400).json({
        error: 'User already verified',
        message: 'Cannot regenerate invitation for a verified user. Only admins can create invite links for verified users.'
      });
    }

    // Permission check: non-admins can only regenerate invites for users in their company or unassigned users
    if (!isRequesterAdmin) {
      if (!req.session.companyId) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'You must be assigned to a company to regenerate invitations'
        });
      }
      // Allow if user is in requester's company OR user has no company (unassigned)
      if (user.companyId && user.companyId !== req.session.companyId) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'You can only regenerate invitations for users in your company or unassigned users'
        });
      }
    }

    // Create new invitation for the user
    const { token, expiresAt, invitation } = await createInvitation(
      user.email,
      req.session.userId,
      user.companyId,
      user.isAdmin
    );

    // Generate invitation URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const invitationUrl = `${baseUrl}/invite/${token}`;

    // Log it
    console.log(`\n📧 Regenerated invitation for ${user.email}:`);
    console.log(`   URL: ${invitationUrl}`);
    console.log(`   Expires at: ${expiresAt.toISOString()}\n`);

    res.json({
      message: 'Invitation regenerated successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
      },
      invitationUrl,
    });
  } catch (error) {
    console.error('Regenerate invitation error:', error);
    res.status(500).json({
      error: 'Failed to regenerate invitation',
      message: 'An error occurred while regenerating the invitation'
    });
  }
});

/**
 * Delete a user (Admin only)
 * DELETE /api/users/:id
 * - Admin: can delete any user
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (id === req.session.userId) {
      return res.status(400).json({
        error: 'Cannot delete yourself',
        message: 'You cannot delete your own account'
      });
    }

    // Get the target user
    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'The user you are trying to delete does not exist'
      });
    }

    // Delete the user (cascade will handle related records)
    await prisma.user.delete({
      where: { id },
    });

    res.json({
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ 
      error: 'Failed to delete user',
      message: 'An error occurred while deleting the user'
    });
  }
});

export default router;

