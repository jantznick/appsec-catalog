# Bitbucket Integration Setup

This integration lets **individual users connect their own Bitbucket Cloud account** and link
repositories to applications. Once linked, the catalog automatically pulls the repo's
**languages, frameworks, and top-level dependencies** (viewable per-application and in the
catalog-wide **Dependencies** view).

There are two distinct steps:

1. **One-time, admin-only** — register a single Bitbucket OAuth consumer and add its credentials
   to the backend environment. You do this once.
2. **Ongoing, self-service** — each user clicks **Connect Bitbucket**, authorizes the consumer,
   and links repos to applications. No admin involvement after step 1.

Bitbucket Server / Data Center is not supported yet.

---

## Part 1 — Register the OAuth consumer (admin, one time)

In Bitbucket Cloud, open a workspace you administer:

**Workspace settings → Apps and features → OAuth consumers → Add consumer**

(Direct URL: `https://bitbucket.org/{workspace}/workspace/settings/oauth-consumers`)

Fill in:

| Field | Value |
|---|---|
| **Name** | e.g. `AppSec Catalog` |
| **Callback URL** | `<BACKEND_ORIGIN>/api/integrations/scm/callback` — locally `http://localhost:5000/api/integrations/scm/callback` |
| **This is a private consumer** | ⬜ **Uncheck** (required so your users can authorize it — a private consumer only works for the owner) |

### Permissions

Under **Permissions** (everything else can stay *No*):

| Permission | Access |
|---|---|
| **Account** | Read *(identity: username, avatar)* |
| **Repositories** | Read *(list repos and read manifest/lockfiles for dependency detection)* |

No write permissions are needed.

After saving, copy the consumer **Key** (client id) and **Secret**.

---

## Part 2 — Configure the backend environment (admin, one time)

Add these to `backend/.env` (see `backend/.env.example` for the annotated template):

```env
BITBUCKET_CLIENT_ID=your-consumer-key
BITBUCKET_CLIENT_SECRET=your-consumer-secret
```

**Also required:** `INTEGRATIONS_ENCRYPTION_KEY` must be set (the same key used for other
integrations). The Bitbucket access and refresh tokens are encrypted at rest with it, so
connecting fails if it's blank. Generate one with:

```bash
openssl rand -hex 32
```

Restart the backend after editing `.env`.

> **Verify it's configured:** open **Settings → Integration settings**. The connected-accounts
> panel shows a **Connect Bitbucket** button when the consumer env is detected; if the panel says
> no source-control provider is configured, the backend didn't see both `BITBUCKET_CLIENT_*` vars
> (and GitHub isn't configured either).

---

## Part 3 — Users connect their own Bitbucket (self-service)

Each user, once logged in:

1. **Settings → Integration settings → Connect Bitbucket.**
2. Bitbucket asks them to **authorize** the consumer.
3. They're redirected back; their account shows as connected.
4. On any application they can access, **Integrations tab → Link a repository** → pick a repo.
   Languages, frameworks, and dependencies are pulled immediately.

Users can **Sync** (re-pull), **Apply** detected language/framework to the app's fields, and
**Unlink** at any time. Everyone sees the catalog-wide **Dependencies** view scoped to their own
company (admins see everything).

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| No **Connect Bitbucket** button | One or both of `BITBUCKET_CLIENT_ID` / `BITBUCKET_CLIENT_SECRET` is missing; restart backend after editing `.env`. |
| Redirected back with `?scm=error` | Callback URL mismatch, "This is a private consumer" still checked, or `INTEGRATIONS_ENCRYPTION_KEY` blank (token can't be encrypted). |
| Repo picker is empty | The connected account has no repositories, or the consumer is missing **Repositories: Read**. |
| Sync fails after a few hours | Reconnect Bitbucket (the refresh token was missing or revoked). |
| A repo's dependencies look incomplete | Only **root-level** manifests are parsed (`package.json`, `requirements.txt`, `go.mod`, `pom.xml`, `composer.json`, `Gemfile`). Manifests in subfolders (monorepos) aren't picked up yet. Resolved versions come from lockfiles for npm and Composer; other ecosystems show the declared range. |

## Security notes

- The consumer uses **read-only** account and repository permissions.
- Access tokens expire (~2 hours). The catalog stores an encrypted **refresh token** and mints a
  new access token on demand. Tokens are encrypted with `INTEGRATIONS_ENCRYPTION_KEY`.
- The catalog-wide Dependencies view and all per-app repo actions are **company-scoped on the
  backend**: non-admins only ever see their own company's applications and dependencies, even when a
  repository is shared across companies.
