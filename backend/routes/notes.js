import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getAuthContext } from '../middleware/authContext.js';

const router = express.Router();

// GET /api/notes/company/:companyId - Get all notes for a company (company notes + application notes)
router.get('/company/:companyId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { companyId } = req.params;

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Get all company notes
    const companyNotes = await prisma.note.findMany({
      where: {
        companyId: companyId,
        applicationId: null, // Only company notes, not application notes
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Newest first
      },
    });

    // Get all application notes for applications in this company
    const applications = await prisma.application.findMany({
      where: { companyId: companyId },
      select: { id: true },
    });

    const applicationIds = applications.map(app => app.id);

    const applicationNotes = await prisma.note.findMany({
      where: {
        applicationId: { in: applicationIds },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        application: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Newest first
      },
    });

    // Combine and sort all notes by createdAt (newest first)
    const allNotes = [...companyNotes, ...applicationNotes].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json(allNotes);
  } catch (error) {
    console.error('Error fetching company notes:', error);
    res.status(500).json({ error: 'Failed to fetch company notes' });
  }
});

// GET /api/notes/application/:applicationId - Get all notes for an application
router.get('/application/:applicationId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { applicationId } = req.params;

    // Verify application exists
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Get all application notes
    const notes = await prisma.note.findMany({
      where: {
        applicationId: applicationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Newest first
      },
    });

    res.json(notes);
  } catch (error) {
    console.error('Error fetching application notes:', error);
    res.status(500).json({ error: 'Failed to fetch application notes' });
  }
});

// POST /api/notes/company/:companyId - Create a company note
router.post('/company/:companyId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { content } = req.body;

    // Validate required fields
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    // Check content length (5000 character limit)
    if (content.length > 5000) {
      return res.status(400).json({ error: 'Note content cannot exceed 5000 characters' });
    }

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Create note
    const note = await prisma.note.create({
      data: {
        content: content.trim(),
        createdBy: getAuthContext(req)?.userId,
        companyId: companyId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json(note);
  } catch (error) {
    console.error('Error creating company note:', error);
    res.status(500).json({ error: 'Failed to create company note' });
  }
});

// POST /api/notes/application/:applicationId - Create an application note
router.post('/application/:applicationId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { content } = req.body;

    // Validate required fields
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    // Check content length (5000 character limit)
    if (content.length > 5000) {
      return res.status(400).json({ error: 'Note content cannot exceed 5000 characters' });
    }

    // Verify application exists
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Create note
    const note = await prisma.note.create({
      data: {
        content: content.trim(),
        createdBy: getAuthContext(req)?.userId,
        applicationId: applicationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json(note);
  } catch (error) {
    console.error('Error creating application note:', error);
    res.status(500).json({ error: 'Failed to create application note' });
  }
});

// PUT /api/notes/:id - Update a note
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    // Validate required fields
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    // Check content length (5000 character limit)
    if (content.length > 5000) {
      return res.status(400).json({ error: 'Note content cannot exceed 5000 characters' });
    }

    // Verify note exists
    const existingNote = await prisma.note.findUnique({
      where: { id },
    });

    if (!existingNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Update note
    const note = await prisma.note.update({
      where: { id },
      data: {
        content: content.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        application: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json(note);
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// DELETE /api/notes/:id - Delete a note
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify note exists
    const note = await prisma.note.findUnique({
      where: { id },
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Delete note
    await prisma.note.delete({
      where: { id },
    });

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

export default router;

