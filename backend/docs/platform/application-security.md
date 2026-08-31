# Security, Threat Modeling & Compliance

Part of the [Applications](/docs/applications) detail page — how an application's security posture and policy standing actually get recorded and evaluated.

## Security

Orbit tracks which security tools cover an application — SAST, DAST, SCA, application firewall, and API security — and how thoroughly. This is the "Tool Usage" half of the score.

<details>
<summary>What gets recorded for each category</summary>

| Category | Notes |
|---|---|
| **SAST** (static analysis) | Checkbox to indicate SAST already covers SCA scanning — SCA is then scored from the same tool/level/date instead of entered separately |
| **DAST** (dynamic analysis) | |
| **SCA** (dependency scanning) | Skipped if covered by SAST, above |
| **Application Firewall** | Or mark "Not Applicable" |
| **API Security** | Or mark "Not Applicable"; when applicable, this is also where you upload/paste the app's OpenAPI/Swagger schema (file or raw YAML/JSON) — powers the API Schema tab below |

There's also a free-text **Security Testing Description** field for describing your overall testing practices in your own words.

</details>

## Threat Model

A lightweight, structured threat model built around Adam Shostack's four questions — what are we working on, what can go wrong, what will we do about it, did we do a good job. High-risk areas like authentication or payment processing get their own components with their own threat lists, and where AI features are enabled, **✨ Draft with AI** puts together a first-pass draft for you to review.

<details>
<summary>How the workflow breaks down</summary>

- Start by answering these for the whole application: its scope, who interacts with it, what sensitive data it handles.
- Break out specific parts that carry outsized risk (authentication, payment processing, data storage, admin functions, integrations) as separate **components**, each with its own scope and threat list.
- Checking certain answers at the whole-application level (e.g. that the app handles payment data, or privileged users interact with it) automatically creates the matching component so it doesn't get missed.
- For each threat: an optional STRIDE category, a description, a mitigation, and a status.
- Where AI features are enabled, **✨ Draft with AI** generates a first-pass draft (scope, actors/data types, starter components, candidate threats) that you review and selectively accept.
- The model as a whole, and each component, tracks a status (`draft` / `in_review` / `approved` / `superseded`) and a reviewer, and can be marked reviewed at any time.

</details>

## API Schema

Once an application's API schema is on file, Orbit turns it into a browsable security view — enough to sanity-check how the API protects its data without reading the raw spec.

<details>
<summary>What the generated view includes</summary>

- Schema title/version, total endpoint count, count of fields flagged for review
- Authentication schemes it declares
- A searchable, sortable, filterable list of every endpoint

Expanding an endpoint shows whether it requires authentication, a table of sensitive fields it uses (what, where, why it's a concern, what to check), and sample request/response bodies.

</details>

## Infosec Policy Compliance

A pass/fail evaluation against every security policy that applies to this application. **[Read more about Policies & Compliance →](/docs/policies-and-samm)**

<details>
<summary>How the evaluation breaks down</summary>

- A summary card shows total controls, how many are meeting requirements vs. not, and an overall compliance percentage.
- Below it, each applicable policy breaks out into its individual controls, showing exactly which field(s) drove a Pass or Fail and what the requirement was.
- Some controls can't be evaluated automatically because they aren't mapped to a specific field — for those, admins can apply a **manual override** (compliant or not, with a justifying note), visible to everyone on the tab, including who set it and when.

</details>

## Application Metadata History

Visible to administrators only. A full version history of the application's metadata, including changes still pending approval from public onboarding forms.
