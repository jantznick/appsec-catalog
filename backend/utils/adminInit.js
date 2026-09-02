import { prisma } from '../prisma/client.js';
import { isOktaOnly } from '../middleware/oktaOnly.js';

/**
 * Initialize admin users on server startup
 * Reads ADMIN_EMAILS from environment variable (comma-separated)
 */
export async function initializeAdminUsers() {
  const adminEmails = process.env.ADMIN_EMAILS;
  
  if (!adminEmails) {
    console.log('ℹ️  No ADMIN_EMAILS configured, skipping admin initialization');
    return;
  }

  const emails = adminEmails
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(email => email.length > 0);

  if (emails.length === 0) {
    console.log('ℹ️  No valid admin emails found in ADMIN_EMAILS');
    return;
  }

  console.log(`🔧 Initializing ${emails.length} admin user(s)...`);

  for (const email of emails) {
    try {
      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      let user;
      let isNewUser = false;

      if (existingUser) {
        user = existingUser;
        // Update existing user to be admin
        // Only update if they're not already admin to preserve manually set admins
        if (!existingUser.isAdmin) {
          user = await prisma.user.update({
            where: { email },
            data: { isAdmin: true },
          });
          console.log(`  ✓ Updated ${email} to admin`);
        } else {
          console.log(`  ✓ ${email} is already an admin`);
        }
        // Note: We never remove admin status from users not in ADMIN_EMAILS
        // This preserves manually set admins even if they're not in the env var
      } else {
        // Create new admin user (without password - they'll need to set password via invitation)
        user = await prisma.user.create({
          data: {
            email,
            isAdmin: true,
            verifiedAccount: true, // Admins are auto-verified
          },
        });
        isNewUser = true;
        console.log(`  ✓ Created admin user: ${email}`);
      }

      // This used to mint an invitation link so the admin could set a password.
      // The /invite/:token page is gone (Okta owns credentials now), so such a
      // token would be unredeemable in every configuration — don't create one.
      if (isOktaOnly()) {
        console.log(`  ✓ ${email} signs in with Okta`);
      } else if (!user.password) {
        // Okta is not configured, so this is a local/break-glass deployment and
        // password login is still accepted. There is no self-service UI for it.
        console.log(`\n⚠️  ${email} has no password, and Okta is not configured.`);
        console.log(`   Set one directly, then use the password form on the login screen:`);
        console.log(`   node scripts/set-admin-password.js ${email} <password>\n`);
      } else {
        console.log(`  ✓ ${email} already has a password set`);
      }
    } catch (error) {
      console.error(`  ✗ Error processing admin email ${email}:`, error.message);
    }
  }

  console.log('✅ Admin user initialization complete');
}

/**
 * Initialize system user for automated notes and system actions
 * This user is used when creating notes for public form submissions
 */
export async function initializeSystemUser() {
  const systemEmail = 'system@appsec-catalog.local';
  
  try {
    // Check if system user exists
    let systemUser = await prisma.user.findUnique({
      where: { email: systemEmail },
    });

    if (!systemUser) {
      // Create system user
      systemUser = await prisma.user.create({
        data: {
          email: systemEmail,
          isAdmin: false,
          verifiedAccount: true,
          // No password - this user cannot log in
        },
      });
      console.log('✓ Created system user for automated notes');
    } else {
      console.log('✓ System user already exists');
    }

    return systemUser;
  } catch (error) {
    console.error('Error initializing system user:', error);
    return null;
  }
}


