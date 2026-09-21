# Policy Control Coverage Plan

Follow-on to [POLICY_CONTROL_MAPPING_PLAN.md](./POLICY_CONTROL_MAPPING_PLAN.md), which describes the
mapping *feature*. This document covers closing the mapping *gaps* for the two InfoSec policies
loaded in 2026-09: **Application Security (4.6.x, 15 controls)** and
**Software Development Lifecycle (6.3.x, 13 controls)**.

Both policies were created with `isActive: false`. A control with no field mappings and no override
evaluates to `not_meeting` ([services/policy.js](./backend/services/policy.js) `evaluateControl`),
so activating them before mapping would fail every application against every unmapped control.
**Keep both inactive until the phases below land.**

## Current state (2026-09-18)

28 controls: **9 mapped**, **19 unmapped**.

| Control | Logic | Field checks | Confidence |
|---|---|---|---|
| 4.6.2 Continuous security testing | AND | `sastTool exists` + `sastIntegrationLevel gte 1` | direct |
| 4.6.5 Software composition mgmt | OR | `scaTool exists` / `sastIncludesSca = true` | direct |
| 4.6.8 DAST and SAST coverage | OR | `sastIntegrationLevel gte 1` / `dastIntegrationLevel gte 1` | direct |
| 4.6.13 SCA | OR | `scaIntegrationLevel gte 1` / `sastIncludesSca = true` | direct |
| 6.3.4 Automated code review | AND | `sastTool exists` + `sastIntegrationLevel gte 1` | direct |
| 4.6.6 Application metadata | AND | `businessCriticality exists` + `description exists` | **partial — see Phase 3** |
| 6.3.7 OWASP Top 10 controls | AND | `dastTool exists` | proxy |
| 4.6.1 SDLC-managed development | AND | `repoUrl exists` | proxy |
| 6.3.1 SDLC process requirements | AND | `repoUrl exists` | proxy |

Portfolio pass rates across all 91 applications at time of writing: 4.6.8 → 43%, 4.6.6 → 41%,
6.3.7 → 40%, 4.6.2 / 6.3.4 → 31%, 4.6.5 / 4.6.13 → 27%, 4.6.1 / 6.3.1 → 16%.

> **Note on 4.6.1 / 6.3.1.** These were first mapped to `repoUrl exists AND gitBranch exists`.
> `gitBranch` is populated on **0 of 91** applications, making the control permanently
> unsatisfiable while appearing to be a real check. Reduced to `repoUrl exists`. Any new mapping
> should be validated against real portfolio data before being considered done.

## Three kinds of gap

Each needs a different fix, and they are not interchangeable:

1. **Vocabulary gaps** — the data is already in the database, but the column is not listed in the
   hardcoded array served by `GET /api/config/available-fields`
   ([routes/config.js](./backend/routes/config.js)). Nearly free to close.
2. **Collection gaps** — the data does not exist yet. Needs schema, API, and form work.
3. **Evidence gaps** — no field could ever prove it (process controls). Needs attestation.

---

## Phase 1 — Vocabulary exposure

`getFieldValue` reads directly off the application object and **already supports dot notation**
(the "future enhancement" comment in [services/policy.js](./backend/services/policy.js) is stale —
the code walks the path). Exposing an existing column is therefore a one-entry addition to the
field list, with no engine change.

Columns that exist today and are **not** in the 34-field vocabulary:

| Column | Unblocks |
|---|---|
| `metadataLastReviewed` | 4.6.6 — "reviewed at least every six (6) months" |
| `apiSecurityTool` | API security posture (no control yet, but the pair is orphaned) |
| `apiSecurityIntegrationLevel` | as above |

Relations, resolved on demand by `withEvaluableRelations` (see 2d):

| Path | Unblocks | Status |
|---|---|---|
| `threatModel.status`, `threatModel.lastReviewedAt` | 4.6.11 Threat modeling | exposed |
| `apiSchema` | 4.6.6 bullet 1 | exposed, deliberately unmapped |
| `ingressProducts`, `outgoingProductFlows`, `incomingProductFlows` | 4.6.6 bullet 1 | exposed, deliberately unmapped |
| findings / SLA data | 4.6.15, 6.3.11 | **not yet exposed** |

