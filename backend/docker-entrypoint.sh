#!/bin/sh
set -e

echo "🔄 Running Prisma migrations..."
npx prisma migrate deploy

echo "✅ Migrations complete, starting server..."
exec node server.js

