# Data, Deployments & Integrations

Part of the [Applications](/docs/applications) detail page — the tabs you'll use day to day: core metadata, deployment history, and linking a source-control repo.

## App Data

The core record: basic info (name, description, repository, team contact, business criticality), technical info (language, framework, environment, version, auth, data types, hosting domains), and which other applications this one talks to.

<details>
<summary>Full field list</summary>

**Basic Information**
- Name, company, description/use case
- Repository — a plain URL, or once linked, a live GitHub/Bitbucket/Azure DevOps link
- Development team contact
- Business criticality (1–5)
- Critical aspects (availability, data handling, confidentiality, integrity, etc.)

**Technical Information**
- Language, framework, server environment
- Current version, internal- vs. external-facing, deployment type
- Auth profiles and data types handled
- Hosting Domains — see [Domains](/docs/domains)

**Interfaces with Other Applications** — which other applications this one talks to, picked from the catalog or typed in as a new name.

</details>

Linking a repository surfaces its detected languages and frameworks and feeds the application's dependency inventory. **[Read more about Dependencies →](/docs/dependencies)**

## Deployments

A running history of when and where the application was deployed, filterable by environment. You can log a deployment manually, or automate reporting from your CI/CD pipeline using a deployment token. **[Read more about API tokens →](/docs/settings-and-automation)**

<details>
<summary>What's recorded per deployment</summary>

Date, environment, version, git branch, deployed-by, and notes.

</details>

## Integrations

Link a source-control repository — GitHub, Bitbucket, or Azure DevOps — to pull in its detected languages/frameworks and dependency manifest. You can also link the application to a Tenable or Wiz tag so tool-side findings match back to the catalog record; available tools depend on what's configured for your company or catalog-wide.

## App Timeline

Visible to administrators only — a running notes/timeline feed for logging context, decisions, or follow-ups against the record over time.
