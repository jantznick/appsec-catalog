# Dashboards

Dashboards give you a role-specific view of your organization's application security posture in **Orbit**. Instead of one generic view, Orbit offers several dashboards, each built for a different job — from a high-level compliance rollup for leadership to an actionable integration checklist for engineers.

## Getting to a dashboard

There are four dashboards, each tailored to a different role: Executive, Developer, Application Owner, and Program Operations. Switch between them anytime from the dashboard switcher.

If your account is scoped to a single company, every dashboard automatically limits its data to that company's applications.

> Note: there is also a "Platform Administration" view, but it's only available to platform administrators and isn't covered here.

---

## Executive Dashboard

Gives leadership a program-level read on coverage, risk, compliance, and maturity — without digging into individual applications.

<details>
<summary>What this dashboard shows</summary>

| Metric | What it shows |
|---|---|
| **Onboarding and tool coverage** | How many applications are in scope, how many have a **Wiz** cloud-security integration configured, and what percentage of the portfolio that represents. |
| **Security testing coverage** | How many applications have at least one security testing tool configured (**SAST**, **DAST**, or **SCA** — see [Applications](/docs/applications)), broken out by testing type, plus an overall coverage percentage. |
| **Applications by status** | A count of applications grouped by their lifecycle status (e.g. onboarded, pending approval). |
| **Highest- and lowest-scoring applications** | The applications with the best and worst latest security score — the lowest is surfaced as the biggest risk. |
| **Average score** | The mean of the latest score across all scored applications, plus how many applications currently have a score. |
| **Policy compliance rollup** | Portfolio-wide compliance percentage, plus how many applications are covered, fully compliant, and how many control overrides are in play. **[Read more about Policies & Compliance →](/docs/policies-and-samm)** |
| **SAMM maturity summary** | A rollup of your organization's most recently completed SAMM self-assessments and their average maturity score. **[Read more about Policies & Compliance →](/docs/policies-and-samm)** |
| **Company participation** (admins only) | For platform administrators: how many companies have at least one application onboarded versus how many have none yet. |

</details>

## Developer Dashboard

The default landing view for most users — oriented around integration hygiene and build-time controls for the people working day-to-day in an application's codebase and pipeline.

<details>
<summary>What this dashboard shows</summary>

| Metric | What it shows |
|---|---|
| **Portfolio snapshot** | How many applications you have in scope, how many source-code repositories are connected to Orbit, and how many branches have any security data associated with them. |
| **Integrations needing attention** | Applications with no connected repository or security-tool link at all, and applications with a repository recorded but never actually synced — the two most actionable "go fix this" buckets for engineering. |
| **CI/CD control coverage** | How many applications have at least one deployment/CI-CD token configured, as a proxy for whether a pipeline is wired into Orbit at all. |
| **SAST coverage** | How many applications (and what share) have a static testing tool configured. See [Applications](/docs/applications) for how tooling is recorded. |
| **SCA coverage** | How many applications (and what share) have a software composition analysis tool configured, scanning open-source dependencies. |

Findings-related tiles (e.g. vulnerability counts) aren't part of this dashboard yet — they depend on a deeper Wiz integration that hasn't landed.

</details>

## Application Owner Dashboard

Gives the person responsible for one or more applications a read on their health, onboarding completeness, and what's outstanding.

<details>
<summary>What this dashboard shows</summary>

| Metric | What it shows |
|---|---|
| **Health** | The average latest security score across your applications, and how many currently have a calculated score. |
| **Onboarding completeness** | The average profile completeness across your applications (see [Applications](/docs/applications)), what share have been formally reviewed, and how many have a threat model started versus approved. |
| **Security testing coverage** | A per-type breakdown of SAST, DAST, and SCA coverage across your applications. |
| **Outstanding actions** | The total number of policy control exceptions currently recorded across your applications, worth periodically reviewing. **[Read more about Policies & Compliance →](/docs/policies-and-samm)** |

</details>

## Program Operations Dashboard

Helps the people running the AppSec program day-to-day track coverage gaps, governance rollups, and data-quality issues across the whole portfolio.

<details>
<summary>What this dashboard shows</summary>

| Metric | What it shows |
|---|---|
| **Coverage** | How many applications are fully onboarded, how many have a Wiz configuration in place, and how many have any security testing tool configured — each with its coverage percentage. |
| **Governance** | Overall policy compliance percentage, controls met versus evaluated, and total exceptions recorded across the portfolio. **[Read more about Policies & Compliance →](/docs/policies-and-samm)** |
| **Applications never reviewed** | Applications whose metadata has never been marked as reviewed. |
| **Stale integrations** | Applications with a connected repository that hasn't synced in over 30 days. |
| **Applications missing metadata** | Applications whose profile completeness is below 100%. |

Remediation timing and finding-level metrics aren't part of this view yet — they depend on vulnerability-history data that isn't available.

</details>

---

Every dashboard is scoped to your access: non-admin users only ever see data for their own company, while administrators can additionally filter by company or division.
