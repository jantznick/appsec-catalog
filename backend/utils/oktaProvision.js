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
 *    with Okta simply because the email matches. Email-based linking onto a
 *    pre-existing account requires the IdP's `email_verified` claim to be true.
 *  - New users are auto-provisioned: verifiedAccount=true, company assigned by
 *    email domain.
 *  - Admin is managed manually (via ADMIN_EMAILS / the isAdmin flag) by
 *    default. Group-based admin is opt-in: it activates only when OKTA_ADMIN_GROUP
 *    is set (and the `groups` scope/claim is configured), and it never downgrades
 *    a manually-set admin. Company is only assigned when the user does not
 *    already have one, to avoid clobbering a manual assignment.
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

  // 1) Match by oktaSub first, then fall back to email.
  let user = await prisma.user.findFirst({ where: { oktaSub: sub } });
  const matchedBySub = Boolean(user);
  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });
  }

  // Security: only auto-link an Okta identity onto a *pre-existing* local
  // account when the IdP asserts the email is verified. Matching by oktaSub is
  // already a trusted binding, so this guard applies only to email-based links.
  //
  // Escape hatch: OKTA_ALLOW_UNVERIFIED_EMAIL_LINK=true bypasses this guard for
  // deployments whose corporate Okta directory does not emit `email_verified`
  // but where email addresses are centrally managed and therefore trusted.
  // Default off (safe). See OKTA_SSO.md → Troubleshooting.
  const allowUnverifiedLink =
    process.env.OKTA_ALLOW_UNVERIFIED_EMAIL_LINK === 'true';
  if (
    user &&
    !matchedBySub &&
    claims.email_verified !== true &&
    !allowUnverifiedLink
  ) {
    throw new Error(
      `Refusing to link Okta identity to existing account for ${email}: email_verified claim is not true`
    );
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
