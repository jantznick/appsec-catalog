#!/usr/bin/env node
/**
 * Create (or update) a verified admin user with a password.
 *
 * Registration via the API is disabled (accounts normally come from Okta SSO),
 * so a fresh database has no way to log in. This seeds a single admin so an
 * IP-only / SSO-less instance (e.g. the security-test instance) is usable.
 * Idempotent: re-running just resets the password and re-asserts admin.
 *
 * Usage: node scripts/create-admin.js <email> <password>
 */

import { prisma } from '../prisma/client.js';
import { hashPassword } from '../utils/password.js';
import dotenv from 'dotenv';

dotenv.config();

const email = (process.argv[2] || '').toLowerCase();
const password = process.argv[3];

if (!email || !password) {
  console.error('Usage: node scripts/create-admin.js <email> <password>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('❌ Password must be at least 8 characters long');
  process.exit(1);
}

async function main() {
  try {
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.upsert({
      where: { email },
      update: { password: hashedPassword, isAdmin: true, verifiedAccount: true },
      create: { email, password: hashedPassword, isAdmin: true, verifiedAccount: true },
    });
    console.log(`✅ Admin ready: ${user.email} (isAdmin=${user.isAdmin}, verified=${user.verifiedAccount})`);
    console.log('   You can now log in with email + password.');
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