**Status: done.** 43 mappable fields, up from 34. Any relation added to `EVALUABLE_RELATIONS`
must also be listed here, or a mapping against it resolves to `null` forever — the same failure
mode as the `gitBranch` note above.

---

## Phase 2 — Evaluation engine enhancements

These are prerequisites, not parallel work. Scope is **`services/policy.js` (control evaluation)
only** — `services/scoring.js` (the 0–100 application score) is explicitly out of scope for now.

### 2a. Conditional applicability per control
Add an `appliesWhen` set of field checks, evaluated separately from the compliance checks. Without
it there is no way to express "N/A", so any conditionally-scoped control fails closed on every
application it does not apply to.

Blocks: **4.6.10** (internet-facing only), **6.3.13** (confidential data only).

`Policy` already has a `conditional` scope; `PolicyControl` has no equivalent.

### 2b. Additional result states
Evaluation is currently binary (`meeting` / `not_meeting`). Three more states are needed:

- **`verification_required`** — the control's automated checks pass, but they do not cover the
  whole requirement, so a human must confirm the rest. Driven by a new
  `PolicyControl.verificationRequired` flag: when set, all-checks-pass yields
  `verification_required` instead of `meeting`. Failing checks still yield `not_meeting`.
  An admin `PolicyControlOverride` promotes it to `meeting`, which is what records the human
  judgement. First consumer is 4.6.6 (Phase 3).
- **`not_applicable`** — the control does not apply to this application. Required for conditional
  scoping (2a) to be meaningful; without it a scoped-out control still counts as failing.
- **`attested`** — owner-asserted rather than measured (Phase 4).

Reporting should treat these distinctly. `verification_required` is *not* compliance, and rolling
it into `meeting` would defeat the point.

### 2c. Relative date operators
`PolicyControlField.value` holds static JSON, so a date threshold is correct on the day it is set
and wrong every day after. Add `within_days` (and/or `older_than_days`).

Blocks: **4.6.6** ("every six (6) months"), **4.6.10** ("scheduled re-scans"), and any future
scan-recency control.

### 2d. Relation loading — **done**
`withEvaluableRelations` in [services/policy.js](./backend/services/policy.js) loads the relations
a control's field paths reference, keyed off the path root so both `apiSchema` and
`threatModel.status` resolve. It returns the application untouched when no active control uses a
relation, so the dashboard's per-application loop takes no extra query until one is mapped.

Currently covers `threatModel`, `apiSchema`, `ingressProducts`, `outgoingProductFlows`,
`incomingProductFlows`. Findings, deployments and SCM repo still need adding when their controls
are mapped.

---

## Phase 3 — 4.6.6, all five bullets

The control enumerates five metadata requirements. The intent is to check **all five**, not a
subset. Current data availability:

| # | Requirement | Data today | Gap |
|---|---|---|---|
| 1 | Architecture documentation, complete and up to date | **not checked** | Relations exist (`apiSchema`, `ingressProducts`, `outgoingProductFlows`, `incomingProductFlows`) and are now exposed, but are deliberately **not** mapped — see below |
| 2 | Risk level (low/med/high), reviewed every 6 months | `businessCriticality` + `metadataLastReviewed` | Vocabulary (Phase 1) + `within_days` (Phase 2c) |
| 3 | SBOM records, generated for every production release | **partial** | See below |
| 4 | Release artifacts attached to scan evidence | **partial** | `Deployment` exists (environment, version, gitBranch, deployedBy) but has no scan-evidence link |
| 5 | Approved policy exceptions, with justification / compensating controls / owner / expiry | **none** | No model exists |

### On SBOM (bullet 3)

SCM integration does **not** currently produce SBOM records. `RepoDependency` stores a dependency
inventory per repo — ecosystem, name, version, source manifest, lockfile, OSV advisories — which is
the *raw material* of an SBOM, but differs in two ways that matter for this control:

- It is keyed `@@unique([githubRepoId, ecosystem, name])` and written **delete-all + recreate** on
  each sync (see `saveRepoDependencies` in [services/scm/index.js](./backend/services/scm/index.js)).
  It is a snapshot of current state with **no version history**.
- There is no relation between `RepoDependency` and `Deployment`, so "an SBOM **per production
  release**" cannot be answered.

