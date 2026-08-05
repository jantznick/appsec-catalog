# GitHub Integration Setup

This integration lets **individual users connect their own GitHub account** and link
repositories to applications. Once linked, the catalog automatically pulls the repo's
**languages, frameworks, and top-level dependencies** (viewable per-application and in the
catalog-wide **Dependencies** view).

There are two distinct steps:

1. **One-time, admin-only** — register a single GitHub App and add its credentials to the
   backend environment. You do this once.
2. **Ongoing, self-service** — each user clicks **Connect GitHub**, installs the App on the
   repos they choose, and links them to applications. No admin involvement after step 1.

---

## Part 1 — Register the GitHub App (admin, one time)

Go to **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**
(for an org: **Org Settings → Developer settings → GitHub Apps**).

Fill in:

| Field | Value |
|---|---|
| **GitHub App name** | e.g. `AppSec Catalog` (the slug is derived from this) |
| **Homepage URL** | your app URL, e.g. `http://localhost:3000` |
| **Callback URL** | `<BACKEND_ORIGIN>/api/integrations/scm/callback` — locally `http://localhost:5000/api/integrations/scm/callback` |
| **Request user authorization (OAuth) during installation** | ✅ **Check this** (required — without it the install callback carries no user identity) |
| **Webhook → Active** | ⬜ **Uncheck** (this integration doesn't use webhooks, so no webhook URL is needed) |
| **Where can this GitHub App be installed?** | **Any account** (required so your users can install it on their own accounts/orgs — "Only on this account" would limit it to yours) |

### Permissions

Under **Repository permissions** (everything else can stay *No access*):

| Permission | Access |
|---|---|
| **Contents** | Read-only *(reads manifest/lockfiles for dependency detection)* |
| **Metadata** | Read-only *(mandatory; languages, description, topics, default branch)* |

No write permissions and no account permissions are needed.

### Generate credentials

After creating the App:

1. Note the **App ID**.
2. Note the **Client ID**, and click **Generate a new client secret** — copy it.
3. Under **Private keys**, click **Generate a private key** — this downloads a `.pem` file.
4. The **slug** is the last path segment of the App's public page URL
   (`https://github.com/apps/<slug>`).

---

## Part 2 — Configure the backend environment (admin, one time)

Add these to `backend/.env` (see `backend/.env.example` for the annotated template):

```env
GITHUB_APP_ID=123456
GITHUB_APP_SLUG=appsec-catalog
GITHUB_APP_CLIENT_ID=Iv1.abc123def456
GITHUB_APP_CLIENT_SECRET=your-client-secret
GITHUB_APP_PRIVATE_KEY=<see note below>
```

**Private key formatting.** The backend accepts the key three ways: a raw multi-line PEM, a PEM
with escaped `\n`, or a single-line **base64** encoding of the whole PEM (easiest for `.env`):

```bash
# macOS/Linux — produces a single line to paste after GITHUB_APP_PRIVATE_KEY=
base64 -i path/to/your-app.private-key.pem | tr -d '\n'
```

**Also required:** `INTEGRATIONS_ENCRYPTION_KEY` must be set (the same key used for other
integrations). The GitHub token is encrypted at rest with it, so connecting fails if it's blank.
Generate one with:

```bash
openssl rand -hex 32
```

Restart the backend after editing `.env`.

> **Verify it's configured:** open **Settings → Integration settings**. The "My GitHub account"
> panel shows a **Connect GitHub** button when the App env is detected; if it says
> "not configured," the backend didn't see all five `GITHUB_APP_*` vars.

---

## Part 3 — Users connect their own GitHub (self-service)

Each user, once logged in:

1. **Settings → Integration settings → Connect GitHub.**
2. GitHub asks them to **install/authorize** the App and **select which repositories** to grant.
3. They're redirected back; their account shows as connected.
4. On any application they can access, **Integrations tab → Link a GitHub repo** → pick a repo.
   Languages, frameworks, and dependencies are pulled immediately.

Users can **Sync** (re-pull), **Apply** detected language/framework to the app's fields, and
**Unlink** at any time. Everyone sees the catalog-wide **Dependencies** view scoped to their own
company (admins see everything).

### Note on organization repos

- **Personal repos:** fully self-service — the user installs the App on their own account.
- **Org repos:** depending on the org's GitHub App policy, a member's install may create an
  **approval request to org owners**. An owner approves (or installs) the App on the org **once**;
  after that, members can authorize and link org repos self-service.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "GitHub integration is not configured" on the settings panel | One or more of the five `GITHUB_APP_*` vars is missing; restart backend after editing `.env`. |
| Redirected back with `?github=error` | Callback URL mismatch, "Request user authorization during installation" not enabled, or `INTEGRATIONS_ENCRYPTION_KEY` blank (token can't be encrypted). |
| Repo picker is empty | The App isn't installed on any repos for that user, or (for org repos) the org install is pending owner approval. |
| A repo's dependencies look incomplete | Only **root-level** manifests are parsed (`package.json`, `requirements.txt`, `go.mod`, `pom.xml`, `composer.json`, `Gemfile`). Manifests in subfolders (monorepos) aren't picked up yet. Resolved versions come from lockfiles for npm and Composer; other ecosystems show the declared range. |

## Security notes

- The App uses **read-only** repository permissions (Contents + Metadata).
- Installation access tokens are **minted on demand** from the App private key and are short-lived
  (~1 hour); they are never persisted. Only the per-user OAuth token is stored, **encrypted** with
  `INTEGRATIONS_ENCRYPTION_KEY`.
- The catalog-wide Dependencies view and all per-app repo actions are **company-scoped on the
  backend**: non-admins only ever see their own company's applications and dependencies, even when a
  repository is shared across companies.
