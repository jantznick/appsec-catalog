# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Runtime libraries required by bundled Chrome for Puppeteer
RUN apk add --no-cache \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont

# Keep Puppeteer browser cache in a stable location inside the image/container
ENV PUPPETEER_CACHE_DIR=/usr/local/share/puppeteer

# Install dependencies (including dev dependencies for Prisma CLI)
COPY package*.json ./
RUN npm ci

# Install Chrome runtime used by Puppeteer snapshots
RUN npx puppeteer browsers install chrome

# Copy Prisma schema and config
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy application code
COPY . .

# Copy and make entrypoint script executable
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Expose port
EXPOSE 3001

# Run migrations and start server
ENTRYPOINT ["./docker-entrypoint.sh"]

