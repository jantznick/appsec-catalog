import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyDeploymentToken } from '../utils/deploymentToken.js';

const router = express.Router();

// List all deployment tokens (for company users and admins)
// GET /api/deployment-tokens
router.get('/', requireAuth, async (req, res) => {
  try {
    let whereClause = {};

    // Non-admin users can only see tokens for their company
    if (!req.session.isAdmin) {
      if (!req.session.companyId) {
        return res.json([]);
      }
      whereClause.companyId = req.session.companyId;
    }

    const tokens = await prisma.deploymentToken.findMany({
      where: whereClause,
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        applications: {
          include: {
            application: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(tokens);
  } catch (error) {
    console.error('Error fetching deployment tokens:', error);
    res.status(500).json({ error: 'Failed to fetch deployment tokens' });
  }
});

// Get a specific deployment token
// GET /api/deployment-tokens/:tokenId
router.get('/:tokenId', requireAuth, async (req, res) => {
  try {
    const { tokenId } = req.params;

    const token = await prisma.deploymentToken.findUnique({
      where: { id: tokenId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        applications: {
          include: {
            application: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!token) {
      return res.status(404).json({ error: 'Deployment token not found' });
    }

    // Check if user has access (admin or member of same company)
    if (!req.session.isAdmin && req.session.companyId !== token.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only view deployment tokens for your company',
      });
    }

    res.json(token);
  } catch (error) {
    console.error('Error fetching deployment token:', error);
    res.status(500).json({ error: 'Failed to fetch deployment token' });
  }
});

// Update a deployment token (name, add/remove applications)
// PUT /api/deployment-tokens/:tokenId
router.put('/:tokenId', requireAuth, async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { name, applicationIds } = req.body;

    // Check if token exists
    const existingToken = await prisma.deploymentToken.findUnique({
      where: { id: tokenId },
      include: {
        company: true,
        applications: true,
      },
    });

    if (!existingToken) {
      return res.status(404).json({ error: 'Deployment token not found' });
    }

    // Check if token is revoked
    if (existingToken.revokedAt) {
      return res.status(400).json({ error: 'Cannot update a revoked token' });
    }

    // Check if user has access (admin or member of same company)
    if (!req.session.isAdmin && req.session.companyId !== existingToken.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only update deployment tokens for your company',
      });
    }

    // Update token name if provided
    const updateData = {};
    if (name !== undefined) {
      updateData.name = name?.trim() || null;
    }

    // Handle application updates if provided
    if (applicationIds !== undefined) {
      if (!Array.isArray(applicationIds)) {
        return res.status(400).json({ error: 'applicationIds must be an array' });
      }

      // Verify all applications belong to the same company
      if (applicationIds.length > 0) {
        const applications = await prisma.application.findMany({
          where: {
            id: { in: applicationIds },
            companyId: existingToken.companyId,
          },
        });

        if (applications.length !== applicationIds.length) {
          return res.status(400).json({
            error: 'Invalid applications',
            message: 'All applications must belong to the same company as the token',
          });
        }
      }

      // Remove all existing associations
      await prisma.applicationDeploymentToken.deleteMany({
        where: { tokenId },
      });

      // Create new associations
      if (applicationIds.length > 0) {
        await prisma.applicationDeploymentToken.createMany({
          data: applicationIds.map(appId => ({
            tokenId,
            applicationId: appId,
          })),
        });
      }
    }

    // Update token if name changed
    if (Object.keys(updateData).length > 0) {
      await prisma.deploymentToken.update({
        where: { id: tokenId },
        data: updateData,
      });
    }

    // Fetch updated token
    const updatedToken = await prisma.deploymentToken.findUnique({
      where: { id: tokenId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        applications: {
          include: {
            application: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    res.json(updatedToken);
  } catch (error) {
    console.error('Error updating deployment token:', error);
    res.status(500).json({ error: 'Failed to update deployment token' });
  }
});

// Revoke a deployment token
// DELETE /api/deployment-tokens/:tokenId
router.delete('/:tokenId', requireAuth, async (req, res) => {
  try {
    const { tokenId } = req.params;

    // Check if token exists
    const token = await prisma.deploymentToken.findUnique({
      where: { id: tokenId },
    });

    if (!token) {
      return res.status(404).json({ error: 'Deployment token not found' });
    }

    // Check if user has access (admin or member of same company)
    if (!req.session.isAdmin && req.session.companyId !== token.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only revoke deployment tokens for your company',
      });
    }

    // Revoke token (soft delete - set revokedAt)
    await prisma.deploymentToken.update({
      where: { id: tokenId },
      data: {
        revokedAt: new Date(),
      },
    });

    res.json({ message: 'Deployment token revoked successfully' });
  } catch (error) {
    console.error('Error revoking deployment token:', error);
    res.status(500).json({ error: 'Failed to revoke deployment token' });
  }
});

// Public endpoint: Create deployment via token
// POST /api/deployments
router.post('/', async (req, res) => {
  try {
    const { token, applicationId, deployedAt, environment, version, gitBranch, deployedBy, notes } = req.body;

    // Validate required fields
    if (!token) {
      return res.status(401).json({ error: 'Token is required' });
    }
    if (!applicationId) {
      return res.status(400).json({ error: 'Application ID is required' });
    }
    if (!environment || !environment.trim()) {
      return res.status(400).json({ error: 'Environment is required' });
    }

    // Find token by hash comparison
    const tokens = await prisma.deploymentToken.findMany({
      where: {
        revokedAt: null, // Only active tokens
      },
      include: {
        applications: {
          include: {
            application: true,
          },
        },
      },
    });

    // Find matching token
    let matchingToken = null;
    for (const t of tokens) {
      const isValid = await verifyDeploymentToken(token, t.tokenHash);
      if (isValid) {
        matchingToken = t;
        break;
      }
    }

    if (!matchingToken) {
      return res.status(401).json({ error: 'Invalid or revoked token' });
    }

    // Verify token has access to this application
    const hasAccess = matchingToken.applications.some(
      appToken => appToken.applicationId === applicationId
    );

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Token does not have access to this application',
      });
    }

    // Verify application exists and belongs to token's company
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.companyId !== matchingToken.companyId) {
      return res.status(403).json({
        error: 'Application does not belong to token\'s company',
      });
    }

    // Create deployment
    const deployment = await prisma.deployment.create({
      data: {
        applicationId,
        deployedAt: deployedAt ? new Date(deployedAt) : new Date(),
        environment: environment.trim(),
        version: version?.trim() || null,
        gitBranch: gitBranch?.trim() || null,
        deployedBy: deployedBy?.trim() || null,
        notes: notes?.trim() || null,
      },
    });

    // Update token's lastUsedAt
    await prisma.deploymentToken.update({
      where: { id: matchingToken.id },
      data: { lastUsedAt: new Date() },
    });

    // Auto-update application's current deployment info from this new deployment
    const currentApp = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { currentVersion: true, deploymentEnvironment: true, gitBranch: true },
    });

    const updateData = {};
    if (!currentApp.currentVersion && deployment.version) {
      updateData.currentVersion = deployment.version;
    }
    if (!currentApp.deploymentEnvironment && deployment.environment) {
      updateData.deploymentEnvironment = deployment.environment;
    }
    if (!currentApp.gitBranch && deployment.gitBranch) {
      updateData.gitBranch = deployment.gitBranch;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.application.update({
        where: { id: applicationId },
        data: updateData,
      });
    }

    res.status(201).json(deployment);
  } catch (error) {
    console.error('Error creating deployment via token:', error);
    res.status(500).json({ error: 'Failed to create deployment' });
  }
});

export default router;

