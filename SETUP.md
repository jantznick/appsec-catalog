# Setup Instructions

## Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose
- npm or yarn

## Initial Setup

### 1. Install Dependencies

Install the latest versions of all packages. See [INSTALL.md](./INSTALL.md) for detailed commands, or run:

```bash
# Frontend dependencies
cd frontend
npm install react react-dom react-router-dom zustand
npm install -D @types/react @types/react-dom @vitejs/plugin-react @tailwindcss/vite tailwindcss vite

# Backend dependencies
cd ../backend
npm install @prisma/client express express-session cors dotenv @prisma/adapter-pg pg openid-client
npm install -D prisma
```

### 2. Environment Variables

Copy the example environment files and update with your values:

```bash
# Backend environment
cd backend
cp .env.example .env
# Edit .env with your database credentials

# Frontend environment
cd ../frontend
cp .env.example .env
# Edit .env if you need to change the API URL
```

**Backend `.env` should contain:**
```env
DATABASE_URL=postgresql://appsec:appsec_password@localhost:5432/appsec_catalog
PORT=5000
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=your-session-secret-here
```

**Frontend `.env` should contain:**
```env
VITE_API_URL=http://localhost:5000
```

**Root `.env` for docker-compose (optional):**
```env
POSTGRES_USER=appsec
POSTGRES_PASSWORD=appsec_password
POSTGRES_DB=appsec_catalog
POSTGRES_PORT=5432
```

### 3. Start PostgreSQL Database

```bash
# From the root directory
docker-compose up -d postgres
```

This will start PostgreSQL in a Docker container. The database will be available at `localhost:5432`.

### 4. Set Up Database Schema

```bash
cd backend

# Generate Prisma client
npm run prisma:generate

# Run migrations (or push schema)
npm run prisma:migrate
# OR
npm run prisma:push
```

### 5. Start Development Servers

In separate terminals:

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

## Development Workflow

- **Database**: Run via Docker Compose (`docker-compose up -d postgres`)
- **Backend**: Run via `npm run dev` in the backend directory
- **Frontend**: Run via `npm run dev` in the frontend directory

## Optional Integrations

- **GitHub** (users connect their own account and link repos to applications for automatic
  language/framework/dependency detection): see [GITHUB_INTEGRATION.md](./GITHUB_INTEGRATION.md).
  One-time admin setup registers a single GitHub App; after that users self-serve.
- **Bitbucket Cloud** (same flow, OAuth consumer instead of a GitHub App): see
  [BITBUCKET_INTEGRATION.md](./BITBUCKET_INTEGRATION.md).
- **Azure DevOps Services** (same flow, Microsoft Entra ID app): see
  [AZURE_DEVOPS_INTEGRATION.md](./AZURE_DEVOPS_INTEGRATION.md).

## Production Database Backup / Local Restore

You can download a production database dump over SSH without changing your local database:

```bash
PROD_SSH_HOST=user@your-prod-host \
PROD_APP_DIR=/opt/appsec-catalog \
./scripts/prod-db-pull.sh
```

Backups are written to `backend/backups/`, which is ignored by git.

To also replace your local development database with the downloaded production dump:

```bash
PROD_SSH_HOST=user@your-prod-host \
PROD_APP_DIR=/opt/appsec-catalog \
./scripts/prod-db-pull.sh --restore-local
```

The script prompts before restoring locally. Use `--force` only for trusted automation.

Useful overrides:

```bash
PROD_PROJECT_NAME=appsec-catalog
PROD_DB_SERVICE=postgres
PROD_DB_USER=appsec
PROD_DB_NAME=appsec_catalog
BACKUP_DIR=/secure/local/backups
LOCAL_DATABASE_URL=postgresql://appsec:appsec_password@localhost:5432/appsec_catalog
```

## Okta SSO (Single Sign-On)

The app supports logging in with your corporate Okta instance via OIDC
(Authorization Code + PKCE). Password login remains available for existing
accounts; **new accounts are created only through Okta**, and self-service
password sign-up is disabled.

### How it behaves

