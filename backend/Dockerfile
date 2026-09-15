# Backend Dockerfile
FROM node:24-alpine

# Resource tags, baked into the image so Wiz picks them up from the image as
# well as the running container. Keys deliberately match the cloud resource-tag
# keys (Product / Application / Environment) so the same Wiz filters and rules
# work across VMs and containers. Environment is NOT baked in (one image runs in
# every environment) - docker-compose applies it per container.
LABEL Product="Orbit" \
      Application="backend" \
      org.opencontainers.image.title="Orbit Backend" \
      org.opencontainers.image.description="Orbit application security catalog API" \
      org.opencontainers.image.vendor="Hearst"

WORKDIR /app

# Runtime libraries required by bundled Chrome for Puppeteer
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont \
  git \
  docker-cli

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