Two options, in increasing order of fidelity:

- **(a)** Weaken the check to "dependency inventory exists for the linked repo" — satisfiable today
  via `ApplicationScmRepo → ScmRepo → RepoDependency`, but it does not match the control's text.
- **(b)** Snapshot dependencies against a `Deployment` at release time, producing an immutable
  per-release SBOM. Matches the control, and is the more useful artifact for audit regardless.

**Recommendation: (b).** Planned separately.

### Decision: keep 4.6.6 at two checks, flagged for verification

4.6.6 stays mapped to `businessCriticality exists` + `description exists`. The remaining three
requirements are **not** back-filled with proxies, because a proxy that reports `meeting` is worse
than an acknowledged gap.

Instead the control is flagged `verificationRequired`, so passing the automated checks yields
`verification_required` rather than `meeting` (see Phase 2b). That keeps the partial coverage
visible in the UI and in reporting instead of hiding it behind a green check.

On architecture documentation specifically: the docs workstream proposes that the threat model,
product ingress points, data flows, and the API schema *together* constitute the architecture
documentation the policy asks to be kept current. All four are now exposed as mappable fields
(Phase 1), so this is buildable. It is **not** mapped yet — presence of those records is not the
same as documentation being complete and current, which is exactly the judgement
`verification_required` is meant to surface to a human.

---

## Phase 4 — Attestation

For controls where no field could ever provide evidence. The owner asserts compliance, accepts
audit risk, and re-attests on a schedule.

Applies to: **4.6.12**, **6.3.2** (secure coding guidelines), **6.3.5** (no confidential prod
data in testing), **6.3.6** (default account removal), **6.3.8** (no back doors), **6.3.9**
(no clear-text passwords), **6.3.10** (no dev utilities in prod), and the at-rest half of
**6.3.13**.

### Why not reuse `PolicyControlOverride`

`PolicyControlOverride` is close in shape — `isCompliant`, linked note, `overriddenBy`,
`overriddenAt`, unique per application+control — but it is **admin-only** and **never expires**.

The semantics genuinely differ: an override is an admin saying "trust me, this is fine"; an
attestation is an application owner making a claim they must defend in an audit. Merging them makes
*"how much of our compliance is self-reported?"* unanswerable, which is the first question an
auditor asks. Use a separate `ControlAttestation` model.

### Model sketch

- self-service for the application owner (not `requireAdmin`)
- required statement / justification text
- **`expiresAt`** — annual re-attestation; expired attestations stop counting
- `allowsAttestation Boolean` on `PolicyControl`, so only appropriate controls can be attested
- evidence strings rendered distinctly: *"Attested by X on DATE, expires DATE — unverified"*
- portfolio metric splitting **measured vs attested** compliance

### Supporting evidence prompts

Attestation UI should tell the owner what proof they will need:

- **4.6.12 / 6.3.2** — prompt the team to email their secure coding guidelines to
  **VTM@hearst.com**. KnowBe4 training records are an additional signal here and could later be
  pulled to make this partly measured rather than fully attested.
- **6.3.5 / 6.3.6 / 6.3.8 / 6.3.9 / 6.3.10** — warn that proof will be requested at audit.

---

## Phase 5 — SCM-derived evidence

The provider layer already dispatches on `connection.provider`
([services/scm/index.js](./backend/services/scm/index.js) `getScmProvider`), so the host does not
need to be passed in — adding a method to the provider contract and implementing it per provider is
the extension point. Each of the three providers (`githubProvider`, `bitbucketProvider`,
`azureDevopsProvider`) exposes a uniform object; the results need normalizing into one shape since
the upstream APIs differ.

### 5a. Branch protection → 4.6.3 and 6.3.12

`repos.getBranchProtection` / rulesets give `required_approving_review_count`, dismiss-stale-reviews,
and whether admins are exempt. `>= 1 required approver` is direct, auditable evidence.

4.6.3 (App Sec, segregation of duties) and 6.3.12 (SDLC, pre-release code review) map to the same
signal. They live in **different policies**, so this is not double-weighting within one policy — the
source documents overlap. Both should map to it.

Note this covers **code review** segregation, not **deploy** segregation. Deploy-time separation
depends on the environments work (Phase 6).

### 5b. PR template → 4.6.7

