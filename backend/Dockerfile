# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Runtime libraries required by bundled Chrome for Puppeteer
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont

# Keep Puppeteer browser cache in a stable location inside the image/container
ENV PUPPETEER_CACHE_DIR=/usr/local/share/puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install dependencies (including dev dependencies for Prisma CLI)
COPY package*.json ./
RUN npm ci

# Install Chrome runtime used by Puppeteer snapshots
RUN npx puppeteer browsers install chrome

# All app source (including prisma/schema and migrations) - must come before `prisma generate`
COPY . .

# Client must be generated from the *final* schema and migrations, not an earlier layer.
# (Previously, generate ran only after `COPY prisma`, then `COPY . .` could leave schema/migrations
# ahead of a stale @prisma/client - same symptom as “had to run generate in the running container”.)
RUN chmod +x docker-entrypoint.sh
RUN npx prisma generate

# Expose port
EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
