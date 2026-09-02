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

### Okta is the only way in
Signing in with Okta — the "Sign in with Okta" button or the tile on the Okta
dashboard — is the **only** way to authenticate, and assigning someone the Okta
app is the **only** way they get an account.

When the Okta env vars are set, `middleware/oktaOnly.js` refuses every other
credential and provisioning endpoint with **403**, so none of them can serve as
an alternate, un-SSO'd way into an account:

| Endpoint | Surface |
| --- | --- |
| `POST /api/auth/login` | password login |
| `POST /api/auth/request-magic-code` | magic-code issue |
| `POST /api/auth/login-magic` | magic-code login |
| `PUT /api/users/me/password` | set / change own password |
| `POST /api/users/invite` | mint an invite link |
| `POST /api/users/:id/regenerate-invite` | re-mint an invite link (for a verified user, an admin password reset) |
| `GET /api/invitations/:token` | read invitation details |
| `POST /api/invitations/:token/accept` | set a password **and open a session without the IdP** |

`POST /api/auth/register` returns **403** unconditionally.

The matching frontend affordances are all gone: `AuthModal` shows only the Okta
button, and the Users page has no change-, set-, or reset-password action and no
invite actions. The `/invite/:token` route, `AcceptInvitation` page,
`InviteUserModal`, and `ChangePasswordModal` were deleted.

### Requesting an account
Prospective users can still submit a request through "Request an account" in the
login modal (`AccountRequestModal` → `routes/programInfoRequests.js`). That is a
message to the team, **not** a provisioning path: an admin assigns the Okta app
manually, and the account is created on that person's first Okta login.

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
3. **Sign-in redirect URIs** — the OIDC **callback** (ends in `/callback`); must
   match `OKTA_REDIRECT_URI` exactly. Add both dev and prod:
   - `http://localhost:5000/api/auth/okta/callback`
   - `https://YOUR-DOMAIN/api/auth/okta/callback`
4. **Initiate login URI** — the **login** route (ends in `/login`), *not* the
   callback. Only needed so the **Okta dashboard tile** works (IdP-initiated). Set:
   - `https://YOUR-DOMAIN/api/auth/okta/login`
5. **Sign-out redirect URIs** (optional, for single-logout):
   - `http://localhost:3000`
   - `https://YOUR-DOMAIN`
6. **Assignments:** assign the users/groups who should have access.
7. Copy the **Client ID** and **Client secret** into `backend/.env`.
8. *(Optional, group-based admin only)* Add a `groups` claim to your
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

## Troubleshooting

### Existing users can't link — "email_verified claim is not true"
Symptom: an existing password user's **first** Okta login fails and redirects to
`/login?error=okta`; the backend logs
`Refusing to link Okta identity to existing account for <email>: email_verified claim is not true`.

Cause: email-based linking onto a pre-existing account requires the IdP to assert
`email_verified === true` (a strict boolean). If your authorization server does
not emit the claim, emits it as the string `"true"`, or emits `false`, the guard
blocks the link.

Scope of impact: **only the migration of existing accounts.** Brand-new users
(no local account yet) are still provisioned normally — the guard does not apply
to them. Returning Okta users match by `oktaSub` and are also unaffected.

Fixes, in order of preference:
1. **Emit the claim in Okta (recommended).** On a **custom** authorization server
   (`/oauth2/default`), `email_verified` is usually not included by default — add
   it: **Security → API → Authorization Servers → *server* → Claims → Add Claim**,
   name `email_verified`, include in the **ID token**, value a boolean expression
   your Okta team maps for your directory (org auth servers typically emit it
   automatically with the `email` scope). Confirm the emitted value is boolean
   `true`, not `"true"`.
2. **Opt into trusting unverified email (code flag).** Because a corporate Okta
   directory centrally manages emails (users can't self-edit them), some teams
   accept email linking without the claim. This is gated by
   `OKTA_ALLOW_UNVERIFIED_EMAIL_LINK=true` (default off). Only enable it if you
   trust that email addresses in your Okta directory are authoritative — it
   removes the account-takeover guard for email-based linking.
3. **Pre-seed `oktaSub`.** If you can map existing users' emails to their Okta
   `sub` out of band, populate `User.oktaSub` before cutover so they match by
   `sub` and never hit the guard. Most involved; rarely necessary.

### The Okta dashboard tile errors (`error=okta_state`)
The tile is IdP-initiated; our flow is SP-initiated. Set the app's **Initiate
login URI** to `https://YOUR-DOMAIN/api/auth/okta/login` so a tile click starts
our normal flow. Starting from within the app ("Sign in with Okta") is unaffected.

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

- **Now (Okta-only):** onboarding, login, and password management all go through
  Okta. Local password/magic-code endpoints still exist but are refused while
  Okta is configured — unsetting the Okta env vars is the break-glass path if the
  IdP is unavailable.
- **Later:** consider deleting the local password endpoints and nulling out
  stored password hashes once every user has linked their Okta identity, at which
  point the break-glass path goes away too.
