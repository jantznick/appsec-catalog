#!/bin/sh
set -e

echo "🔄 Running Prisma migrations..."
# Use migrate deploy for production (only applies pending migrations)
# This is safe to run multiple times - it only applies migrations that haven't been applied yet
npx prisma migrate deploy

echo "✅ Migrations complete, starting server..."
exec node server.js