- **Existing password users** can log in with Okta as soon as their Okta email
  matches their existing account — no migration needed. The account is linked to
  their Okta identity (`sub`) on first Okta login.
- **New users** are auto-provisioned on first Okta login: verified automatically
  and assigned to a company by email domain. Admin is managed manually by default
  (optionally mapped from an Okta group — see below).
- Email-based linking onto a pre-existing account requires the IdP's
  `email_verified` claim to be true.
- If Okta env vars are not set, SSO is disabled and the app runs with
  password/magic-code login only.

> Full reference (architecture, flow, security notes, testing):
> [OKTA_SSO.md](./OKTA_SSO.md).

### Configure the Okta application (Okta admin)

1. In the Okta Admin Console: **Applications → Create App Integration → OIDC –
   Web Application**.
2. **Grant type:** Authorization Code.
3. **Sign-in redirect URIs** — this is the OIDC **callback** (ends in
   `/callback`); it must match `OKTA_REDIRECT_URI` in `backend/.env` exactly.
   Add both:
   - Dev: `http://localhost:5000/api/auth/okta/callback`
   - Prod: `https://YOUR-DOMAIN/api/auth/okta/callback`
4. **Initiate login URI** (optional — only needed for the Okta dashboard **tile**)
   — this is our **login** route (ends in `/login`), *not* the callback. Set it so
   that clicking the app tile in Okta starts our normal SP-initiated flow:
   - Prod: `https://YOUR-DOMAIN/api/auth/okta/login`

   > ⚠️ The "Sign-in redirect URI" (`…/callback`) and the "Initiate login URI"
   > (`…/login`) are **different fields pointing at different endpoints** — they
   > differ only in the last path segment, so don't swap them. The callback is
   > required; the initiate-login URI is only for the tile shortcut. If you leave
   > it blank, "Sign in with Okta" from within the app still works; only the Okta
   > dashboard tile would error.
5. **Sign-out redirect URIs** (optional, for single-logout):
   - Dev: `http://localhost:3000`
   - Prod: `https://YOUR-DOMAIN`
6. **Assignments:** assign the users/groups who should have access.
7. *(Optional — group-based admin only)* Admin is managed manually by default.
   To drive admin from Okta instead, add a `groups` claim to your authorization
   server (**Security → API → Authorization Servers → *your server* → Claims**):
   name it `groups`, include it in the **ID token**, and filter to the groups you
   care about. Note the group name that should map to app admins, then set
   `OKTA_ADMIN_GROUP` and add `groups` to `OKTA_SCOPES`.

### Configure the backend (`backend/.env`)

```env
OKTA_ISSUER=https://yourcompany.okta.com/oauth2/default
OKTA_CLIENT_ID=<from the Okta app>
OKTA_CLIENT_SECRET=<from the Okta app>
OKTA_REDIRECT_URI=http://localhost:5000/api/auth/okta/callback   # prod: https://YOUR-DOMAIN/api/auth/okta/callback
OKTA_SCOPES=openid email profile                                 # add "groups" only for group-based admin
OKTA_ADMIN_GROUP=                                                # blank = admin managed manually (default)
OKTA_POST_LOGOUT_REDIRECT_URI=http://localhost:3000              # optional
```

> **Production:** HTTPS is required. When `FRONTEND_URL` is `https://…` the
> backend automatically issues secure session cookies. The `OKTA_REDIRECT_URI`
> must exactly match the value registered in Okta.

### Auth routes added

- `GET /api/auth/okta/status` — whether SSO is enabled (frontend uses this to show the button)
- `GET /api/auth/okta/login` — starts the Okta login redirect
- `GET /api/auth/okta/callback` — Okta redirects here; user is provisioned/linked and logged in
- `GET /api/auth/okta/logout` — local logout + Okta single-logout (optional)
- `POST /api/auth/register` — **disabled** (returns 403)

## Available Endpoints

- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- Backend Health: http://localhost:5000/health
- Backend DB Test: http://localhost:5000/api/db-test

## Docker Compose

To stop the database:
```bash
docker-compose down
```

To stop and remove volumes (clears database):
```bash
docker-compose down -v
```
