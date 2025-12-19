# HTTPS Setup with Caddy

This guide explains how to set up HTTPS for the AppSec Catalog application using Caddy, which provides automatic SSL/TLS certificates via Let's Encrypt.

## Prerequisites

1. A domain name pointing to your server's IP address
2. Ports 80 and 443 open in your firewall
3. Docker and Docker Compose installed

## Quick Setup

### 1. Update the Caddyfile

Edit `Caddyfile` and replace `yourdomain.com` with your actual domain:

```caddy
yourdomain.com {
    handle / {
        reverse_proxy frontend:3000
    }
    handle /api/* {
        reverse_proxy backend:3001
    }
    handle /health {
        reverse_proxy backend:3001
    }
}
```

### 2. Set Environment Variables

Create or update a `.env` file in the root directory:

```env
# Your domain (used for generating invitation links)
FRONTEND_URL=https://yourdomain.com

# Database settings (if not using defaults)
POSTGRES_USER=appsec
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=appsec_catalog
```

### 3. Start the Services

```bash
docker-compose up -d
```

Caddy will automatically:
- Obtain a Let's Encrypt certificate for your domain
- Set up HTTPS
- Redirect HTTP to HTTPS
- Renew certificates automatically

## How It Works

1. **Caddy** runs as a reverse proxy on ports 80 (HTTP) and 443 (HTTPS)
2. **Frontend** requests go to `https://yourdomain.com/` → proxied to `frontend:3000`
3. **Backend API** requests go to `https://yourdomain.com/api/*` → proxied to `backend:3001`
4. **Health checks** go to `https://yourdomain.com/health` → proxied to `backend:3001`

## Development vs Production

### Development (Local)
For local development without a domain, you can:
- Use the direct ports: `http://localhost:3000` and `http://localhost:3001`
- Or uncomment the `:80` block in `Caddyfile` for HTTP-only local testing

### Production
- Remove direct port mappings from `docker-compose.yml` (ports 3000 and 3001)
- Ensure `FRONTEND_URL` is set to your HTTPS domain
- Ensure `NODE_ENV=production` is set (enables secure cookies)

## Troubleshooting

### Certificate Issues
- Ensure your domain DNS points to your server's IP
- Check that ports 80 and 443 are open
- View Caddy logs: `docker-compose logs caddy`

### Backend CORS Errors
- Ensure `FRONTEND_URL` in docker-compose matches your domain
- Check backend logs: `docker-compose logs backend`

### Testing Locally
If you want to test HTTPS locally without a domain:
1. Comment out the domain block in `Caddyfile`
2. Uncomment the `:80` block
3. Access via `http://localhost`

## Security Notes

- Caddy automatically handles certificate renewal
- Certificates are stored in the `caddy_data` volume
- Session cookies are set to `secure: true` in production (requires HTTPS)
- Never commit `.env` files with real credentials

## Alternative: Self-Signed Certificates (Testing Only)

For local testing with HTTPS, you can use self-signed certificates:

```caddy
localhost {
    tls internal
    reverse_proxy / frontend:3000
    reverse_proxy /api/* backend:3001
}
```

**Warning**: Self-signed certificates will show browser warnings. Only use for local testing.

