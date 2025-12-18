/**
 * Middleware to check if user is authenticated
 */
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
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
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must be logged in to access this resource'
    });
  }
  
  if (!req.session.verified) {
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
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must be logged in to access this resource'
    });
  }
  
  if (!req.session.isAdmin) {
    return res.status(403).json({ 
      error: 'Admin access required',
      message: 'You must be an administrator to access this resource'
    });
  }
  
  next();
}

/**
 * Middleware to check if user is admin OR member of same company as target user
 * Expects req.params.id to be the target user's ID
 */
export async function requireAdminOrCompanyMember(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'You must be logged in to access this resource'
    });
  }
  
  // Admins can always access
  if (req.session.isAdmin) {
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
  
  // Check if user is in the same company
  if (!req.session.companyId || req.session.companyId !== targetUser.companyId) {
    return res.status(403).json({ 
      error: 'Permission denied',
      message: 'You can only access users in your company'
    });
  }
  
  next();
}

