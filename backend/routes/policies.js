import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  getApplicablePolicySummariesForCompany,
  canCompanyViewPolicy,
} from '../services/policy.js';

const router = express.Router();

/**
 * GET /api/policies
 * - No query: full list (admin only), includes control counts - policy admin UI.
 * - ?forCompany=<companyId>: policies applicable to that company (admin or member of that company).
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const forCompany =
      typeof req.query.forCompany === 'string' ? req.query.forCompany.trim() : '';

    if (forCompany) {
      if (!req.session.isAdmin && req.session.companyId !== forCompany) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'You can only access your own company',
        });
      }
      const policies = await getApplicablePolicySummariesForCompany(forCompany);
      if (policies === null) {
        return res.status(404).json({ error: 'Company not found' });
      }
      return res.json(policies);
    }

    if (!req.session.isAdmin) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Admin access required',
      });
    }

    const policies = await prisma.policy.findMany({
      include: {
        _count: {
          select: {
            controls: true,
          },
        },
      },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    res.json(policies);
  } catch (error) {
    console.error('Error fetching policies:', error);
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
});

// GET /api/policies/:id - Full policy + controls (admin). Company members: same controls/fields
// if this policy applies to their company (read-only; no targeting/assignment lists).
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.session.isAdmin) {
      const policy = await prisma.policy.findUnique({
        where: { id },
        include: {
          controls: {
            include: {
              fields: {
                orderBy: {
                  displayOrder: 'asc',
                },
              },
            },
            orderBy: {
              displayOrder: 'asc',
            },
          },
          divisionPolicies: {
            include: {
              division: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          companyPolicies: {
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!policy) {
        return res.status(404).json({ error: 'Policy not found' });
      }

      return res.json(policy);
    }

    const companyId = req.session.companyId;
    if (!companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Company context is required to view policy details',
      });
    }

    const allowed = await canCompanyViewPolicy(id, companyId);
    if (!allowed) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'This policy does not apply to your organization',
      });
    }

    const policy = await prisma.policy.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        scope: true,
        isActive: true,
        displayOrder: true,
        controls: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            controlId: true,
            name: true,
            description: true,
            category: true,
            evaluationLogic: true,
            displayOrder: true,
            isActive: true,
            fields: {
              orderBy: { displayOrder: 'asc' },
              select: {
                id: true,
                fieldPath: true,
                operator: true,
                value: true,
                displayOrder: true,
              },
            },
          },
        },
      },
    });

    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    res.json({ ...policy, readOnly: true });
  } catch (error) {
    console.error('Error fetching policy:', error);
    res.status(500).json({ error: 'Failed to fetch policy' });
  }
});

// POST /api/policies - Create new policy (admin only)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      scope,
      isActive,
      displayOrder,
      targetingRules,
      divisionIds,
      companyIds,
    } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Policy name is required' });
    }

    if (!scope || !['global', 'division', 'company', 'conditional'].includes(scope)) {
      return res.status(400).json({ error: 'Valid scope is required (global, division, company, or conditional)' });
    }

    // Validate targeting rules based on scope
    if (scope === 'division' && (!divisionIds || !Array.isArray(divisionIds) || divisionIds.length === 0)) {
      return res.status(400).json({ error: 'Division policies must have at least one division' });
    }

    if (scope === 'company' && (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0)) {
      return res.status(400).json({ error: 'Company policies must have at least one company' });
    }

    if (scope === 'conditional' && !targetingRules) {
      return res.status(400).json({ error: 'Conditional policies must have targeting rules' });
    }

    // Validate targeting rules JSON if provided
    let parsedTargetingRules = null;
    if (targetingRules) {
      try {
        parsedTargetingRules = typeof targetingRules === 'string' ? JSON.parse(targetingRules) : targetingRules;
        // Validate structure
        if (parsedTargetingRules.type && !['global', 'division', 'company', 'conditional', 'combined'].includes(parsedTargetingRules.type)) {
          return res.status(400).json({ error: 'Invalid targeting rules type' });
        }
      } catch (e) {
        return res.status(400).json({ error: 'Invalid targeting rules JSON' });
      }
    } else if (scope === 'global') {
      parsedTargetingRules = { type: 'global' };
    }

    // Create policy with relationships in a transaction
    const policy = await prisma.$transaction(async (tx) => {
      // Create the policy
      const newPolicy = await tx.policy.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          scope,
          isActive: isActive !== undefined ? isActive : true,
          displayOrder: displayOrder !== undefined ? displayOrder : 0,
          targetingRules: parsedTargetingRules ? JSON.stringify(parsedTargetingRules) : null,
        },
      });

      // Create division relationships if provided
      if (scope === 'division' && divisionIds && divisionIds.length > 0) {
        // Verify divisions exist
        const divisions = await tx.division.findMany({
          where: {
            id: { in: divisionIds },
          },
        });

        if (divisions.length !== divisionIds.length) {
          throw new Error('One or more divisions not found');
        }

        await tx.divisionPolicy.createMany({
          data: divisionIds.map(divisionId => ({
            divisionId,
            policyId: newPolicy.id,
          })),
        });
      }

      // Create company relationships if provided
      if (scope === 'company' && companyIds && companyIds.length > 0) {
        // Verify companies exist
        const companies = await tx.company.findMany({
          where: {
            id: { in: companyIds },
          },
        });

        if (companies.length !== companyIds.length) {
          throw new Error('One or more companies not found');
        }

        await tx.companyPolicy.createMany({
          data: companyIds.map(companyId => ({
            companyId,
            policyId: newPolicy.id,
          })),
        });
      }

      // Return policy with relationships
      return await tx.policy.findUnique({
        where: { id: newPolicy.id },
        include: {
          divisionPolicies: {
            include: {
              division: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          companyPolicies: {
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
    });

    res.status(201).json(policy);
  } catch (error) {
    console.error('Error creating policy:', error);
    if (error.message.includes('not found')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create policy' });
  }
});

// PUT /api/policies/:id - Update policy (admin only)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      scope,
      isActive,
      displayOrder,
      targetingRules,
      divisionIds,
      companyIds,
    } = req.body;

    // Check if policy exists
    const existingPolicy = await prisma.policy.findUnique({
      where: { id },
    });

    if (!existingPolicy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    // Validate scope if provided
    if (scope && !['global', 'division', 'company', 'conditional'].includes(scope)) {
      return res.status(400).json({ error: 'Valid scope is required (global, division, company, or conditional)' });
    }

    // Validate targeting rules if provided
    let parsedTargetingRules = undefined;
    if (targetingRules !== undefined) {
      if (targetingRules === null) {
        parsedTargetingRules = null;
      } else {
        try {
          parsedTargetingRules = typeof targetingRules === 'string' ? JSON.parse(targetingRules) : targetingRules;
          if (parsedTargetingRules.type && !['global', 'division', 'company', 'conditional', 'combined'].includes(parsedTargetingRules.type)) {
            return res.status(400).json({ error: 'Invalid targeting rules type' });
          }
        } catch (e) {
          return res.status(400).json({ error: 'Invalid targeting rules JSON' });
        }
      }
    }

    const finalScope = scope || existingPolicy.scope;

    // Validate relationships based on scope
    if (finalScope === 'division' && divisionIds !== undefined) {
      if (!Array.isArray(divisionIds) || divisionIds.length === 0) {
        return res.status(400).json({ error: 'Division policies must have at least one division' });
      }
    }

    if (finalScope === 'company' && companyIds !== undefined) {
      if (!Array.isArray(companyIds) || companyIds.length === 0) {
        return res.status(400).json({ error: 'Company policies must have at least one company' });
      }
    }

    // Update policy with relationships in a transaction
    const policy = await prisma.$transaction(async (tx) => {
      // Update the policy
      const updatedPolicy = await tx.policy.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(description !== undefined && { description: description?.trim() || null }),
          ...(scope !== undefined && { scope }),
          ...(isActive !== undefined && { isActive }),
          ...(displayOrder !== undefined && { displayOrder }),
          ...(parsedTargetingRules !== undefined && {
            targetingRules: parsedTargetingRules ? JSON.stringify(parsedTargetingRules) : null,
          }),
        },
      });

      // Update division relationships if provided
      if (divisionIds !== undefined) {
        // Delete existing relationships
        await tx.divisionPolicy.deleteMany({
          where: { policyId: id },
        });

        // Create new relationships if scope is division
        if (finalScope === 'division' && divisionIds.length > 0) {
          // Verify divisions exist
          const divisions = await tx.division.findMany({
            where: {
              id: { in: divisionIds },
            },
          });

          if (divisions.length !== divisionIds.length) {
            throw new Error('One or more divisions not found');
          }

          await tx.divisionPolicy.createMany({
            data: divisionIds.map(divisionId => ({
              divisionId,
              policyId: id,
            })),
          });
        }
      }

      // Update company relationships if provided
      if (companyIds !== undefined) {
        // Delete existing relationships
        await tx.companyPolicy.deleteMany({
          where: { policyId: id },
        });

        // Create new relationships if scope is company
        if (finalScope === 'company' && companyIds.length > 0) {
          // Verify companies exist
          const companies = await tx.company.findMany({
            where: {
              id: { in: companyIds },
            },
          });

          if (companies.length !== companyIds.length) {
            throw new Error('One or more companies not found');
          }

          await tx.companyPolicy.createMany({
            data: companyIds.map(companyId => ({
              companyId,
              policyId: id,
            })),
          });
        }
      }

      // Return updated policy with relationships
      return await tx.policy.findUnique({
        where: { id },
        include: {
          divisionPolicies: {
            include: {
              division: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          companyPolicies: {
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
    });

    res.json(policy);
  } catch (error) {
    console.error('Error updating policy:', error);
    if (error.message.includes('not found')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update policy' });
  }
});

// DELETE /api/policies/:id - Delete policy (admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if policy exists
    const policy = await prisma.policy.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            controls: true,
          },
        },
      },
    });

    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    // Prevent deletion if policy has controls
    if (policy._count.controls > 0) {
      return res.status(400).json({
        error: 'Cannot delete policy with controls',
        message: `This policy has ${policy._count.controls} control(s). Please remove or reassign all controls before deleting.`,
      });
    }

    // Delete policy (cascade will handle divisionPolicies and companyPolicies)
    await prisma.policy.delete({
      where: { id },
    });

    res.json({ message: 'Policy deleted successfully' });
  } catch (error) {
    console.error('Error deleting policy:', error);
    res.status(500).json({ error: 'Failed to delete policy' });
  }
});

// PATCH /api/policies/:id/reorder - Update policy display order (admin only)
router.patch('/:id/reorder', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { displayOrder } = req.body;

    if (displayOrder === undefined || typeof displayOrder !== 'number') {
      return res.status(400).json({ error: 'displayOrder is required and must be a number' });
    }

    const policy = await prisma.policy.update({
      where: { id },
      data: { displayOrder },
    });

    res.json(policy);
  } catch (error) {
    console.error('Error updating policy order:', error);
    res.status(500).json({ error: 'Failed to update policy order' });
  }
});

export default router;
