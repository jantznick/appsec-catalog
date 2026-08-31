# Settings, API Access & Automation

The **Settings** hub is where you manage your own credentials and connect Orbit to other tools. Administrators get a full set of catalog-configuration and program-management screens; regular users get a narrower view focused on account access and automation.

This page covers what a non-admin sees and can do: creating API tokens for scripts and integrations, deployment tokens for CI/CD, tracking security-findings exports, and checking product updates.

## Your account settings

| Area | What you can access | Admin-only (filtered out for you) |
|---|---|---|
| **Account and access** | **API tokens**, **Deployment tokens** | Users |
| **Security program** | **Integration settings** — connect your own GitHub, Bitbucket, or Azure DevOps account | Catalog-wide tool integrations, policy controls, scoring settings, AI settings |
| **Review workflow** | **Security export jobs**, covered below | Pending approvals |

Everything else — Companies, Divisions, Deploy settings, Policy controls, Scoring settings, AI settings, Pending approvals, and Product updates — is admin-only and filtered out for everyone else.

Orbit doesn't have a separate profile page; account-level actions like changing your password live on the Users directory. See [Companies & Team](/docs/companies-and-team) for that.

## API tokens

API tokens are personal credentials for calling the Orbit API programmatically — scripts, scheduled jobs, internal tooling, anything that needs to read or write data the same way you can in the UI.

### Creating a token

As a non-admin, a token is always scoped to your own company, with admin abilities disabled by default — it can't do anything your own account couldn't already do in the UI.

<details>
<summary>Create a token</summary>

Give it an optional name (for example, "Terraform / Reporting script") so you can recognize it later. The company restriction is fixed to your own company — you can't create an unrestricted token or scope it elsewhere. Leave **Prevent admin abilities for this token** checked; it's the default, and forced on automatically for company-restricted tokens, so it can't use admin-level abilities even if your own account has them.

The full token value is shown **exactly once**, immediately after creation. Copy it into a password manager or secrets store right away — Orbit only ever stores a short hint of it afterward, never the full value.

</details>

### Using it

Send the token as the `api-key` header on your API requests:

```
api-key: asc_<tokenId>.<secret>
```

That's the exact string shown in the creation panel.

### Managing tokens

Your token list shows each token's name, hint, company scope, whether admin access is allowed, and when it was created and last used. Revoking a token disables it immediately — this can't be undone, so anything using that token will need a replacement.

### Full API reference

Every endpoint, request/response shape, and schema is documented in **[Orbit's API Reference](/api/docs)** — the next stop once you have a token.

## Deployment tokens

Deployment tokens look similar to API tokens but are a much narrower tool: they only let a CI/CD pipeline report a deployment event for the applications they're explicitly scoped to. A leaked deployment token can't touch application details, user data, or company information — worst case, it logs a bogus deployment on the applications it's attached to.

### Creating a token

Every deployment token belongs to at least one specific application, so it can only report deployments for that application.

<details>
<summary>Create or rescope a token</summary>

Choose the application it should be scoped to (required) and give it an optional name (for example, "Production Pipeline Token"). To scope a token to more than one application, edit it afterward to rename it or change which applications it's allowed to report deployments for.

</details>

### Wiring it into CI/CD

Orbit can generate a ready-to-use command for your pipeline that reports a deployment for one of the token's scoped applications, pre-filled with the token and application details — you fill in a handful of pipeline-specific placeholders. This is what actually records the deployment that shows up against the application. **[Read more about Applications →](/docs/applications)**

<details>
<summary>Generate the command</summary>

Pick one of the token's associated applications. Orbit generates a ready-to-use `curl` or `wget` command, pre-filled with the token value, application ID, and timestamp, plus placeholders for `environment`, `version`, `gitBranch`, `deployedBy`, and `notes` for you to fill in from your pipeline.

</details>

Revoking a token stops it from logging any further deployments. This can't be undone, so double-check it isn't still wired into a live pipeline before revoking.

## Security findings export jobs

This page ("Your jobs") tracks the Tenable and Wiz CSV exports you've started — it doesn't kick off new exports itself; those are started from company integrations pages or, for admins, the admin export tooling. Once a job exists, this is where you follow it through to a download.

Each row shows when the job started, its scope, the company it covers, its status, and how long it ran. Running jobs update automatically and can be canceled; completed jobs can be downloaded; finished or failed jobs can be deleted to clean up the list. Orbit also cleans up automatically — starting a new export removes your own completed or failed jobs older than 30 days, though running jobs are never auto-deleted.

## What's New

A simple, read-only feed of published Orbit release notes and product updates — category, release label, title, publish date, a short summary, and the full write-up. Publishing to this feed is admin-only; as a regular user, this is just where you check what's changed recently in the platform.
