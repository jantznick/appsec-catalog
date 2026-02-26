#!/bin/sh
set -e

# Only generate Prisma client if it doesn't exist
# This prevents unnecessary regeneration on every startup (saves ~1-3 seconds)
# The client should already be generated during the Docker build
if [ ! -d "node_modules/.prisma/client" ]; then
  echo "🔄 Generating Prisma client..."
  npx prisma generate
fi

echo "🔄 Ensuring Puppeteer Chrome runtime is installed..."
npx puppeteer browsers install chrome

echo "🔄 Running Prisma migrations..."
# Use migrate deploy for production (only applies pending migrations)
# This is safe to run multiple times - it only applies migrations that haven't been applied yet
npx prisma migrate deploy

echo "✅ Migrations complete, starting server..."
exec node server.js

