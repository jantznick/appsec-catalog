#!/usr/bin/env node
/**
 * Seed a SMALL, representative dataset for the security-test instance so pages
 * render and a scanner has real content/endpoints to crawl. NOT for prod.
 *
 * Idempotent: every row uses a fixed "sx-" id and is upserted, so re-running
 * updates in place instead of duplicating.
 *
 * Requires an admin user to exist first (notes need a creator):
 *   node scripts/create-admin.js you@example.com 'a-strong-password'
 *   node scripts/seed-sectest.js
 *
 * Usage: node scripts/seed-sectest.js
 */

import { prisma } from '../prisma/client.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  // Notes require a creator (User id). Use the first admin (from create-admin.js).
  const admin = await prisma.user.findFirst({ where: { isAdmin: true } });
  if (!admin) {
    console.error('❌ No admin user found. Run first:');
    console.error("   node scripts/create-admin.js you@example.com 'a-strong-password'");
    process.exit(1);
  }

  // Division
  await prisma.division.upsert({
    where: { id: 'sx-div-1' },
    update: { name: 'Digital Products' },
    create: { id: 'sx-div-1', name: 'Digital Products', description: 'Consumer-facing digital product teams' },
  });

  // Companies
  await prisma.company.upsert({
    where: { id: 'sx-co-1' },
    update: { name: 'Acme Media', divisionId: 'sx-div-1' },
    create: {
      id: 'sx-co-1', name: 'Acme Media', slug: 'acme-media', divisionId: 'sx-div-1',
      domains: 'acme.example.com', engManager: 'Jordan Lee', language: 'TypeScript',
      framework: 'Next.js', facing: 'external', dataTypes: 'PII, Payment',
    },
  });
  await prisma.company.upsert({
    where: { id: 'sx-co-2' },
    update: { name: 'Globex Publishing' },
    create: {
      id: 'sx-co-2', name: 'Globex Publishing', slug: 'globex-publishing',
      domains: 'globex.example.com', engManager: 'Sam Rivera', language: 'Python',
      framework: 'Django', facing: 'internal', dataTypes: 'PII',
    },
  });

  // Applications (under Acme Media)
  const apps = [
    {
      id: 'sx-app-1', name: 'Subscriber Portal', description: 'Customer subscription management portal',
      owner: 'Jordan Lee', language: 'TypeScript', framework: 'Next.js', facing: 'external',
      businessCriticality: 5, dataTypes: 'PII, Payment', sastTool: 'Semgrep', sastIntegrationLevel: 2,
      dastTool: 'ZAP', dastIntegrationLevel: 1, currentVersion: '2.3.1', deploymentEnvironment: 'prod',
    },
    {
      id: 'sx-app-2', name: 'Content CMS', description: 'Editorial content management system',
      owner: 'Priya Nair', language: 'TypeScript', framework: 'React', facing: 'internal',
      businessCriticality: 3, dataTypes: 'Internal', sastTool: 'CodeQL', sastIntegrationLevel: 3,
      currentVersion: '1.0.0', deploymentEnvironment: 'staging',
    },
  ];
  for (const a of apps) {
    await prisma.application.upsert({
      where: { id: a.id },
      update: { name: a.name, companyId: 'sx-co-1' },
      create: { ...a, companyId: 'sx-co-1', status: 'onboarded' },
    });
    // One approved version snapshot per app so the version history renders.
    await prisma.applicationVersion.upsert({
      where: { id: `${a.id}-v1` },
      update: {},
      create: {
        id: `${a.id}-v1`, applicationId: a.id, versionNumber: 1, createdBy: admin.id,
        changeSource: 'bulk_import', approvalStatus: 'approved', name: a.name,
        description: a.description, owner: a.owner, language: a.language, framework: a.framework,
        facing: a.facing, status: 'onboarded',
      },
    });
  }

  // Domains + link to the external app
  await prisma.domain.upsert({
    where: { id: 'sx-dom-1' },
    update: { name: 'portal.acme.example.com' },
    create: {
      id: 'sx-dom-1', name: 'portal.acme.example.com', companyId: 'sx-co-1',
      description: 'Subscriber portal hosting domain', status: 'active', apexDomain: 'acme.example.com',
    },
  });
  await prisma.applicationDomain.upsert({
    where: { id: 'sx-appdom-1' },
    update: {},
    create: { id: 'sx-appdom-1', applicationId: 'sx-app-1', domainId: 'sx-dom-1' },
  });

  // Contacts (company + application scoped)
  await prisma.contact.upsert({
    where: { id: 'sx-contact-1' },
    update: {},
    create: { id: 'sx-contact-1', name: 'Jordan Lee', title: 'Eng Manager', email: 'jordan@acme.example.com', companyId: 'sx-co-1' },
  });
  await prisma.contact.upsert({
    where: { id: 'sx-contact-2' },
    update: {},
    create: { id: 'sx-contact-2', name: 'Priya Nair', title: 'Tech Lead', email: 'priya@acme.example.com', applicationId: 'sx-app-2' },
  });

  // Notes (need a creator)
  await prisma.note.upsert({
    where: { id: 'sx-note-1' },
    update: {},
    create: { id: 'sx-note-1', content: 'Initial onboarding review completed.', createdBy: admin.id, companyId: 'sx-co-1' },
  });
  await prisma.note.upsert({
    where: { id: 'sx-note-2' },
    update: {},
    create: { id: 'sx-note-2', content: 'Pending DAST scan configuration.', createdBy: admin.id, applicationId: 'sx-app-1' },
  });

  // Product
  await prisma.product.upsert({
    where: { id: 'sx-prod-1' },
    update: { name: 'Acme Subscriptions' },
    create: {
      id: 'sx-prod-1', companyId: 'sx-co-1', name: 'Acme Subscriptions',
      description: 'End-to-end subscription platform', owner: 'Jordan Lee', facing: 'external',
      status: 'active', businessCriticality: 5, dataSensitivity: 'High',
    },
  });

  console.log('✅ Seed complete: 1 division, 2 companies, 2 applications (+versions), 1 domain, 2 contacts, 2 notes, 1 product.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Seed error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
