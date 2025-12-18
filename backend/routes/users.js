import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin, requireAdminOrCompanyMember } from '../middleware/auth.js';

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
 * - Admin: can verify any user
 * - Company member: can verify users in their company
 */
router.post('/:id/verify', requireAuth, requireAdminOrCompanyMember, async (req, res) => {
  try {
    const { id } = req.params;

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

    // Verify the user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        verifiedAccount: true,
      },
      select: {
        id: true,
        email: true,
        verifiedAccount: true,
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
 * Get all users (Admin only)
 * GET /api/users
 * - Admin: see all users
 */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
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
      orderBy: {
        email: 'asc',
      },
    });

    res.json({ users });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ 
      error: 'Failed to get users',
      message: 'An error occurred while fetching users'
    });
  }
});

export default router;