`fetchFileText(octokit, owner, repo, path)` already exists in
[services/scm/githubProvider.js](./backend/services/scm/githubProvider.js). Check
`.github/PULL_REQUEST_TEMPLATE.md`, the lowercase variant, and `.github/PULL_REQUEST_TEMPLATE/`,
then match a security heading.

**This proves the template exists, not that anyone completes it.** Acceptable as v1; reading merged
PR bodies for completed checklists is a separate, later control. Do not treat one as the other.

---

## Phase 6 — New collection

### 6a. Security tool columns

Follow the existing `sast*` / `dast*` / `sca*` pattern:

| Field | Unblocks |
|---|---|
| `secretsScanTool`, `secretsScanIntegrationLevel`, `lastSecretsScanDate` | 4.6.9, 6.3.3 |
| `sastIncludesSecrets Boolean` | mirrors `sastIncludesSca`, for SAST tools that cover secrets |
| `iacContainerScanTool`, `iacContainerScanIntegrationLevel` | 4.6.14 — **one combined field**, since most tools (Snyk, Trivy, Wiz) cover both |

> **4.6.14 is a release gate, not just a tool.** The policy says IaC/container is scanned
> *"prior to deploying as a workload"*. A tool column answers "is a scanner configured", not
> "did it pass before this workload deployed" — the latter needs the scan tied to a `Deployment`,
> the same structural gap as per-release SBOM (Phase 3). The tool column is **partial coverage**
> of 4.6.14 and should be flagged `verificationRequired` until deployment-linked scan evidence
> exists. The baseline now treats SBOM and IaC/container as MUST rather than SHOULD, so both are
> required-but-not-fully-verifiable in the interim.

**6.3.3 (no hard-coded passwords)** is the requirement; secrets scanning is the control that
detects violations. Both map to the same fields.

GitHub secret scanning and push protection are queryable via API, so `secretsScanTool` could be
auto-populated for GitHub-linked repos rather than self-reported.

> **Drift risk:** [services/completeness.js](./backend/services/completeness.js) is a manual port of
> `frontend/src/utils/applicationCompleteness.js`. Any new field must be added to **both** or the
> dashboard and per-application completeness numbers diverge.

### 6b. Environments → 4.6.4

Environment separation is already planned separately. `deploymentEnvironment` is a single string
(primary environment) and is not sufficient. Revisit 4.6.4 when environments land.

### 6c. Encryption → 6.3.13

Split the control:

- **In transit** — measurable today. Domain snapshots (Puppeteer) and
  [services/domainDnsScoring.js](./backend/services/domainDnsScoring.js) can establish HTTPS
  enforcement, certificate validity, and HSTS for internet-facing domains.
- **At rest** — not externally observable → attestation (Phase 4).

Scope the whole control with `appliesWhen` on `dataTypes` so it only applies to applications
handling confidential data.

---

## Sequencing

1. **Phase 1** — vocabulary exposure (hours, no engine change)
2. **Phase 2** — conditional applicability, `not_applicable`, relative dates, relation loading (the unblocker)
3. **Phase 5** — branch protection + PR template (largest evidence gain, reuses existing SCM plumbing)
4. **Phase 4** — attestation model
5. **Phase 6** — new tool columns, environments, encryption split
6. **Phase 3** — per-release SBOM, then finish 4.6.6

## Projected coverage

| Stage | Mapped | Attested | Unmapped |
|---|---|---|---|
| Today | 9 | 0 | 19 |
| After Phases 1–2 | 11 | 0 | 17 |
| After Phase 5 | 14 | 0 | 14 |
| After Phase 4 | 14 | 8 | 6 |
| After Phase 6 | 19 | 8 | 1 |
| After Phase 3 | 20 | 8 | 0 |

Measured coverage ends at 20 of 28 with 8 honestly labelled as self-reported — rather than 28
controls silently failing closed.

## Activation checklist

Before flipping either policy to `isActive: true`:

- [ ] Every mapped control validated against real portfolio data (no `gitBranch`-style dead checks)
- [ ] `not_applicable` state shipped, so conditionally-scoped controls do not punish
- [ ] Unmapped controls either attestable or accepted as known-failing
- [ ] Portfolio scoring impact reviewed across all applications
