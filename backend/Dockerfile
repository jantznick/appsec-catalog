# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies (including dev dependencies for Prisma CLI)
COPY package*.json ./
RUN npm ci

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

