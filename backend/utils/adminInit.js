import { prisma } from '../prisma/client.js';

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

      if (existingUser) {
        // Update existing user to be admin
        if (!existingUser.isAdmin) {
          await prisma.user.update({
            where: { email },
            data: { isAdmin: true },
          });
          console.log(`  ✓ Updated ${email} to admin`);
        } else {
          console.log(`  ✓ ${email} is already an admin`);
        }
      } else {
        // Create new admin user (without password - they'll need to use magic code or set password)
        await prisma.user.create({
          data: {
            email,
            isAdmin: true,
            verifiedAccount: true, // Admins are auto-verified
          },
        });
        console.log(`  ✓ Created admin user: ${email}`);
      }
    } catch (error) {
      console.error(`  ✗ Error processing admin email ${email}:`, error.message);
    }
  }

  console.log('✅ Admin user initialization complete');
}

