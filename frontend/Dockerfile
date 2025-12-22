# Frontend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

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

