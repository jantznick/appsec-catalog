import { prisma } from '../prisma/client.js';
import { extractDomain, findCompanyByDomain } from './domain.js';
import { getGroupsFromClaims } from '../services/oktaClient.js';

/**
 * Determine whether the given Okta ID token claims grant app-admin rights.
 * Admin is granted when the user is a member of the OKTA_ADMIN_GROUP group.
 * If OKTA_ADMIN_GROUP is not set, group-based admin is disabled (returns false)
 * and admin continues to be managed via ADMIN_EMAILS at startup.
 * @param {object} claims
 * @returns {boolean}
 */
export function isAdminFromClaims(claims) {
  const adminGroup = process.env.OKTA_ADMIN_GROUP;
  if (!adminGroup) {
    return false;
  }
  const groups = getGroupsFromClaims(claims);
  return groups.includes(adminGroup);
}

/**
 * Find-or-create the local user that corresponds to an authenticated Okta
 * identity, then link and refresh it from the token claims.
 *
 * Linking rules:
 *  - Existing users are matched first by `oktaSub`, then by email
 *    (case-insensitive). This lets a user who already has a password log in
 *    with Okta simply because the email matches.
 *  - New users are auto-provisioned: verifiedAccount=true, company assigned by
 *    email domain, admin from the Okta group claim.
 *  - On every login the stored oktaSub is (re)linked and isAdmin is refreshed
 *    from the group claim so group changes in Okta take effect. Company is only
 *    assigned when the user does not already have one, to avoid clobbering a
 *    manual assignment.
 *
 * @param {object} claims - verified ID token claims
 * @returns {Promise<object>} the persisted user
 */
export async function provisionOktaUser(claims) {
  const sub = claims.sub;
  const email = (claims.email || '').toLowerCase();

  if (!sub) {
    throw new Error('Okta ID token is missing the "sub" claim');
  }
  if (!email) {
    throw new Error('Okta ID token is missing the "email" claim');
  }

  const admin = isAdminFromClaims(claims);

  // 1) Match by oktaSub, then by email.
  let user = await prisma.user.findFirst({ where: { oktaSub: sub } });
  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });
  }

  if (user) {
    // Link + refresh existing user (existing password users get linked here).
    const data = {
      oktaSub: sub,
      verifiedAccount: true,
      isAdmin: user.isAdmin || admin, // never downgrade a manually-set admin
    };
    // Assign a company by domain only if none is set yet.
    if (!user.companyId) {
      const company = await findCompanyByDomain(extractDomain(email));
      if (company) {
        data.companyId = company.id;
      }
    }
    return prisma.user.update({ where: { id: user.id }, data });
  }

  // 2) Auto-provision a brand-new Okta user.
  const company = await findCompanyByDomain(extractDomain(email));
  return prisma.user.create({
    data: {
      email,
      password: null, // Okta-only user; password login is unavailable
      oktaSub: sub,
      verifiedAccount: true,
      isAdmin: admin,
      companyId: company?.id || null,
    },
  });
}
