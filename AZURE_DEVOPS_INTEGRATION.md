# Azure DevOps Integration Setup

This integration lets **individual users connect their own Azure DevOps Services account** and
link Git repositories to applications. Once linked, the catalog automatically pulls the repo's
**frameworks and top-level dependencies** (viewable per-application and in the catalog-wide
**Dependencies** view). Azure DevOps does not expose a languages-by-bytes API the way GitHub
does, so language is left blank unless you apply it yourself.

There are two distinct steps:

1. **One-time, admin-only** — register a Microsoft Entra ID app and add its credentials to the
   backend environment. You do this once.
2. **Ongoing, self-service** — each user clicks **Connect Azure DevOps**, authorizes the app,
   and links repos to applications. No admin involvement after step 1.

Azure DevOps Server (on-prem / Azure DevOps Server) is not supported yet. Microsoft accounts
(MSA) that back personal Azure DevOps orgs are also limited: Entra apps do not natively support
MSA for the Azure DevOps resource. Work/school (Entra) orgs are the intended audience.

Microsoft's older "Azure DevOps OAuth" app type is deprecated (no new registrations as of April
2025). This integration uses **Microsoft Entra ID OAuth**.

---

## Part 1 — Register the Entra ID app (admin, one time)

In the [Microsoft Entra admin center](https://entra.microsoft.com):

**Identity → Applications → App registrations → New registration**

Fill in:

| Field | Value |
|---|---|
| **Name** | e.g. `AppSec Catalog` |
| **Supported account types** | **Accounts in any organizational directory** (multitenant) — or a single tenant if every user is in yours |
| **Redirect URI** | Platform **Web**, URI `<BACKEND_ORIGIN>/api/integrations/scm/callback` — locally `http://localhost:5000/api/integrations/scm/callback`. In production behind Caddy this is usually `https://YOUR-DOMAIN/api/integrations/scm/callback`. |

### API permissions

**API permissions → Add a permission → APIs my organization uses → Azure DevOps**
(resource id `499b84ac-1321-427f-aa17-267ca6975798`).

Add these **delegated** permissions:

| Permission | Access |
|---|---|
| **vso.profile** | Read *(identity + the orgs the user belongs to)* |
| **vso.code** | Read *(list Git repos and read manifest/lockfiles)* |

Do **not** add `user_impersonation` unless the granular scopes are missing — it grants full
access to every Azure DevOps API the user can call.

**Grant admin consent** for the tenant if you want users to skip the extra consent prompt
(optional; users can still consent individually).

### Client secret

**Certificates & secrets → New client secret** — copy the **Value** (shown only once) and the
app's **Application (client) ID** from the Overview page.

If you registered as single-tenant, also copy the **Directory (tenant) ID**.

---

## Part 2 — Configure the backend environment (admin, one time)

Add these to `backend/.env` (see `backend/.env.example` for the annotated template):

```env
AZURE_DEVOPS_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_DEVOPS_CLIENT_SECRET=your-client-secret
# Optional. Default is "organizations" (any work/school directory).
# Use your tenant GUID to lock the app to one directory.
AZURE_DEVOPS_TENANT_ID=
# Optional. Set this when the public callback URL isn't FRONTEND_URL/api/integrations/scm/callback
# (always set it for local dev if PORT isn't 5000, or if the backend isn't behind the same host).
AZURE_DEVOPS_REDIRECT_URI=http://localhost:5000/api/integrations/scm/callback
```

`AZURE_DEVOPS_REDIRECT_URI` must **exactly** match the Redirect URI registered on the Entra app
(and is sent on both authorize and token exchange).

**Also required:** `INTEGRATIONS_ENCRYPTION_KEY` must be set (the same key used for other
integrations). The Azure DevOps access and refresh tokens are encrypted at rest with it, so
connecting fails if it's blank. Generate one with:

```bash
openssl rand -hex 32
```

Restart the backend after editing `.env`.

> **Verify it's configured:** open **Settings → Integration settings**. The connected-accounts
> panel shows a **Connect Azure DevOps** button when the Entra env is detected.

---

## Part 3 — Users connect their own Azure DevOps (self-service)

Each user, once logged in:

1. **Settings → Integration settings → Connect Azure DevOps.**
2. Microsoft asks them to pick an account and **authorize** the app.
3. They're redirected back; their account shows as connected.
4. On any application they can access, **Integrations tab → Link a repository** → pick a repo.
   Frameworks and dependencies are pulled immediately.

Users can **Sync** (re-pull), **Apply** detected language/framework to the app's fields, and
**Unlink** at any time. Everyone sees the catalog-wide **Dependencies** view scoped to their own
company (admins see everything).

The repo picker lists Git repositories across **every Azure DevOps organization** the user
belongs to. Display names look like `org/project/repo`.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| No **Connect Azure DevOps** button | `AZURE_DEVOPS_CLIENT_ID` or `AZURE_DEVOPS_CLIENT_SECRET` is missing; restart backend after editing `.env`. |
| Redirected back with `?scm=error` | Redirect URI mismatch (Entra app vs `AZURE_DEVOPS_REDIRECT_URI` / inferred callback), missing `vso.profile`/`vso.code`, or `INTEGRATIONS_ENCRYPTION_KEY` blank. |
| AADSTS50011 / redirect URI | The URI in Entra and the URI the backend sends are not identical (scheme, host, port, path, no trailing slash). |
| Repo picker is empty | The account has no Git repos, the user isn't a member of any org, or `vso.code` wasn't granted. TFVC repos are skipped. |
| MSA / personal Microsoft account can't connect | Entra apps don't natively support MSA for Azure DevOps. Use a work/school account in an Entra-backed org. |
| Sync fails after an hour | Reconnect Azure DevOps (the refresh token was missing or revoked). |
| A repo's dependencies look incomplete | Only **root-level** manifests are parsed (`package.json`, `requirements.txt`, `go.mod`, `pom.xml`, `composer.json`, `Gemfile`). Manifests in subfolders (monorepos) aren't picked up yet. |

## Security notes

- The app uses **read-only** Azure DevOps delegated permissions (`vso.profile` + `vso.code`).
- Access tokens expire (~1 hour). The catalog stores an encrypted **refresh token** and mints a
  new access token on demand. Tokens are encrypted with `INTEGRATIONS_ENCRYPTION_KEY`.
- The catalog-wide Dependencies view and all per-app repo actions are **company-scoped on the
  backend**: non-admins only ever see their own company's applications and dependencies, even when a
  repository is shared across companies.
