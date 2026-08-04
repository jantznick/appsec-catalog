# Okta SSO Integration

Login with the corporate Okta instance via OpenID Connect (OIDC) using the
**Authorization Code flow with PKCE**. Sessions terminate in the app's existing
server-side session cookie, so nothing downstream (route guards, `getAuthContext`,
API-token auth) changes.

- **Backend:** Express + Prisma/Postgres, `express-session` + `PrismaSessionStore`.
- **OIDC client:** [`openid-client`](https://github.com/panva/openid-client) v6.
- **Frontend:** a "Sign in with Okta" button rendered by `AuthModal` when SSO is enabled.

---

## Behavior

### Onboarding is Okta-only
- `POST /api/auth/register` (self-service password sign-up) returns **403**.
- `POST /api/auth/request-magic-code` **no longer creates accounts** — it only
  issues a code to an already-existing user. Unknown emails get a generic
  response with no code (no account enumeration, no provisioning).
- New accounts are created **only** through Okta login (or admin invitations).

### Login methods that still work
- **Okta SSO** — for everyone assigned the Okta app.
- **Password login** (`POST /api/auth/login`) — for existing accounts that already
  have a password.
- **Magic-code login** (`POST /api/auth/login-magic`) — for existing accounts.

### Account linking / migration
On each Okta login the user is resolved in this order (`utils/oktaProvision.js`):

1. **Match by `oktaSub`** (the Okta `sub` claim, stored on the `User`) → log in.
2. **Match by email** (case-insensitive) → link the Okta identity onto the
   existing account (`oktaSub` is set, `verifiedAccount` becomes true) → log in.
   This is how an existing password user migrates: their first Okta login with a
   matching email seamlessly adopts their account, history intact.
   - **Guard:** email-based linking requires the IdP to assert
     `email_verified === true`. An unverified email will **not** silently take
     over a pre-existing local account. (Matching by `oktaSub` is already a
     trusted binding and is not subject to this guard.)
3. **No match** → auto-provision a new user: `verifiedAccount = true`, no
   password, company assigned by email domain.

### Admin roles
Admin is **managed manually by default** (via `ADMIN_EMAILS` / the `isAdmin`
flag). Group-based admin is **opt-in**: it activates only when `OKTA_ADMIN_GROUP`
is set (and the `groups` scope/claim is configured in Okta). When active, it
**never downgrades** a manually-set admin.

### Disabled configuration
If the Okta env vars are unset, `isOktaConfigured()` is false: the Okta routes
report disabled, the frontend hides the button, and the app runs with
password/magic-code login only. This makes the feature safe to ship before Okta
credentials exist.

---

## Login flow

```
Browser                     Backend (/api/auth/okta/*)              Okta
   │  click "Sign in with Okta"                                       │
   │ ───► GET /okta/login                                             │
   │        build PKCE + state + nonce, stash in session              │
   │ ◄─── 302 to Okta authorize URL ──────────────────────────────►  │
   │                                                 authenticate     │
   │ ◄─────────────── 302 to /okta/callback?code&state ────────────  │
   │ ───► GET /okta/callback                                          │
   │        validate state/nonce/PKCE, exchange code ──────────────►  │
   │        provision/link user, regenerate session, set identity     │
   │ ◄─── 302 to FRONTEND_URL/dashboard                              │
```

Because the callback is a top-level GET navigation, the `sameSite=lax` session
cookie survives the round trip. The one-time PKCE/state/nonce values are stored
in the pre-auth session and validated at the callback.

---

## Files

| File | Purpose |
|---|---|
| `backend/services/oktaClient.js` | `openid-client` wrapper: discovery (lazy, cached), build auth request, handle callback, logout URL, group extraction. |
| `backend/utils/oktaProvision.js` | Resolver: find-or-create/link the local user from ID-token claims. |
| `backend/routes/auth.js` | Okta routes (`/okta/status`, `/okta/login`, `/okta/callback`, `/okta/logout`); registration disabled; magic-code create path closed. |
| `backend/prisma/schema.prisma` | `User.oktaSub String? @unique`. |
| `backend/prisma/migrations/20260717120000_add_okta_sub/` | Adds the `oktaSub` column + unique index. |
| `backend/server.js` | `SESSION_SECRET` fail-fast in prod; secure cookies over HTTPS. |
| `frontend/src/components/AuthModal.jsx` | "Sign in with Okta" button (shown when enabled). |
| `frontend/src/lib/api.js` | `getOktaStatus()` + `API_BASE_URL` for the redirect. |

---

## Environment variables (`backend/.env`)

```env
# Required to enable Okta SSO
OKTA_ISSUER=https://yourcompany.okta.com/oauth2/default   # or https://yourcompany.okta.com
OKTA_CLIENT_ID=<from the Okta app>
OKTA_CLIENT_SECRET=<from the Okta app>
OKTA_REDIRECT_URI=http://localhost:5000/api/auth/okta/callback  # prod: https://YOUR-DOMAIN/...

# Optional
OKTA_SCOPES=openid email profile          # add "groups" ONLY for group-based admin
OKTA_ADMIN_GROUP=                          # leave blank to keep admin manual (default)
OKTA_POST_LOGOUT_REDIRECT_URI=http://localhost:3000  # for Okta single-logout
```

All four `OKTA_ISSUER` / `OKTA_CLIENT_ID` / `OKTA_CLIENT_SECRET` /
`OKTA_REDIRECT_URI` must be present for SSO to activate.

> **Production:** HTTPS is required. When `FRONTEND_URL` is `https://…` the
> backend automatically issues secure session cookies, and `SESSION_SECRET`
> **must** be set (the server refuses to start otherwise). `OKTA_REDIRECT_URI`
> must exactly match the value registered in Okta.

---

## Okta application setup (Okta admin)

1. **Applications → Create App Integration → OIDC – Web Application.**
2. **Grant type:** Authorization Code.
3. **Sign-in redirect URIs** — add both dev and prod callback URLs:
   - `http://localhost:5000/api/auth/okta/callback`
   - `https://YOUR-DOMAIN/api/auth/okta/callback`
4. **Sign-out redirect URIs** (optional, for single-logout):
   - `http://localhost:3000`
   - `https://YOUR-DOMAIN`
5. **Assignments:** assign the users/groups who should have access.
6. Copy the **Client ID** and **Client secret** into `backend/.env`.
7. *(Optional, group-based admin only)* Add a `groups` claim to your
   authorization server (**Security → API → Authorization Servers → *server* →
   Claims**): name it `groups`, include it in the **ID token**, filter to the
   groups you care about. Then set `OKTA_ADMIN_GROUP` and add `groups` to
   `OKTA_SCOPES`.

---

## Auth routes

| Route | Description |
|---|---|
| `GET /api/auth/okta/status` | `{ enabled }` — whether SSO is configured (frontend shows/hides the button). |
| `GET /api/auth/okta/login` | Starts the Okta login redirect. |
| `GET /api/auth/okta/callback` | Okta redirects here; user is provisioned/linked and logged in. |
| `GET /api/auth/okta/logout` | Local logout + Okta single-logout (when supported). |
| `POST /api/auth/register` | **Disabled** — returns 403. |

---

## Security notes

- **PKCE (S256) + `state` + `nonce`** are generated per request and validated at
  the callback.
- **Session regeneration** runs on successful Okta auth, so the authenticated
  session gets a fresh ID (session-fixation defense).
- **Secure cookies** are enabled automatically over HTTPS (`FRONTEND_URL` scheme).
- **`SESSION_SECRET`** has no production fallback — the server refuses to start
  without it in production.
- **Email-based linking** requires `email_verified === true` from the IdP.
- Okta secrets stay server-side only; the frontend never sees them.

---

## Local development / testing

1. Register a dev Okta app with the `localhost:5000` callback (Okta allows
   `http://localhost` redirect URIs for development).
2. Populate the `OKTA_*` vars in `backend/.env`.
3. Apply the migration: `cd backend && npm run prisma:migrate` (or
   `npm run prisma:push`).
4. Start backend + frontend, open the login modal — the "Sign in with Okta"
   button appears once `GET /api/auth/okta/status` returns `{ enabled: true }`.
5. First login with an email that matches an existing account will link it;
   a brand-new email will be auto-provisioned.

---

## Rollout / future direction

- **Now:** Okta + password/magic-code login coexist; onboarding is Okta-only.
- **Later (Okta-only):** retire password/magic-code login entirely (optionally
  keep one break-glass admin), and consider nulling out stored passwords once all
  users have linked their Okta identity.
