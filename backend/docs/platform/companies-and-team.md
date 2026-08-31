# Your Company & Team

Every Orbit user belongs to a **Company** — the organizational home for your applications, domains, and teammates. See [Overview & Core Concepts](/docs/overview) for where a Company fits in Orbit's data model.

This page covers what you can see and do around your company and its users as a regular (non-admin) user.

## Your company's page

The **Companies** page is where you find your company's profile: its portfolio of applications, security coverage, domains, policies, and SAMM maturity assessments, alongside the default settings new applications inherit when they're onboarded. As a non-admin, you only ever see your own company here — an administrator sees and can search across every company in Orbit.

<details>
<summary>What's on each tab</summary>

| Tab | What it shows |
|---|---|
| **Overview** | Your company's name, email domains (the domains that automatically assign new users to this company), division (if it belongs to one), and engineering manager, plus the default settings (language, framework, server environment, facing, deployment type, auth profiles, data types) that get pre-filled when new applications are onboarded for your company. |
| **Application environment** | A portfolio map of your company's applications. |
| **Security coverage** | A rollup of how well your applications are covered by security tooling and testing. |
| **Tools & connections** | Your public onboarding form link (for capturing new application details from managers) and any security-tool integrations connected for your company. |
| **Domains** | The hosting domains associated with your company's applications, and how many applications each one hosts. |
| **Policies** | The security policies that apply to your company. |
| **Maturity assessment** | SAMM maturity assessments tracked for your company. |

</details>

If you're a member of the company, you can edit most of these fields directly — name, email domains, and division stay admin-only.

The page also surfaces your company's **Average Score**, with quick links to its highest- and lowest-scoring applications, plus exports for security findings, technical form links, and your portfolio. See [Applications](/docs/applications) for what drives an individual application's score.

<details>
<summary>Score cards and exports</summary>

| Element | Description |
|---|---|
| **Score cards** | Your company's **Average Score** across all of its scored applications (with a link to the scoring methodology), plus its **Highest Score** and **Lowest Score** applications, each linking straight to that application's record. A link to "View all applications" takes you to the full, filtered list of your company's applications. |
| **Download security findings** / **Download technical form links (CSV)** | Export buttons available to anyone in the company (not just admins). |
| **Export portfolio (CSV)** | From the Companies list, you can export your own company's portfolio to CSV even without admin rights. |

</details>

## Inviting and managing teammates

The **Users** page shows the people in your company, plus anyone who hasn't been assigned to a company yet. Invite a teammate by email — as a non-admin, the invite is automatically scoped to your own company — and you'll get a one-time invitation link, valid for 7 days, to send along.

Every user shows a **Pending** or **Verified** status. As a company member, you can verify a pending user into your company, but changing someone's company assignment, granting admin rights, or removing a user requires an administrator.

<details>
<summary>Invite and status details</summary>

**Inviting a teammate:**

1. Click **Invite User** and enter their email address.
2. As a non-admin, you can't assign the invite to a different company or grant admin rights; the modal tells you as much ("Only administrators can assign users to different companies or grant admin privileges").
3. Submitting the form creates the invitation and shows you a one-time invitation link to copy and send to your teammate.

That link expires after 7 days, and can be regenerated later using **Get Invite Link** (for a still-pending invite) or **Reset Password** (for an already-verified user) next to their row.

**Pending vs. verified:** every user shows a status badge:

- **Pending** — the account exists (typically because it was invited, or a teammate signed up using your company's email domain) but hasn't completed setup yet.
  - As a company member, you can click **Verify** on a pending user to approve them into your company.
  - If the user isn't yet assigned anywhere, verifying them automatically assigns them to your company.
  - You cannot change their company assignment or make them an admin — those controls only appear for admins.
- **Verified** — the account is active and fully set up.

You'll also see a **Role** badge (Admin or User) on every row, and a **Change Password** / **Set Password** button next to your own account.

**What requires an admin:** editing a user's company assignment or admin status, and removing a user entirely — a non-admin doesn't see these controls at all.

</details>
