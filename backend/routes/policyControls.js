import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all policy controls (with fields) - admin only
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { policyId } = req.query;

    const where = {};
    if (policyId) {
      where.policyId = policyId;
    }

    const controls = await prisma.policyControl.findMany({
      where,
      include: {
        fields: {
          orderBy: {
            displayOrder: 'asc',
          },
        },
        policy: {
          select: {
            id: true,
            name: true,
            scope: true,
          },
        },
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });

    res.json(controls);
  } catch (error) {
    console.error('Error fetching policy controls:', error);
    res.status(500).json({ error: 'Failed to fetch policy controls' });
  }
});

// Get single policy control (with fields) - admin only
router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const control = await prisma.policyControl.findUnique({
      where: { id },
      include: {
        fields: {
          orderBy: {
            displayOrder: 'asc',
          },
        },
        policy: {
          select: {
            id: true,
            name: true,
            scope: true,
          },
        },
      },
    });

    if (!control) {
      return res.status(404).json({ error: 'Policy control not found' });
    }

    res.json(control);
  } catch (error) {
    console.error('Error fetching policy control:', error);
    res.status(500).json({ error: 'Failed to fetch policy control' });
  }
});

// Create new policy control (with fields) - admin only
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      controlId,
      name,
      description,
      category,
      evaluationLogic,
      isActive,
      displayOrder,
      policyId,
      fields,
    } = req.body;

    // Validate required fields
    if (!controlId || !controlId.trim()) {
      return res.status(400).json({ error: 'Control ID is required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Control name is required' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Control description is required' });
    }
    if (!policyId || !policyId.trim()) {
      return res.status(400).json({ error: 'Policy ID is required' });
    }

    // Validate that policy exists
    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
    });

    if (!policy) {
      return res.status(400).json({ error: 'Policy not found' });
    }

    // Validate evaluation logic
    if (evaluationLogic && !['AND', 'OR'].includes(evaluationLogic)) {
      return res.status(400).json({ error: 'Evaluation logic must be AND or OR' });
    }

    // Create control with fields in a transaction
    const control = await prisma.$transaction(async (tx) => {
      // Create the control
      const newControl = await tx.policyControl.create({
        data: {
          controlId: controlId.trim(),
          name: name.trim(),
          description: description.trim(),
          category: category?.trim() || null,
          evaluationLogic: evaluationLogic || 'AND',
          isActive: isActive !== undefined ? isActive : true,
          displayOrder: displayOrder || 0,
          policyId: policyId.trim(),
        },
      });

      // Create fields if provided
      if (fields && Array.isArray(fields) && fields.length > 0) {
        await tx.policyControlField.createMany({
          data: fields.map((field, index) => ({
            controlId: newControl.id,
            fieldPath: field.fieldPath?.trim(),
            operator: field.operator?.trim(),
            value: field.value !== null && field.value !== undefined ? JSON.stringify(field.value) : null,
            displayOrder: field.displayOrder !== undefined ? field.displayOrder : index,
          })),
        });
      }

      // Return control with fields
      return await tx.policyControl.findUnique({
        where: { id: newControl.id },
        include: {
          fields: {
            orderBy: {
              displayOrder: 'asc',
            },
          },
        },
      });
    });

    res.status(201).json(control);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Control ID already exists' });
    }
    console.error('Error creating policy control:', error);
    res.status(500).json({ error: 'Failed to create policy control' });
  }
});

// Update policy control (with fields) - admin only
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      controlId,
      name,
      description,
      category,
      evaluationLogic,
      isActive,
      displayOrder,
      policyId,
      fields,
    } = req.body;

    // Validate required fields
    if (controlId !== undefined && (!controlId || !controlId.trim())) {
      return res.status(400).json({ error: 'Control ID cannot be empty' });
    }
    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({ error: 'Control name cannot be empty' });
    }
    if (description !== undefined && (!description || !description.trim())) {
      return res.status(400).json({ error: 'Control description cannot be empty' });
    }

    // Validate policyId if provided
    if (policyId !== undefined) {
      if (!policyId || !policyId.trim()) {
        return res.status(400).json({ error: 'Policy ID cannot be empty' });
      }

      // Validate that policy exists
      const policy = await prisma.policy.findUnique({
        where: { id: policyId },
      });

      if (!policy) {
        return res.status(400).json({ error: 'Policy not found' });
      }
    }

    // Validate evaluation logic
    if (evaluationLogic && !['AND', 'OR'].includes(evaluationLogic)) {
      return res.status(400).json({ error: 'Evaluation logic must be AND or OR' });
    }

    // Update control and fields in a transaction
    const control = await prisma.$transaction(async (tx) => {
      // Check if control exists
      const existingControl = await tx.policyControl.findUnique({
        where: { id },
      });

      if (!existingControl) {
        throw { code: 'P2025' };
      }

      // Update the control
      const updateData = {};
      if (controlId !== undefined) updateData.controlId = controlId.trim();
      if (name !== undefined) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description.trim();
      if (category !== undefined) updateData.category = category?.trim() || null;
      if (evaluationLogic !== undefined) updateData.evaluationLogic = evaluationLogic;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
      if (policyId !== undefined) updateData.policyId = policyId.trim();

      await tx.policyControl.update({
        where: { id },
        data: updateData,
      });

      // Update fields if provided
      if (fields !== undefined) {
        // Delete existing fields
        await tx.policyControlField.deleteMany({
          where: { controlId: id },
        });

        // Create new fields
        if (Array.isArray(fields) && fields.length > 0) {
          await tx.policyControlField.createMany({
            data: fields.map((field, index) => ({
              controlId: id,
              fieldPath: field.fieldPath?.trim(),
              operator: field.operator?.trim(),
              value: field.value !== null && field.value !== undefined ? JSON.stringify(field.value) : null,
              displayOrder: field.displayOrder !== undefined ? field.displayOrder : index,
            })),
          });
        }
      }

      // Return updated control with fields and policy
      return await tx.policyControl.findUnique({
        where: { id },
        include: {
          fields: {
            orderBy: {
              displayOrder: 'asc',
            },
          },
          policy: {
            select: {
              id: true,
              name: true,
              scope: true,
            },
          },
        },
      });
    });

    res.json(control);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Policy control not found' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Control ID already exists' });
    }
    console.error('Error updating policy control:', error);
    res.status(500).json({ error: 'Failed to update policy control' });
  }
});

// Delete policy control (cascades to fields) - admin only
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if control exists
    const control = await prisma.policyControl.findUnique({
      where: { id },
    });

    if (!control) {
      return res.status(404).json({ error: 'Policy control not found' });
    }

    // Delete control (fields will be deleted via cascade)
    await prisma.policyControl.delete({
      where: { id },
    });

    res.json({ message: 'Policy control deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Policy control not found' });
    }
    console.error('Error deleting policy control:', error);
    res.status(500).json({ error: 'Failed to delete policy control' });
  }
});

// Update display order - admin only
router.patch('/:id/reorder', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { displayOrder } = req.body;

    if (displayOrder === undefined || typeof displayOrder !== 'number') {
      return res.status(400).json({ error: 'Display order is required and must be a number' });
    }

    const control = await prisma.policyControl.update({
      where: { id },
      data: {
        displayOrder,
      },
    });

    res.json(control);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Policy control not found' });
    }
    console.error('Error updating display order:', error);
    res.status(500).json({ error: 'Failed to update display order' });
  }
});

export default router;
