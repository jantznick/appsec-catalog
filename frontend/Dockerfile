# Frontend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# AT CUTOVER: uncomment to bake the API base URL into the bundle from the
# docker-compose build arg (sourced from FRONTEND_URL). Leaving these commented
# preserves the current build behavior (VITE_API_URL comes from frontend/.env).
# ARG VITE_API_URL
# ENV VITE_API_URL=$VITE_API_URL

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Resource tags, baked into the image so Wiz picks them up from the image as
# well as the running container. Keys deliberately match the cloud resource-tag
# keys (Product / Application / Environment) so the same Wiz filters and rules
# work across VMs and containers. Environment is NOT baked in (one image runs in
# every environment) - docker-compose applies it per container.
LABEL Product="Orbit" \
      Application="frontend" \
      org.opencontainers.image.title="Orbit Frontend" \
      org.opencontainers.image.description="Orbit application security catalog web UI" \
      org.opencontainers.image.vendor="Hearst"

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration (optional, for SPA routing)
RUN echo 'server { \
    listen 3000; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Disable directory listing globally \
    autoindex off; \
    \
    # Serve markdown files from docs directory \
    location ~ ^/docs/.*\.md$ { \
        try_files $uri =404; \
        add_header Content-Type "text/markdown; charset=utf-8"; \
        add_header Access-Control-Allow-Origin "*"; \
    } \
    \
    # Handle /docs/ (with trailing slash) - route directly to React Router \
    location = /docs/ { \
        try_files /index.html =404; \
    } \
    \
    # Let React Router handle /docs routes (for the Docs component) \
    # This matches /docs (no slash) and /docs/* paths \
    location /docs { \
        try_files $uri /index.html; \
    } \
    \
    # Serve all other static files \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]

