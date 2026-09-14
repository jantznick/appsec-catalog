/**
 * Middleware to check if user is authenticated
 */
import { getAuthContext } from './authContext.js';

export function requireAuth(req, res, next) {
  const auth = getAuthContext(req);
  if (!auth?.userId) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must be logged in to access this resource'
    });
  }
  next();
}

/**
 * Middleware to check if user is verified
 */
export function requireVerified(req, res, next) {
  const auth = getAuthContext(req);
  if (!auth?.userId) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must be logged in to access this resource'
    });
  }
  
  if (!auth.verified) {
    return res.status(403).json({ 
      error: 'Account verification required',
      message: 'Your account must be verified before accessing this resource'
    });
  }
  
  next();
}

/**
 * Middleware to check if user is admin
 */
export function requireAdmin(req, res, next) {
  const auth = getAuthContext(req);
  if (!auth?.userId) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must be logged in to access this resource'
    });
  }
  
  if (!auth.isAdmin) {
    return res.status(403).json({ 
      error: 'Admin access required',
      message: 'You must be an administrator to access this resource'
    });
  }
  
  next();
}

/**
 * Middleware for acting on another user's account.
 *
 * System admins always pass. Otherwise the caller needs `company.manage_users`
 * in the target user's company — or, when the target has no company yet, in
 * their own, since verifying an unassigned user is how they get claimed into
 * one.
 *
 * Expects req.params.id to be the target user's ID.
 */
export async function requireAdminOrCompanyMember(req, res, next) {
  const auth = getAuthContext(req);
  if (!auth?.userId) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'You must be logged in to access this resource'
    });
  }

  const { getPermissionContext, contextCan } = await import('../rbac/context.js');
  const ctx = await getPermissionContext(req);

  // Admins can always access
  if (ctx?.isSystemAdmin) {
    return next();
  }

  // Get target user's companyId
  const { prisma } = await import('../prisma/client.js');
  const targetUser = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { companyId: true },
  });

  if (!targetUser) {
    return res.status(404).json({
      error: 'User not found',
      message: 'The requested user does not exist'
    });
  }

  const companyId = targetUser.companyId ?? auth.companyId ?? null;
  if (!contextCan(ctx, 'company.manage_users', companyId)) {
    return res.status(403).json({
      error: 'Permission denied',
      message: 'You do not have permission to manage users in that company'
    });
  }

  next();
}

