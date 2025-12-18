import express from 'express';
import { prisma } from '../prisma/client.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { createMagicCode, validateMagicCode } from '../utils/magicCode.js';
import { extractDomain, findCompanyByDomain } from '../utils/domain.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Register a new user
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Email and password are required'
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

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(409).json({ 
        error: 'Email already registered',
        message: 'An account with this email already exists'
      });
    }

    // Validate password strength (minimum 8 characters)
    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Password too short',
        message: 'Password must be at least 8 characters long'
      });
    }

    // Extract domain and find matching company
    const domain = extractDomain(email);
    const company = domain ? await findCompanyByDomain(domain) : null;

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        verifiedAccount: false,
        isAdmin: false,
        companyId: company?.id || null,
      },
      select: {
        id: true,
        email: true,
        verifiedAccount: true,
        isAdmin: true,
        companyId: true,
        company: company ? {
          id: true,
          name: true,
        } : false,
      },
    });

    res.status(201).json({
      message: 'Registration successful. Your account is pending verification.',
      user: {
        id: user.id,
        email: user.email,
        verifiedAccount: user.verifiedAccount,
        company: user.company,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Registration failed',
      message: 'An error occurred during registration'
    });
  }
});

/**
 * Login with email and password
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Check if user has a password (might be magic-code only user)
    if (!user.password) {
      return res.status(401).json({ 
        error: 'Password not set',
        message: 'Please use magic code login for this account'
      });
    }

    // Verify password
    const passwordValid = await comparePassword(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Create session
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.verified = user.verifiedAccount;
    req.session.isAdmin = user.isAdmin;
    req.session.companyId = user.companyId;

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        verifiedAccount: user.verifiedAccount,
        isAdmin: user.isAdmin,
        company: user.company,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Login failed',
      message: 'An error occurred during login'
    });
  }
});

/**
 * Request a magic code (works for both login and registration)
 * POST /api/auth/request-magic-code
 */
router.post('/request-magic-code', async (req, res) => {
  try {
    const { email } = req.body;

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

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: emailLower },
    });

    if (!user) {
      // User doesn't exist - create them for magic code registration
      // Extract domain and find matching company
      const domain = extractDomain(emailLower);
      const company = domain ? await findCompanyByDomain(domain) : null;

      user = await prisma.user.create({
        data: {
          email: emailLower,
          password: null, // No password for magic code only users
          verifiedAccount: false,
          isAdmin: false,
          companyId: company?.id || null,
        },
      });
    }

    // Create magic code
    const { code, expiresAt } = await createMagicCode(user.id);

    // Print to console (for now, email later)
    console.log(`\n🔑 Magic Code for ${user.email}: ${code}`);
    console.log(`   Expires at: ${expiresAt.toISOString()}\n`);

    res.json({
      message: 'A magic code has been sent. Please ask your administrator to retrieve it from the console.',
      // In production, don't return the code
      // For development, we can return it
      ...(process.env.NODE_ENV !== 'production' && { code }),
    });
  } catch (error) {
    console.error('Magic code request error:', error);
    res.status(500).json({ 
      error: 'Failed to generate magic code',
      message: 'An error occurred while generating the magic code'
    });
  }
});

/**
 * Login with magic code
 * POST /api/auth/login-magic
 */
router.post('/login-magic', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ 
        error: 'Missing required field',
        message: 'Magic code is required'
      });
    }

    // Validate magic code
    const validation = await validateMagicCode(code.toUpperCase());
    
    if (!validation.valid) {
      return res.status(401).json({ 
        error: 'Invalid magic code',
        message: validation.error || 'The magic code is invalid or has expired'
      });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: validation.userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'User associated with this magic code was not found'
      });
    }

    // Create session
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.verified = user.verifiedAccount;
    req.session.isAdmin = user.isAdmin;
    req.session.companyId = user.companyId;

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        verifiedAccount: user.verifiedAccount,
        isAdmin: user.isAdmin,
        company: user.company,
      },
    });
  } catch (error) {
    console.error('Magic code login error:', error);
    res.status(500).json({ 
      error: 'Login failed',
      message: 'An error occurred during login'
    });
  }
});

/**
 * Get current user session
 * GET /api/auth/me
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
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

    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        message: 'User associated with this session was not found'
      });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      error: 'Failed to get user',
      message: 'An error occurred while fetching user information'
    });
  }
});

/**
 * Logout
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ 
        error: 'Logout failed',
        message: 'An error occurred during logout'
      });
    }
    res.clearCookie('connect.sid'); // Default session cookie name
    res.json({ message: 'Logout successful' });
  });
});

export default router;

