#!/usr/bin/env node
/**
 * Directly set a new password for an admin user
 * Usage: node scripts/set-admin-password.js <admin-email> <new-password>
 */

import { prisma } from '../prisma/client.js';
import { hashPassword } from '../utils/password.js';
import dotenv from 'dotenv';

dotenv.config();

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error('Usage: node scripts/set-admin-password.js <admin-email> <new-password>');
  process.exit(1);
}

if (newPassword.length < 8) {
  console.error('❌ Password must be at least 8 characters long');
  process.exit(1);
}

async function setAdminPassword() {
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

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update the password
    await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { password: hashedPassword },
    });

    console.log(`✅ Password updated for admin: ${email}`);
    console.log(`\n📝 You can now login with this password\n`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

setAdminPassword();

