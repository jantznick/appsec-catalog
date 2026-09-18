# Policies & Compliance

## What a Policy is

A **Policy** is a named set of security requirements — usually a translation of a real document, like your company's Information Security Policy, into something Orbit can check automatically instead of by questionnaire.

A Policy is made up of one or more **Controls**, each a specific requirement (for example, "pre-production security scanning required") mapped to metadata Orbit tracks on an Application.

The Policies you'll see are your company's implementation of the wider AppSec program's requirements — see [Meeting the Policy](/docs/program-policy-baseline) for what's actually required and why.

### Scope

Each Policy applies at one of four scopes:

- **Global** — every Company.
- **Division** — every Company in a Division.
- **Company** — one Company.
- **Conditional** — based on other criteria.

### How Controls are checked

A Control's requirement is one or more **field checks** against an Application's catalog data (for example, "static analysis tool is set"). When a Control has multiple checks, they're combined with **AND** or **OR**. Orbit evaluates every in-scope Application automatically and reports whether it's **meeting** or **not meeting** each Control. A Control with no field checks instead relies on an admin-set manual override (or other rule).

Live pass/fail results for a specific Application — including any manual overrides — live on that Application's **Infosec Policy Compliance** tab. **[Read more about Applications →](/docs/applications)**

## Viewing a Policy's requirements

Every Policy has a read-only page showing exactly what it requires — its Controls and the field mappings behind them — so you can see what's being checked before looking at a specific Application's results.

<details>
<summary>What's shown on a Policy's page</summary>

- The Policy's **name** and **description**, its **scope**, and whether it's currently **Inactive**.
- A count of how many Controls the Policy contains.
- Each Control, in order, with its **control ID**, **name**, **category**, **description**, and whether it's **Inactive**.
- For each Control, its **field mappings** — the field, comparison operator, and value being checked — plus whether checks combine with **AND** or **OR**.
- A Control with no field mappings notes that compliance may rely on admin overrides instead.

For a live result on a specific Application, its **Infosec Policy Compliance** tab shows each Control's Meeting/Not Meeting status, the actual field values compared, and any manual override on record.

</details>

## SAMM Assessments

### What SAMM is

**OWASP SAMM** (Software Assurance Maturity Model) is an open, vendor-neutral framework for measuring and improving how mature an organization's software security practices are — a structured self-assessment of *process* maturity, not a technical scan.

Orbit uses **SAMM v2.0**, organized into five business functions:

| Business function | What it covers |
|---|---|
| **Governance** | Directing, measuring, and supporting software security. |
| **Design** | Considering security during design and architecture. |
| **Implementation** | Building and deploying securely, managing defects. |
| **Verification** | Assessing and testing software security. |
| **Operations** | Managing security in production and over the application lifecycle. |

Each function has three practices (15 total), and each practice is scored 0–3 from two maturity questions. Orbit runs this as a SAMM-aligned self-assessment, per Company.

See [SAMM & Maturity](/docs/program-samm) for what each of the 15 practices actually assesses.

### Starting an assessment

A Company has one assessment in progress at a time, tracked as a Draft until it's submitted. Starting a new one picks up an existing draft rather than creating a second.

### Answering the assessment

Answer two maturity questions per practice; progress saves automatically, and you can pick it back up later without losing anything.

<details>
<summary>How the assessment flow works</summary>

- Overall progress and per-function completion are visible throughout, and you can jump straight to any business function's next unanswered practice.
- Both questions must be answered before moving on to the next practice.
- **Save & finish later** exits without losing progress.
- Once all 15 practices are answered, you can submit.

</details>

### Submitting

Submitting marks the assessment **completed** and locks it — answers become read-only and it then awaits admin review. Redoing an assessment later means starting a new one, since a completed assessment can't be edited.
