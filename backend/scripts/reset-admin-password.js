#!/usr/bin/env node
/**
 * Reset admin password by clearing it and letting admin init regenerate invite link
 * Usage: node scripts/reset-admin-password.js <admin-email>
 */

import { prisma } from '../prisma/client.js';
import dotenv from 'dotenv';

dotenv.config();

const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/reset-admin-password.js <admin-email>');
  process.exit(1);
}

async function resetAdminPassword() {
  try {
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      console.error(`❌ User with email ${email} not found`);
      process.exit(1);
    }

    if (!user.isAdmin) {
      console.error(`❌ User ${email} is not an admin`);
      process.exit(1);
    }

    // Clear the password
    await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { password: null },
    });

    console.log(`✅ Password cleared for admin: ${email}`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Make sure ${email} is in your ADMIN_EMAILS environment variable`);
    console.log(`   2. Restart your backend server`);
    console.log(`   3. Check the server logs for the invitation link`);
    console.log(`   4. Use the invitation link to set a new password\n`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

resetAdminPassword();





