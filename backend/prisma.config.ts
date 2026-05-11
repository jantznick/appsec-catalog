import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import path from 'node:path';

/**
 * `prisma generate` does not open a DB connection, but Prisma 7’s config still expects a URL.
 * Docker builds and local `generate` often have no DATABASE_URL; use a placeholder so config loads.
 * At runtime, compose / .env provide the real URL for `migrate deploy` and the app.
 */
const PLACEHOLDER_DATASOURCE_URL =
  'postgresql://prisma:prisma@127.0.0.1:5432/prisma_config_placeholder';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL || PLACEHOLDER_DATASOURCE_URL,
  },
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
});









