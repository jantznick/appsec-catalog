#!/bin/sh
set -e

# Regenerate Prisma client on every start. Aligns @prisma/client with schema/migrations in the
# image (safe if the Dockerfile already ran generate) and self-heals odd deploys. ~1–3s.
echo "🔄 Generating Prisma client..."
npx prisma generate

echo "🔄 Ensuring Puppeteer Chrome runtime is installed..."
npx puppeteer browsers install chrome

echo "🔄 Running Prisma migrations..."
# Safe to run repeatedly; applies only pending migrations
npx prisma migrate deploy

echo "✅ Migrations complete, starting server..."
exec node server.js
