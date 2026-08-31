# Getting Started

This page covers the two ways an [Application](/docs/overview) actually ends up in Orbit's catalog, and how a new team member gets access to a company's account. Both onboarding forms and the invitation flow work without an existing login, by design — the right people can get information into Orbit before they need an account.

## Getting applications into the catalog

There are two ways to add an application, depending on who you are and what you know about it.

**Public onboarding link** — no account required. It splits the work between whoever knows the business side of an application and whoever knows the technical side, so neither has to fill out a form they can't actually answer. A business contact describes each application at a high level and gets back a link to hand off to that application's engineering team, who fill in the technical details. Submitting the technical form doesn't update the application immediately — it queues a pending version for an administrator to review and approve.

<details><summary>What each onboarding form asks for</summary>

Business-level intake:

- Application name
- What the application's business purpose is
- Whether it's externally accessible
- Where it's hosted (cloud, on-premises, hybrid)
- Business criticality, 1–5
- What's most critical about it — Availability, Data Handling, Confidentiality, Integrity, and/or a free-text "Other"
- Development team contact info (optional)

Several applications can be submitted in one batch, and a CSV export of application names, contacts, and their individual technical-details links is available after submitting.

Technical details:

- Submitter's email address (required)
- Repository link, deployment frequency, and deployment method
- Whether the app requires special access permissions
- Whether it handles user-supplied data, what kind, and where it's stored
- Whether it touches PCI, PII, or PHI data
- Integrations with other catalogued applications
- Existing security testing — which SAST/DAST/SCA/WAF/API-security tools are used and how deeply each is integrated
- Anything else worth knowing about the application

</details>

**Add Application, from inside Orbit** — for logged-in users. One form covers both the business and technical information at once, and the application is fully onboarded immediately, with no review step. Non-admins can only create applications under their own company; admins can pick any company.

<details><summary>What the in-app form asks for</summary>

- Company/team, name, description
- Repo URL (optionally auto-filled from a connected source-control account, including language and framework)
- Language, framework, hosting, facing, and deployment type
- Auth profiles and data types
- Business criticality and critical aspects
- Interfaces with other applications (existing ones, or new ones created on the fly)
- The same security-tooling fields (SAST/DAST/SCA/WAF/API security) as the public technical form

</details>

See [Applications](/docs/applications) for what happens to an application's record after it exists — versioning, scoring, and policy evaluation.

## Joining an existing company's account

If your company already uses Orbit, new team members join by invitation rather than self-signup. Opening an invitation shows you the company, role, and (if applicable) administrator status it grants, and lets you set a password. Accepting it verifies your account and logs you straight in. An invalid or expired invitation won't let you through.

<details><summary>What accepting an invitation does</summary>

- Sets your password
- Marks your account as verified
- Logs you in directly, with no separate login step
- Applies the company and admin status from the invitation, if not already set

</details>
