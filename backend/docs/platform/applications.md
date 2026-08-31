# Applications

The **Applications** catalog is the heart of Orbit. Every website, service, or internal tool your company runs lives here as its own record, and everything else in the platform — scoring, policy compliance, dependency visibility, threat modeling — is built on top of it. See [Overview & Core Concepts](/docs/overview) for how an Application relates to a Company, Product, or Domain.

## Finding an application

The **Applications** list shows every application you have access to — company, owner, status, security score, and when it was last reviewed. Non-admins see only their own company's applications; admins see and can filter across all of them. You can search, sort, and generate a Technical Onboarding Form link for any application straight from the list.

<details>
<summary>Column details</summary>

- **Status** — `onboarded`, `pending_technical`, or `pending_executive`, alongside how many of the record's fields are filled in
- **Score** — out of 100, color-coded (green ≥76, yellow 51–75, red ≤50)
- **Last Reviewed** — when the metadata was last confirmed accurate, or "Never"

</details>

## Adding an application

Three ways an application ends up in the catalog: two public onboarding forms (a business intake step followed by a technical-details step) for bringing in a whole company's inventory without everyone needing an account, a **New Application** form for a single logged-in submission covering both business and technical fields at once, or a bulk CSV import for adding several at once. The onboarding forms are covered in [Getting Started](/docs/getting-started); this page picks up from there — versioning, scoring, and policy evaluation for an application once it exists.

<details>
<summary>Bulk CSV import</summary>

1. Pick the company the applications belong to
2. Upload the file
3. Map its columns to application fields (name, description, owner, repo URL, hosting domains, tech stack, business criticality, and the same SAST/DAST/SCA/firewall/API-security fields as the manual form)
4. Orbit creates one application per row immediately

</details>

## The application detail page

Opening an application shows its name, company, and product, its status, and an **Application Security Score** — split into Knowledge Sharing (how complete the metadata is) and Tool Usage (how well the application is covered by security tooling and testing), each with its own breakdown and, when there's room to improve, specific **Quick Wins**. **[Read more about how the score is calculated →](/docs/scoring-methodology)**

If you belong to the application's company, or you're an admin, you can edit the record directly; admins can also mark it as reviewed or delete it.

The rest of the detail page is organized into tabs, split across a few pages here so each one stays focused:

- **[Data, Deployments & Integrations](/docs/application-data)** — the tabs you'll use day to day: core metadata, deployment history, and linking a source-control repo
- **[Security, Threat Modeling & Compliance](/docs/application-security)** — testing/tooling setup, the threat model, the generated API schema view, and policy compliance
- **[Dependencies](/docs/dependencies)** — the SBOM/dependency view fed by a linked repo, available both from an application and as its own catalog-wide page

## Everything here is also available via the API

Every action covered across these pages — creating and updating applications, recording deployments, uploading an API schema, reading scores and policy compliance, pulling the dependency inventory — has a corresponding API endpoint, documented interactively at [`/api/docs`](/api/docs). Whether a change was made through the web UI or the API is tagged on each entry in an application's version history, so the catalog stays a reliable audit trail no matter how the data got there. **[Read more about API tokens →](/docs/settings-and-automation)**
