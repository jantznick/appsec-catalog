# Integrations

## Why connect integrations

Application records can carry security-tooling info by hand, or Orbit can pull it live from your source-control provider. Live sync wins on every count: it stays current automatically, reflects what's actually deployed, and feeds Orbit real dependency data instead of a checkbox.

Connecting a GitHub, GitLab, Bitbucket, or Azure DevOps account and linking it to your applications is what makes that possible. Once a repo is linked:

- Orbit detects the application's **languages** and **frameworks** directly from the repo.
- Orbit pulls the repo's **dependency inventory** (its SBOM), which powers the [Dependencies](/docs/dependencies) view.
- Each dependency is checked against [OSV.dev](https://osv.dev) for known advisories.
- The application's tool-integration standing improves, since Orbit is now working from live source data instead of self-reported metadata.

In short: connecting an account and linking repos turns Orbit from a place where you maintain metadata into a place that reflects your real codebase.

## Connecting a source-control account

Connecting your own GitHub, GitLab, Bitbucket, or Azure DevOps account is open to every user — nothing about it is admin-only. An administrator does need to register a provider before it's available, and you can connect as many accounts as you like, including more than one on the same provider.

<details>
<summary>Connect and manage an account</summary>

Connect a provider and approve its standard OAuth authorization flow. You're returned to Orbit with the account showing as connected, along with your avatar, username, and provider badge.

- If no provider has been registered yet, that's an administrator setup step, not something you can do yourself.
- Disconnecting an account doesn't unlink repositories already tied to applications, but they'll need a reconnected account before they can sync again.
- Once you have an account connected, you can create a new application directly from one of its repositories, with the name and URL pre-filled.

</details>

## Linking an application to a repo

Connecting an account is only half the picture — it doesn't do anything until a specific application is pointed at a specific repository. **[Read more about Applications →](/docs/applications)**

Once linked, Orbit keeps that application's languages, frameworks, and dependency inventory current, and you can re-sync, switch repos, or unlink at any time.

<details>
<summary>Link, sync, or change a repository</summary>

Pick a repository from a filterable list of everything available in your connected account(s). Orbit links it immediately, then shows the languages and frameworks it detected so you can confirm or adjust before saving.

Once linked, three actions are available:

| Action | What it does |
|---|---|
| **Sync** | Re-pulls the latest repository data (branch, languages, dependencies) and re-checks dependencies against OSV advisories. |
| **Change** | Picks a different repository to link instead. |
| **Unlink** | Disconnects the repo from this application. Dependency and language data already pulled stays available to other applications sharing the same repo link. |

</details>

Once data is pulled in, you get the detected languages and frameworks plus a full dependency table with advisory flags. Advisory flags come from OSV.dev and are informational — treat your dedicated vulnerability-scanning tool as authoritative for anything you need to act on.

This same integration surface is also where a Tenable or Wiz tag can be linked to the application for vulnerability data from those tools, separate from the repo link.

## Centrally-managed integrations

Credentials for tools like Tenable.io and Wiz are configured centrally by Hearst and are admin-only. As a regular user, connecting your own source-control account is the only integration you'll interact with directly.
