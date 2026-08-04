import express from 'express';
import { prisma } from '../prisma/client.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { createMagicCode, validateMagicCode, cleanupExpiredMagicCodes } from '../utils/magicCode.js';
import { extractDomain, findCompanyByDomain } from '../utils/domain.js';
import { requireAuth } from '../middleware/auth.js';
import { getAuthContext } from '../middleware/authContext.js';
import {
  isOktaConfigured,
  buildAuthorizationRequest,
  handleCallback,
  buildLogoutUrl,
} from '../services/oktaClient.js';
import { provisionOktaUser } from '../utils/oktaProvision.js';

const router = express.Router();

// Frontend base URL used for post-auth redirects.
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Register a new user
 * POST /api/auth/register
 *
 * DISABLED: new users are provisioned exclusively through Okta SSO. Existing
 * password accounts continue to work via POST /api/auth/login. This endpoint is
 * intentionally closed off; see /api/auth/okta/login for onboarding.
 */
router.post('/register', (req, res) => {
  return res.status(403).json({
    error: 'Registration disabled',
    message: 'New accounts are created through Okta single sign-on. Please use "Sign in with Okta".',
  });
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
        companyId: user.companyId,
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
 * Request a magic code for an EXISTING account.
 * POST /api/auth/request-magic-code
 *
 * Onboarding is Okta-only: this endpoint no longer creates accounts. It issues
 * a code for an existing user, and for an unknown email it returns the same
 * generic response (without issuing a code) so it cannot be used to enumerate
 * accounts or provision new ones.
 */
router.post('/request-magic-code', async (req, res) => {
  // Generic response reused for both the known- and unknown-email cases so the
  // caller cannot distinguish whether an account exists.
  const genericResponse = {
    message: 'If an account exists for that email, a magic code has been sent. Please ask your administrator to retrieve it from the console.',
  };

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

    // Only issue codes to existing accounts; never create one here.
    const user = await prisma.user.findUnique({
      where: { email: emailLower },
    });

    if (!user) {
      return res.json(genericResponse);
    }

    // Clean up expired magic codes before creating a new one
    await cleanupExpiredMagicCodes();

    // Create magic code
    const { code, expiresAt } = await createMagicCode(user.id);

    // Print to console (for now, email later)
    console.log(`\n🔑 Magic Code for ${user.email}: ${code}`);
    console.log(`   Expires at: ${expiresAt.toISOString()}\n`);

    res.json({
      ...genericResponse,
      // In production, don't return the code. For development, we can return it.
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
        companyId: user.companyId,
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
    const auth = getAuthContext(req);
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
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

    // Keep cookie session in sync with the database. For api-key auth, do not mutate/create sessions.
    if (!req.auth?.authType && req.session) {
      req.session.companyId = user.companyId;
      req.session.isAdmin = user.isAdmin;
      req.session.verified = user.verifiedAccount;
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

/**
 * Report whether Okta SSO is enabled, so the frontend can show/hide the button.
 * GET /api/auth/okta/status
 */
router.get('/okta/status', (req, res) => {
  res.json({ enabled: isOktaConfigured() });
});

/**
 * Begin Okta login (Authorization Code + PKCE).
 * GET /api/auth/okta/login
 */
router.get('/okta/login', async (req, res) => {
  if (!isOktaConfigured()) {
    return res.status(503).json({
      error: 'Okta not configured',
      message: 'Okta SSO is not configured on this server.',
    });
  }

  try {
    const { url, state, nonce, codeVerifier } = await buildAuthorizationRequest();

    // Stash the per-request checks in the session; they are validated at the
    // callback. sameSite=lax lets this cookie survive the top-level redirect
    // back from Okta.
    req.session.oktaAuth = { state, nonce, codeVerifier };

    // Persist the session before redirecting to guarantee the cookie is set.
    req.session.save((err) => {
      if (err) {
        console.error('Okta login session error:', err);
        return res.redirect(`${FRONTEND_URL}/login?error=okta`);
      }
      res.redirect(url);
    });
  } catch (error) {
    console.error('Okta login error:', error);
    res.redirect(`${FRONTEND_URL}/login?error=okta`);
  }
});

/**
 * Okta redirect callback: exchange the code, provision/link the user, and
 * establish the same session the password flow uses.
 * GET /api/auth/okta/callback
 */
router.get('/okta/callback', async (req, res) => {
  if (!isOktaConfigured()) {
    return res.redirect(`${FRONTEND_URL}/login?error=okta`);
  }

  const checks = req.session.oktaAuth;
  if (!checks) {
    console.error('Okta callback without pending auth state in session');
    return res.redirect(`${FRONTEND_URL}/login?error=okta_state`);
  }

  try {
    const currentUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const { claims, idToken } = await handleCallback(currentUrl, {
      codeVerifier: checks.codeVerifier,
      state: checks.state,
      nonce: checks.nonce,
    });

    const user = await provisionOktaUser(claims);

    // Regenerate the session on successful authentication so the authenticated
    // session gets a fresh ID, preventing session fixation (the pre-auth cookie
    // that carried oktaAuth cannot be replayed as an authenticated session).
    req.session.regenerate((regenErr) => {
      if (regenErr) {
        console.error('Okta callback session regenerate error:', regenErr);
        return res.redirect(`${FRONTEND_URL}/login?error=okta`);
      }

      // Establish the app session on the fresh session (the one-time oktaAuth
      // checks are dropped by regeneration).
      req.session.userId = user.id;
      req.session.email = user.email;
      req.session.verified = user.verifiedAccount;
      req.session.isAdmin = user.isAdmin;
      req.session.companyId = user.companyId;
      req.session.oktaIdToken = idToken; // used as id_token_hint for SSO logout

      req.session.save((err) => {
        if (err) {
          console.error('Okta callback session error:', err);
          return res.redirect(`${FRONTEND_URL}/login?error=okta`);
        }
        res.redirect(`${FRONTEND_URL}/dashboard`);
      });
    });
  } catch (error) {
    console.error('Okta callback error:', error);
    res.redirect(`${FRONTEND_URL}/login?error=okta`);
  }
});

/**
 * Optional RP-initiated (single) logout: destroy the local session and, when
 * Okta supports it, redirect the browser to Okta's end-session endpoint.
 * GET /api/auth/okta/logout
 */
router.get('/okta/logout', async (req, res) => {
  const idTokenHint = req.session?.oktaIdToken;

  let logoutUrl = null;
  if (isOktaConfigured()) {
    try {
      logoutUrl = await buildLogoutUrl(idTokenHint);
    } catch (error) {
      console.error('Okta logout URL error:', error);
    }
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('Okta logout error:', err);
    }
    res.clearCookie('connect.sid');
    res.redirect(logoutUrl || `${FRONTEND_URL}/`);
  });
});

export default router;

