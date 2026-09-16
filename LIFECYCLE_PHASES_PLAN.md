# Lifecycle Phase Documentation Plan

Build out the six phases of the AppSec program lifecycle from a one-line table row each into six
real pages — what the work actually is, what each piece of work produces, and where that output
lands in Orbit.

[Program Overview](/docs/program-overview) already commits to this: *"Each phase will get its own
in-depth page over time."* [Policy Baseline](/docs/program-policy-baseline) already groups its MUST
controls under the same six phase names. So the shape is half-built — what's missing is the layer
between "here's a control you must meet" and "here's the work you do, and here's the artifact that
proves you did it."

This plan covers three things, in order:

1. **The six pages** — a repeatable page template, then the work items and outputs for each phase.
2. **Where Orbit stands today** — honestly, per phase, including what has no home at all.
3. **Where Orbit goes next** — a staged roadmap ending in the thing you actually want: every
   application sitting in a declared phase, with readiness computed from catalog data.

---

## The organizing idea: work item → output → evidence

The reason the current phase table doesn't help anyone is that it describes *states*, not *work*.
"Requirements, threat modeling, and architecture review happen before anything is built" tells a
team nothing about what to do Monday morning.

So every phase page is built from **work items**, and the rule for a work item is strict:

> A work item names a discrete piece of work, a role that does it, a trigger or cadence, and **one
> output that can be pointed at**. If it produces no output, it isn't a work item.

The output is what makes the lifecycle auditable and, eventually, automatable. It's also what ties
the docs to the tool: for each output there's exactly one answer to "where does this live?" — an
Orbit field, an Orbit tab, a repo file, a ticket, or (today, often) *nowhere yet*. That last answer
is the roadmap, and it's worth printing in the docs rather than hiding, because a customer reading
a phase page needs to know which outputs they're keeping in a wiki for now.

This also matters for the three-layer relationship the program already has:

| Layer | Question it answers | Where it lives |
|---|---|---|
| **Policy Baseline** | What is *required*? | [Policy Baseline](/docs/program-policy-baseline) |
| **Lifecycle phases** | How is it *done*, and what does it produce? | These six new pages |
| **SAMM** | How *consistently* does it happen? | [SAMM & Maturity](/docs/program-samm) |

Right now the middle layer is missing, which is why the baseline reads as a compliance checklist
rather than a way of working. These pages are the middle layer.

---

## Page template

Every phase page uses the same nine sections, in this order. Consistency matters more than
per-phase cleverness here — a developer who learns the shape on one page can skim the other five,
and a uniform shape is what lets the work-item tables eventually be generated from the same data
Orbit evaluates.

| Section | What goes in it |
|---|---|
| **1. Why this phase exists** | The specific risk this phase catches, and what it costs to catch it later instead. |
| **2. What triggers it** | Entry conditions — a new app, a high-impact change, every PR, every release, a schedule, a quarter. |
| **3. Who does the work** | Written as *your team does X, AppSec does Y*, since the split differs per phase (see the ownership gradient below). |
| **4. The work** | The core table — one row per work item, with its output — followed by the **templates**, each in a `<details>` block next to the item it belongs to. |
| **5. Where the outputs go** | Each output mapped to one home: an Orbit field or tab, a repo file, a ticket, another tool, or "no home yet." |
| **6. Done when** | A checkable list, written as assertions about artifacts rather than about effort, so a future per-phase readiness score can evaluate it. Continuous phases (2, 3, 5) get steady-state conditions instead. |
| **7. How tiers change this** | What High vs. Medium vs. Low actually changes here. |
| **8. How this maps to policy and maturity** | Two `h3` subsections: the baseline controls this phase satisfies, and the SAMM practices it's evidence for. |
| **9. What your security team sees** | A table of what's confirmable in Orbit when the phase is on plan, then **where they're blind and will have to ask you** (roadmap), then **what lives elsewhere by design** (boundary). |

Three notes on why it settled here:

- **Baseline and SAMM are one section, not two.** The page's "On this page" contents is built from
  `h2`/`h3` headings, and eleven top-level headings made the pages unskimmable.
- **Templates are inline, not a separate library.** They sit next to the work item that produces
  them, so a reader working down the page has the artifact in front of them rather than a link away.
- **Section 9 separates the roadmap from the boundary.** "Orbit doesn't do this yet" and "Orbit will
  never do this because another tool owns it" are different statements, and conflating them makes
  the product look unfinished where it's actually scoped. See the
  [scope boundary](#scope-boundary-orbit-does-not-hold-findings).

Section 8 wants reciprocal links added back from `program-policy-baseline.md` and `program-samm.md`,
so the three layers are navigable in both directions rather than only down.

### The ownership gradient

The pages aren't uniformly dev-facing, because the program isn't:

| Phase | Who drives it |
|---|---|
| **1 — Plan & Design** | Dev team **with** Hearst's AppSec team — threat model review, design review and tier confirmation are collaborative |
| **2–5** | Dev team executes the technical work; AppSec observes through Orbit |
| **6 — Improve & Govern** | Company AppSec/engineering lead with Hearst's AppSec team, quarterly. The one phase dev teams generally aren't watching — its page says so up front rather than pretending otherwise. |

### Slugs and nav placement

A new section in the existing `The AppSec Program` group in [platformDocs.js](backend/routes/platformDocs.js):

```
The AppSec Program
├── Program Foundations
│   ├── program-overview          Program Overview
│   ├── program-policy-baseline   Policy Baseline
│   ├── program-samm              SAMM & Maturity
│   └── program-glossary          Glossary
├── The Lifecycle                         ← new section
│   ├── program-lifecycle         The Lifecycle              (overview + how phases work)
│   ├── phase-plan-design         1. Plan & Design
│   ├── phase-build-commit        2. Build & Commit
│   ├── phase-ci-gate             3. CI Gate
│   ├── phase-release-deploy      4. Release & Deploy
│   ├── phase-runtime-operate     5. Runtime & Operate
│   └── phase-improve-govern      6. Improve & Govern
└── Community Programs
```

Two notes on this:

- **Slugs carry no phase number.** The ordinal lives in the nav title and the page's H1, not the
  URL, so renumbering or inserting a phase later doesn't break every inbound link and control
  reference. The `phase-` prefix keeps them grouped and unambiguous.
- **Use `children`, or a flat section?** The nav model already supports `children` for sub-pages of
  a long topic (as `applications` does). Making the six phases children of `program-lifecycle`
  renders them indented under it, which reads correctly — the six are genuinely sub-pages of one
  topic. Recommend children rather than seven flat siblings.

The lifecycle overview page (`program-lifecycle`) carries the material that shouldn't be repeated
six times: the phase diagram, the work-item→output model above, how entry/exit criteria work, how
tiers modulate everything, and the full cross-phase output inventory in one table. `program-overview.md`
then loses its "each phase will get its own page over time" line and links here instead.

---

## Phase 1 — Plan & Design

**Triggers:** a new application or service; a new high-impact change (auth, authorization, sensitive
data flows, trust boundaries, public exposure); a major architecture change; a new third-party
integration; an acquired or inherited application entering the catalog.

### Work items

| # | Work item | Who | Output |
|---|---|---|---|
| 1.1 | Register the application in the catalog | App owner / dev lead | Application record with owner, criticality, critical aspects, facing, data types, repo, hosting domains |
| 1.2 | Assign or confirm the risk tier | AppSec + app owner | Tier (High/Medium/Low), the rationale behind it, and the resulting review cadence |
| 1.3 | Define security requirements up front | Dev lead, AppSec consulted | A requirements list in the design doc or ticket: auth model, authorization model, sensitive data handling, trust boundaries, logging/audit, secrets handling, tenancy isolation |
| 1.4 | Classify data and map its flows | Dev lead | Data types on the record; ingress points and data flows on the parent product |
| 1.5 | Build the application-level threat model | Dev lead + AppSec | Threat model: scope, actors, data types, threats with STRIDE category, mitigation and status |
| 1.6 | Break out high-risk components | Dev lead | A threat-model component per high-risk area — authentication, payment, data storage, admin functions, integrations, file upload — each with its own threat list and review flag |
| 1.7 | Architecture / design review | AppSec team | Review notes, decisions recorded, and required mitigations converted into backlog tickets |
| 1.8 | Choose secure-by-default patterns | Dev lead | Named approved patterns in the design doc — SSO via Okta rather than hand-rolled auth, managed secret store, approved crypto, approved base images |
| 1.9 | Plan the tooling coverage | Dev lead | Which of SAST / secrets / SCA / DAST / WAF / API security will cover this app, at what integration level, recorded on the record *before* build rather than discovered after |
| 1.10 | Pre-file exceptions for controls that can't be met at launch | App owner → AppSec approves | An exception with business justification, compensating control, named owner, and expiry date |

### Tier differences

| | High | Medium | Low |
|---|---|---|---|
| Threat model | Required, **approved** before build; components for every high-risk area | Required, `in_review` acceptable | Required at whole-app level only |
| Design review | Live session with AppSec | Async review | Self-service, using the questions on this page |
| Requirements | Full checklist, documented per requirement | Checklist, summarized | Key items only |

### Exit criteria

- Application record exists, profile completeness at or above the threshold for its tier
- Risk tier assigned, with rationale on file
- Security requirements captured somewhere durable and linked from the record
- Threat model status at least `in_review` (`approved` for High tier), with a named reviewer
- A component exists for every high-risk area the app actually has
- Mitigations from the threat model exist as tickets, not just as text in the model
- Any control that can't be met at launch has an approved, unexpired exception

### In Orbit today

Genuinely strong here — the best-covered phase.

- **Application onboarding** — the split business/technical public forms, the in-app single form,
  and CSV bulk import all produce 1.1. Profile completeness % gives it a measure.
- **Threat model** — 1.5 and 1.6 are fully supported: the four-questions structure, per-component
  archetypes (`auth`, `payment`, `data_storage`, `integration`, `admin`, `file_upload`, `messaging`),
  STRIDE categories, per-threat mitigation and status, `draft`/`in_review`/`approved`/`superseded`
  status, reviewer and `lastReviewedAt`. **✨ Draft with AI** produces a first-pass draft. The
  auto-creation of a matching component when the whole-app answers indicate payment data or
  privileged users is exactly the right pattern and worth calling out on the page.
- **Product ingress points and data flows** — 1.4's flow mapping, with protocol, data
  classification, direction and API-key requirement per flow. Underused relative to how useful it
  is for design review; the phase page is the right place to finally explain *why* you'd fill it in.
- **Security tooling fields** — 1.9's plan can be recorded today, since the SAST/DAST/SCA/firewall/
  API-security fields exist from the moment the record does.
- **Notes / App Timeline** — 1.7's review notes have a home, though an admin-only one.

### Not yet in Orbit

- **Risk tier (1.2) does not exist.** No `riskTier` field anywhere in the schema. The *inputs* are
  all there — `businessCriticality`, `facing`, `dataTypes`, interface count, and scoring already
  derives an internal "importance" from exactly these — but it's never surfaced as a tier, never
  confirmable by a human, and never referenceable by a control. This blocks every severity
  threshold, review cadence and tier-dependent requirement in the baseline. **It is the single
  highest-leverage missing field in the product.**
- **Security requirements (1.3) have no home.** No structured requirements anywhere; they live in
  whatever design doc a team happens to keep.
- **Approved patterns (1.8) have no catalog.** The `products/*.md` docs cover vendor tools, not
  internal patterns.
- **Design review (1.7) has no workflow** — no request, no scheduling, no sign-off distinct from
  the threat model's reviewer field.
- **Exceptions (1.10) are not really modeled.** `PolicyControlOverride` is the closest thing and
  it's a different object: admin-only, boolean, optionally noted, with **no expiry, no compensating
  control, no owner, and no approval workflow** — while the baseline explicitly says "indefinite
  isn't valid."

---

## Phase 2 — Build & Commit

**Triggers:** continuous, from first commit until the application is decommissioned. Per-PR rather
than per-release.

### Work items

| # | Work item | Who | Output |
|---|---|---|---|
| 2.1 | Link the repository to the application record | Dev | Live repo link, detected languages and frameworks, dependency inventory pulled automatically |
| 2.2 | Adopt the PR security checklist | Dev lead | A PR template committed in the repo, and an answered checklist on each PR |
| 2.3 | Security review on pull requests | Reviewing dev, AppSec on escalation | Review approval with the checklist actually checked; an AppSec consult opened where the checklist flags one |
| 2.4 | Local and pre-commit hygiene | Dev | Secrets pre-commit hook configured, lockfiles committed, dependency bumps intentional |
| 2.5 | Secure coding onboarding for the repo | Dev, champion | Training completion per developer, early after joining a repo |
| 2.6 | Dependency hygiene pass | Dev | Advisory-flagged dependencies upgraded, or explicitly justified |
| 2.7 | Keep the catalog record honest as code changes | Dev | Version-history entries for language, framework, interfaces and domain changes |
| 2.8 | Update the threat model when a boundary moves | Dev lead | A revised threat model or new component, tied to the change that caused it |

### Exit criteria

This phase has no finish line — it's continuous — so its criteria are steady-state assertions:

- Repo linked and synced within the last 30 days
- A PR security checklist is present in the repo
- No advisory-flagged dependency is unaddressed and unjustified
- Catalog metadata matches reality (completeness at 100%, reviewed within cadence)
- The threat model's last review is no older than the last trust-boundary change

### In Orbit today

- **SCM integration** — 2.1 fully: GitHub, GitLab, Bitbucket, Azure DevOps, with language/framework
  detection, dependency manifest parsing across nine ecosystems, and OSV.dev advisory checks.
- **Dependencies page** — 2.6's portfolio view: "which of our applications uses this package,"
  searchable across the whole company rather than app-by-app.
- **Version history and change history** — 2.7, including whether a change came via UI or API.
- **Developer Dashboard** — surfaces the two actionable buckets for this phase: apps with no repo
  or tool link at all, and apps with a repo recorded but never synced.

### Not yet in Orbit

- **The PR checklist (2.2, 2.3) is a baseline MUST with zero product support.** No template to
  distribute, no per-app adoption flag, no way to tell whether reviewers check it. Notably,
  adoption here is *verifiable* rather than self-reportable — the SCM integration could detect
  `.github/PULL_REQUEST_TEMPLATE.md` and friends directly.
- **Pre-commit hygiene (2.4)** — nothing recorded.
- **Training (2.5)** — no completion tracking. The Champions program's content distribution is the
  adjacent machinery, and it already logs downloads per user and company.
- **Threat model staleness (2.8)** — `ThreatModel.version` is an integer that nothing increments
  meaningfully, and there's no "model is older than the last deployment" signal even though the
  scoring engine already computes exactly that shape of comparison for scan freshness.

---

## Phase 3 — CI Gate

**Triggers:** every pull request, and every build on the default branch.

This is the most automatable phase and the one where Orbit's current model — self-reported tool
name, integration level, and a last-scan date — is furthest from what the baseline actually asks
for, which is proof that a check ran against a specific commit.

### Work items

| # | Work item | Who | Output |
|---|---|---|---|
| 3.1 | Stand up static analysis (SAST) | Dev / platform | A pipeline job running on every PR and default-branch build; tool, integration level and last scan date on the record |
| 3.2 | Stand up secrets detection | Dev / platform | A job on every PR and build; a verified live secret fails the build outright; a documented revoke-and-rotate runbook |
| 3.3 | Stand up dependency scanning (SCA) | Dev / platform | A job on every PR and build, with vulnerable dependencies upgraded or justified |
| 3.4 | Stand up baseline dynamic testing (DAST) | Dev / platform | A scan against staging before first production release, then on a recurring schedule |
| 3.5 | Configure severity thresholds for the tier | Platform, AppSec sets the policy | Pipeline config that fails the build above the tier's threshold, with the threshold documented |
| 3.6 | Report the gate result back to Orbit | CI pipeline | A per-build gate result: commit, branch, which checks ran, counts by severity, pass/fail |
| 3.7 | Triage what the gate finds | Dev | A fix commit, a ticket, or an approved exception — never a silenced check |
| 3.8 | Scan containers and IaC *(SHOULD)* | Platform | A registry or pipeline gate on critical misconfigurations |
| 3.9 | Generate an SBOM per build *(SHOULD)* | Platform | SPDX or CycloneDX stored with the build artifact |

### Tier differences

Straight from the baseline: High tier runs the strictest severity gate, Medium blocks on
Critical/High, Low blocks on Critical only. **Regardless of tier, a verified live secret always
blocks a merge** — worth stating on the page in its own callout, since it's the one rule with no
tier escape hatch.

### Exit criteria

- SAST, secrets detection and SCA all run on PRs and the default branch
- Baseline DAST exists if the application is internet-facing
- Severity thresholds are configured to match the assigned tier
- The gate's result is reported back to Orbit for the commit that shipped
- No finding above threshold is outstanding without an approved exception

### In Orbit today

- **SAST, SCA, DAST tool fields** — tool name, integration level 0–4, and last-scan date for each,
  with the `sastIncludesSca` shortcut when one tool covers both.
- **Scan freshness scoring** — full credit when the last scan falls within a day of the most recent
  deployment in either direction, tapering off as the scan drifts from that window. This is
  conceptually the right instinct: it measures *whether scanning tracks shipping*, not whether a
  checkbox is ticked.
- **Policy controls** can be mapped to these fields and evaluated automatically, so "static analysis
  tool is set" is checkable today.
- **Deployment tokens** prove the pattern for 3.6 already works — a narrowly-scoped token, a
  generated `curl` command, a pipeline posting an event to Orbit. The machinery exists; it just
  only accepts deployment events.

### Not yet in Orbit

- **Secrets detection has no field at all.** It's a baseline MUST with the single hardest rule in
  the whole document (a verified live secret blocks the merge), and there is nowhere in the catalog
  to record that a team does it, let alone that it ran. This is the most conspicuous single gap in
  the data model relative to the policy.
- **Severity thresholds (3.5)** — nothing, and blocked on risk tier existing first.
- **Gate results (3.6)** — Orbit knows *that a team says they use Semgrep* and *roughly when it
  last ran*. It does not know that it ran on the commit that shipped. This is the difference
  between self-reported and verified, and it's the highest-value integration on the roadmap.
- **Finding-level data (3.7)** — out of scope, not a gap. See [Scope boundary](#scope-boundary-orbit-does-not-hold-findings): findings live in Wiz.
- **Container/IaC scanning (3.8)** and **build SBOM (3.9)** — no fields. Note that the Dependencies
  feature is *repo-manifest-derived*, which is a genuinely different artifact from a build-time
  SBOM; the page should say so plainly so nobody thinks 3.9 is already covered.

---

## Phase 4 — Release & Deploy

**Triggers:** a build becomes a release candidate; any promotion to production.

### Work items

| # | Work item | Who | Output |
|---|---|---|---|
| 4.1 | Attach security evidence to the release | CI pipeline / release manager | The SAST, secrets, SCA and (where applicable) DAST results for **the exact build that shipped**, attached to the release record |
| 4.2 | Report the deployment to Orbit | CI pipeline | A deployment entry: environment, version, git branch, deployed-by, notes |
| 4.3 | Release security sign-off | Release manager / app owner | A named approver confirming the gate passed, evidence is attached, and no exception has expired |
| 4.4 | Verify no exception has expired | Release manager | Expired exceptions re-approved, remediated, or removed — the pipeline is expected to block on them |
| 4.5 | Confirm config and secrets hygiene for the target environment | Platform | Secrets from a managed store, nothing in plaintext config, least-privilege deploy identity |
| 4.6 | Register any newly created exposure | Dev lead | New hosting domains, new product ingress points, and an updated API schema on file |
| 4.7 | Update the record's deployment state | CI pipeline | Current version, environment and branch reflected on the record |

### Exit criteria

- Evidence for the shipped build is attached to the release
- A deployment entry exists for the promotion, with version and environment
- A named human signed off
- No expired exception applies to the application
- Any new domain, ingress point or API surface is registered

### In Orbit today

- **Deployments** — 4.2 and 4.7 fully: manual logging, or automated via a deployment token with a
  generated, pre-filled `curl`/`wget` command. Filterable history by environment.
- **Deployment tokens** — correctly scoped down: a leaked one can at worst log a bogus deployment.
- **Domains** — 4.6's hosting-domain registration, with DNS and web-reachability history.
- **API schema** — 4.6's API surface: upload or paste OpenAPI/Swagger, and Orbit renders a
  security-oriented endpoint view with auth requirements and flagged sensitive fields.
- **Product ingress points** — 4.6's entry-point registration.

### Not yet in Orbit

- **Release evidence (4.1) is structurally impossible today.** Scan dates live on the *application*,
  not on a build. Nothing connects "the SAST run" to "version 2.1.4 that shipped on Tuesday." The
  baseline asks for evidence "tied to the specific build/version that shipped," and the data model
  can't express that sentence.
- **Sign-off (4.3)** — no approver, no timestamp, no record.
- **Exception expiry (4.4)** — overrides have no expiry to check, so this control is unenforceable.
- **Config/secrets hygiene (4.5)** — nothing recorded.

---

## Phase 5 — Runtime & Operate

**Triggers:** continuous once live, plus schedule-driven re-assessment. The phase most applications
spend most of their life in — and, in the current data model, the one most likely to go quiet.

### Work items

| # | Work item | Who | Output |
|---|---|---|---|
| 5.1 | Scheduled re-scanning, independent of release cadence | AppSec / platform | A recurring scan on the tier's cadence and a refreshed scan date — because exposure changes even when the code doesn't |
| 5.2 | Monitor external exposure | AppSec | DNS and web-reachability snapshots, with changes flagged |
| 5.3 | Monitor cloud and infrastructure posture | Platform / AppSec | Findings from Wiz or Tenable correlated back to the catalog record via its tag |
| 5.4 | Triage findings to closure | Dev, app owner accountable | A ticket within a couple of business days for blocker/high findings, worked from Wiz as the source. Fix-by intervals to be defined by AppSec. |
| 5.5 | Watch dependencies and advisories | Dev | Repo re-synced, advisories re-checked, affected packages upgraded |
| 5.6 | Keep incident response ready | App owner | A current runbook, current contacts, and a tabletop exercise on record |
| 5.7 | Periodic metadata review | AppSec team | A review entry confirming the record is still accurate |
| 5.8 | Re-tier after material change | AppSec + app owner | A re-confirmed tier, and an updated review cadence if it moved |
| 5.9 | Decommission cleanly at end of life | App owner | Record retired, domains released, tokens revoked, repo link removed, data disposition recorded |

### Exit criteria

Steady-state assertions rather than a finish line:

- Last DAST scan within the tier's cadence for internet-facing apps
- Repo synced within 30 days
- Blocker and high findings have a ticket, an owner, and a date
- Metadata reviewed within the tier's review cadence
- Tier re-confirmed within its own cadence, or after the last material change

### In Orbit today

- **Domain monitoring** — 5.2 is a real, working feature: DNS snapshots, change detection between
  snapshots, and web-reachability snapshots over time.
- **Tool links** — 5.3's correlation: a Tenable or Wiz tag linked per application or per company,
  with CSV export jobs to pull findings out.
- **Dependency re-sync and OSV re-check** — 5.5, plus the Program Operations dashboard's
  **stale integrations** tile for repos not synced in 30 days.
- **Metadata review** — 5.7, with real teeth: review freshness is worth 10 points of the score and
  decays linearly to zero over six months, and "never reviewed" scores zero. The Program Operations
  dashboard lists applications never reviewed.
- **Scan date fields** — 5.1's *result* can be recorded, even though the schedule can't.

### Not yet in Orbit

- **Re-scan cadence (5.1)** — a scan date exists, but no expected cadence and therefore no "overdue"
  state. Without a tier there's nothing to derive the cadence from either.
- **Findings and SLAs (5.4)** — out of scope, not a gap. See [Scope boundary](#scope-boundary-orbit-does-not-hold-findings).
- **Incident response readiness (5.6)** — only contacts exist; no runbook link, no exercise record.
- **Re-tiering (5.8)** — blocked on tiers existing.
- **Decommissioning (5.9)** — `Application.status` has only `pending_executive`, `pending_technical`
  and `onboarded`. There is no retired state, so a decommissioned application either lingers as
  "onboarded" and quietly drags down every coverage percentage, or gets deleted and takes its
  history with it. (`Product.status` does have `Retired` — the asymmetry is worth fixing.)

---

## Phase 6 — Improve & Govern

**Triggers:** cadence, not code. Quarterly for assessment and portfolio review, monthly for
champions content, continuous for metrics. This is the phase that feeds the other five.

### Work items

| # | Work item | Who | Output |
|---|---|---|---|
| 6.1 | Complete a SAMM self-assessment | Company lead + AppSec | 15 practices scored 0–3 from real evidence, submitted and locked for review |
| 6.2 | Set target maturity and prioritize gaps | Company lead + AppSec | A target level per practice based on risk, and an improvement plan with an owner and a done-condition per gap |
| 6.3 | Review portfolio posture | AppSec + leadership | A read-out from the Executive and Program Operations dashboards, with decisions recorded |
| 6.4 | Review policy compliance and clean up exceptions | AppSec | Overrides re-justified or removed, expired exceptions closed out, control field mappings corrected |
| 6.5 | Tune tooling and cut false positives | Platform + AppSec | Ruleset changes and baselines, so the gate stays trusted rather than routinely bypassed |
| 6.6 | Report program metrics | AppSec | Coverage %, compliance %, average score and maturity trend from Orbit; remediation metrics from Wiz |
| 6.7 | Run the champions cadence | Company champion lead | A monthly meeting run from the supplied package, with materials distributed |
| 6.8 | Attend and contribute to ASCOE | Anyone | Cross-company lessons shared, session materials distributed |
| 6.9 | Revise the baseline | Hearst AppSec team | An updated set of controls with a changelog, and SHOULDs promoted to MUSTs as adoption matures |
| 6.10 | Feed changes back into phases 1–5 | Hearst AppSec team | Updated phase pages, PR template, thresholds and requirement checklists |

### Exit criteria

- A SAMM assessment completed within the last 12 months (quarterly re-score preferred)
- A target level set per practice, with owners on the prioritized gaps
- No policy override older than its review period without re-justification
- Metrics published for the period
- Any baseline change propagated into the affected phase pages

### In Orbit today

- **SAMM assessments** — 6.1 fully: SAMM v2.0, five functions, 15 practices, two questions each,
  autosaving draft, one in-progress assessment per company, locked on submission, then admin review.
- **Four role-based dashboards** — 6.3 and much of 6.6: Executive (coverage, compliance rollup,
  maturity summary, high/low scorers, average score), Program Operations (coverage, governance,
  never-reviewed, stale integrations, missing metadata), Application Owner, and Developer.
- **Policies and controls** — 6.4 and 6.9's mechanism: controls are editable, field-mapped, and
  re-evaluated automatically across every in-scope application.
- **Program Content** — 6.7 and 6.8's distribution, including per-asset download records tied to
  user and company. That download telemetry is the only *adoption* measurement in the product today
  and is a useful template for measuring anything else.
- **Product updates / What's New** — 6.9's announcement channel.

### Not yet in Orbit

- **Target maturity and improvement plans (6.2)** — the assessment captures where you are and says
  nothing about where you're going. [SAMM & Maturity](/docs/program-samm) describes a four-step
  improvement cycle (baseline → target → prioritize → revisit quarterly) and Orbit implements
  step one.
- **Maturity trend (6.6)** — assessments are stored per-company but there's no delta view across
  them, so "are we improving" needs a spreadsheet.
- **Remediation timeliness (6.6)** — comes from Wiz, read alongside Orbit's numbers. Not an Orbit gap.
- **Exception review queue (6.4)** — no expiry, so nothing surfaces for review.
- **Tool tuning (6.5)** — out of scope for Orbit; the page should say so rather than imply a gap.

---

## Cross-phase output inventory

The lifecycle overview page carries this table — it's the fastest way for a reader to see what the
program actually asks them to produce, and it doubles as the roadmap's backlog. "Home" is where the
output lives today.

| Output | Phase | Home today |
|---|---|---|
| Application catalog record | 1 | **Orbit** — Applications |
| Risk tier + rationale | 1 | *Nowhere* |
| Security requirements list | 1 | *Nowhere* |
| Data classification | 1 | **Orbit** — data types |
| Data-flow map | 1 | **Orbit** — product ingress points & data flows |
| Threat model + components | 1 | **Orbit** — Threat Model tab |
| Design review notes | 1 | **Orbit** — Notes (admin-only) |
| Approved patterns used | 1 | *Nowhere* |
| Tooling coverage plan | 1 | **Orbit** — security tool fields |
| Repo link + dependency inventory | 2 | **Orbit** — Integrations, Dependencies |
| PR security checklist | 2 | *Nowhere* (repo file, unverified) |
| Training completion | 2 | *Nowhere* |
| Metadata change history | 2 | **Orbit** — version & change history |
| SAST / SCA / DAST job + scan date | 3 | **Orbit** — tool fields (self-reported) |
| Secrets detection | 3 | *Nowhere* |
| Severity threshold config | 3 | *Nowhere* |
| Per-build gate result | 3 | *Nowhere* |
| Container / IaC scan | 3 | *Nowhere* |
| Build SBOM | 3 | *Nowhere* (repo-manifest SBOM exists, which is a different artifact) |
| Release evidence bundle | 4 | *Nowhere* |
| Deployment event | 4 | **Orbit** — Deployments |
| Release sign-off | 4 | *Nowhere* |
| New domain / ingress / API schema | 4 | **Orbit** — Domains, ingress points, API Schema |
| Scheduled re-scan | 5 | Partial — date only, no cadence |
| DNS / web exposure snapshots | 5 | **Orbit** — Domains |
| Cloud posture findings | 5 | **Wiz** (by design) — tag-linked to Orbit, with CSV export |
| Finding + remediation status | 5 | **Wiz** (by design) — never an Orbit object |
| IR runbook + exercise | 5 | *Nowhere* |
| Metadata review | 5 | **Orbit** — review history, scored |
| Decommission record | 5 | *Nowhere* |
| SAMM assessment | 6 | **Orbit** — SAMM Assessments |
| Maturity targets + improvement plan | 6 | *Nowhere* |
| Exception (with expiry) | 1,3,4,5 | Partial — override, no expiry/owner/compensating control |
| Program metrics | 6 | **Orbit** — dashboards; remediation metrics from Wiz |
| Champions / ASCOE materials | 6 | **Orbit** — Program Content, with download telemetry |

Counted up: of 34 outputs, **16 have a real home in Orbit today, 2 belong to Wiz by design, and the
rest are split between the team's own repo/tracker and genuine roadmap gaps.** That ratio is the
honest summary of where the tool sits against the program it describes — and it's a good one for
something that started as a metadata catalog.

---

## Orbit roadmap

Staged so each stage is independently shippable and each one unblocks the next. Stage 1 is the docs
work you asked for; it deliberately requires no schema change, so it can land now and be correct.

### Stage 1 — Ship the pages (no schema change)

1. Seven new files in `backend/docs/platform/`: `program-lifecycle.md` plus the six `phase-*.md`.
2. New `The Lifecycle` section in `DOC_GROUPS` in [platformDocs.js](backend/routes/platformDocs.js),
   with the six phases as `children` of `program-lifecycle`.
3. Rewrite the phase table in `program-overview.md` to link each row to its page, and drop the
   "each phase will get its own in-depth page over time" line.
4. Add reciprocal links: each baseline control group links to its phase page; each SAMM practice
   row links to the phase that produces its evidence.
5. Add `program-lifecycle` and the six phase slugs to the `appsec-program` entry's `docPage` array
   in [programInfoRequests.js:27](backend/routes/programInfoRequests.js:27), so a visitor reading a
   phase page gets the right program pre-selected in the Request Info modal.
6. Glossary additions: *lifecycle phase*, *entry/exit criteria*, *work item*, *gate result*,
   *release evidence*, *re-tier*, *decommission*.
7. Author only in `backend/docs/platform/` — not the legacy `frontend/docs/` + `frontend/public/docs/`
   duplicate pair, which these pages shouldn't extend.

**Authoring constraints**, from the note at the top of `platformDocs.js` and the style of the
existing program pages:

- Cross-links are app routes (`/docs/phase-ci-gate`), never relative filenames.
- Second person, "what it means for you" — match `program-policy-baseline.md`, which is the closest
  existing page in tone and the one these six sit beside.
- Long detail goes in `<details><summary>` blocks; the skimmable version stays above them. A phase
  page should be readable in 90 seconds and complete in ten minutes.
- Say plainly where something has no home yet, **and where to keep that output meanwhile**. A
  customer who can't find a feature the docs imply loses trust in both.
- **Land one phase at a time, safely.** A slug registered in `DOC_GROUPS` without a matching file
  returns a 500, so a phase gets registered only as its file lands — and sibling pages don't link
  to a phase page that doesn't exist yet, so no customer ever hits a dead link mid-rollout. The
  overview's phase table carries unlinked bold text for the phases still being written, and each
  one becomes a link when it ships.

### Stage 2 — The two missing primitives

Small schema, disproportionate unlock. Nothing else on this roadmap works without these.

**`Application.riskTier`** — `high` | `medium` | `low`, plus `riskTierRationale`,
`riskTierSetAt`, `riskTierSetBy`, and `reviewCadenceDays`.

The design that fits this codebase: **suggest, then confirm.** Orbit already derives an internal
"importance" from `businessCriticality`, `facing`, `dataTypes` and interface count inside the
scoring engine, and already defaults missing data to the higher-risk answer so blank fields never
buy an easier grade. Reuse that exact logic to *propose* a tier, then require a human to confirm it
with a rationale — same shape as the threat model's AI draft, which generates and then asks you to
accept. An inferred-only tier would be rejected by the teams it governs; a hand-entered-only tier
would never get filled in.

Once it exists: severity thresholds, review cadences, tier-dependent threat-model requirements,
re-scan schedules and design-review depth all become expressible, and roughly a third of the
baseline stops being aspirational.

**`Application.lifecyclePhase`** — `1`–`6`, plus `phaseEnteredAt`.

Deliberately a **declared** value, not an inferred one. Do not auto-advance applications: a team
that finds its app silently moved to "Runtime & Operate" learns that the phase means nothing.
Instead, pair the declared phase with **computed readiness** — evaluate each phase's exit criteria
(section 6 of every page, written as data assertions precisely so this is possible) against catalog
data and show a per-phase readiness percentage with the specific unmet criteria listed.

That combination is the thing you described wanting: the declared phase says where a team thinks it
is, readiness says whether the evidence agrees, and the gap between them is the conversation. It
also reuses the pattern already proven by the policy-compliance tab, which shows exactly which
field drove each pass or fail.

**One naming conflict to resolve:** `Product.lifecycleStage` is free-text today, with "Build,
Launch, Operate" as the documented examples. That will read as the same concept as the six phases
and isn't. Either align it to the phase vocabulary or rename it (`deliveryStage`) — but don't ship
`Application.lifecyclePhase` alongside an unrelated `Product.lifecycleStage`.

### Stage 3 — Verified evidence in the CI and release path

This is where the model shifts from *self-reported* to *verified*, and it's the highest-value stage
after the primitives.

**Fill the tooling gaps.** Add secrets detection (tool, integration level, last scan date) — it's a
baseline MUST with no field. Add container scanning and IaC scanning, currently SHOULDs that the
baseline expects to promote. Caveat: these categories will want to enter the score, and changing
scoring changes every customer's number retroactively. Version the scoring config and ship a
preview of the delta before it counts, rather than surprising people with a Monday-morning drop.

**Gate result ingestion.** A `GateResult` model — application, commit SHA, branch, build URL,
per-check status and severity counts, threshold profile applied, overall pass/fail, timestamp —
posted from CI with a scoped token. The `DeploymentToken` pattern is already exactly right for
this: narrow scope, generated `curl`, worst case a bogus row. This single addition changes what
Orbit can assert from "the team says they use Semgrep and it ran sometime last week" to "SAST ran
on the commit that shipped and passed the threshold for this tier." Every CI-gate control becomes
automatically evaluable instead of override-dependent.

**Release evidence and sign-off.** Link a release (extend `Deployment`, or add a `Release` above it)
to the `GateResult` for its build plus an SBOM artifact, and add an approver, timestamp and note.
"Security evidence attached to every release" then becomes a query rather than a promise.

**Real exceptions.** Promote the concept out of `PolicyControlOverride` into an `Exception` with
justification, compensating control, owner, approver, expiry and status — the baseline's own list
of requirements. Keep the existing override for its actual job, the control that can't be evaluated
automatically. Then add the expiring-soon queue, the release-time block on expired exceptions, and
a dashboard tile. Today the baseline says "indefinite isn't valid" and the data model only supports
indefinite.

### Stage 3.5 — Guided tool setup, and basic open-source checks

Two related capabilities that both attack the same problem: a team knows it needs SAST and has no
idea which tool, so nothing happens.

**Guided tool setup.** Per tool category — SAST, secrets, SCA, DAST, application firewall, API
security — offer a short curated list of the most common tools, and for each one a setup guide that
ends in Orbit integration: how to stand it up, how to configure it for the category's baseline
control, and how to report its results back so the catalog reflects it.

**These get written from scratch.** `docs/products/*.md` holds four files today — Snyk, Tenable WAS,
Fastly NGWAF, Traceable — and each is **five lines**: YAML frontmatter plus one sentence of vendor
blurb ("Snyk is a developer-first security platform…"). There are no setup steps, no Orbit
integration, and the register is marketing copy rather than the second-person instructional voice
the platform docs use. Nothing there is worth carrying forward except the four tool names, and they
live in the legacy `frontend/docs` set rather than the platform docs anyway.

What they need to become is a **playbook**, not a description — the same shape as the templates in
the phase pages:

| A description says | A playbook says |
|---|---|
| "Snyk provides SAST and SCA scanning in your workflow" | "1. Ask AppSec to add your org. 2. Add this job to your pipeline. 3. Set the severity threshold to match your tier. 4. Confirm it fails a build. 5. Record the tool and integration level on the Security tab." |

Each guide should end the same way every phase-page template does: with the step that makes the work
visible in Orbit. A setup guide that stops at "now it's running" leaves the catalog exactly as
uninformed as before.

**Two permanent paths, not a migration.** Alongside the playbooks, build guided integration into
Orbit itself: **linking a repository prompts the user to choose their security tools**, and Orbit
then either configures the integration directly or **opens a pull request against the repository**
with the pipeline changes, for the team to review and merge like any other PR.

These are co-equal options, and the choice belongs to the company:

| | Guided integration | Playbook |
|---|---|---|
| Requires | Write access to the repository | Nothing new |
| Tool choice | Curated list per category | Anything |
| Coverage data | Populated from the integration | Recorded by the team |
| Gate results | Wired up automatically | Team wires it, if at all |
| Suits | Teams who want it running quickly on standard tooling | Teams with specific pipeline requirements, CI outside the connected repo, or a policy against granting write access |

Nothing pushes a company from the second column to the first. A team that reads the playbook, sets
up Semgrep themselves, and records it on the Security tab has fully met the control — the guided
path is a convenience, not a higher tier of compliance, and the docs should never imply otherwise.

Where guided integration *is* chosen, it's a considerably better mechanism than documentation, for
three reasons worth being explicit about:

- **It meets the team where the work is.** A PR in their own repository, reviewed by their own
  process, is a far shorter path than a doc page someone has to find, read, and translate into
  their CI syntax.
- **It makes adoption measurable rather than self-reported.** Orbit opened the PR, so Orbit knows
  whether it was merged. That's the same "verified over self-reported" principle as detecting the
  PR template from the linked repo — and it's a much stronger signal than a tool-name field.
- **It closes the gate-result loop in the same move.** The pipeline config Orbit writes can include
  the step that posts the gate result back to Orbit. The integration that stands the check up is
  also the integration that reports it, so Stage 3's `GateResult` arrives as a side effect of
  onboarding rather than as a separate thing every team has to be persuaded to wire up.

Sequencing note: guided integration depends on write access to the repository through the existing
SCM integration, which today is read-only (languages, frameworks, manifests). Opening a PR is a
meaningfully larger permission ask than reading a manifest, so expect the OAuth scope conversation
to be part of this work rather than an afterthought. It's also the clearest reason the playbook path
has to be permanent: some companies won't grant that access, and that has to be a legitimate way to
run the program rather than a shortfall.

The natural product surface for both is the application's Security tab: next to each empty tool
field, "pick one" — then either the guided integration or the playbook, with the field and
integration level populating from the integration in the first case and recorded by hand in the
second. Either way it makes tool choice a two-minute decision instead of a procurement
conversation.

The phase-3 page already presents this as a two-column choice with the trade-offs stated, and says
the rest of the page applies either way — you **verify** the gate configuration checklist if Orbit
built it, and **assemble** it if you did.

Worth being deliberate about one interaction with scoring: `toolQuality` already grades fully
managed tools at full credit, approved-but-unmanaged (Dependabot, GitHub Advanced Security) slightly
lower, and anything else at 80%. If the curated list includes open-source options, a team that
follows the guide should understand where that lands them — using Semgrep is enormously better than
nothing and still caps below a managed tool. Say so in the guide rather than letting them discover
it in their score.

**Basic open-source checks — documented, not run by Orbit.** The rudimentary end of the same idea:
Semgrep for SAST, OWASP ZAP for DAST, Gitleaks for secrets, Trivy for containers and SCA. Each gets
a playbook; the team runs it in their own pipeline and records the result in Orbit.

Orbit does **not** execute these. That's settled, and it follows from the scope boundary below — a
tool that runs scans owns findings, and findings are Wiz's job. Keeping execution out means these
guides stay content, which is why this stage is cheap.

**Who this is really for.** Per your note: the teams starting from literally zero are largely the
vibe-coded applications, which is the **Building Securely** track below rather than this one. A
company inside the program usually has *something*, and their gap is configuration rather than
absence. So the guided-setup work serves the program track, the zero-to-one content serves the
beginner track, and the two should point at each other rather than duplicating.

### Stage 4 — Requirements and design artifacts get a home

- **Security requirements checklist per application**, generated from tier + data types + the
  threat-model component archetypes the app already declares — an ASVS-subset rather than a blank
  text box. Structured items with status, so phase 1 exit criteria can check them and SAMM's
  Requirements-driven Testing practice has evidence.
- **Approved patterns catalog**, following the `docs/products/*.md` pattern that already works for
  vendor tools, plus a per-app record of which patterns it adopted.
- **PR checklist as distributed content**, through the Program Content machinery that already
  handles distribution and download telemetry — then verify adoption through the SCM integration by
  detecting the template file in the repo. Verified beats self-reported, and here it's free.
- **Threat model staleness** — flag when the model's last review predates the last trust-boundary
  change or the last deployment, reusing the scan-freshness comparison the scoring engine already
  performs.

### Scope boundary: Orbit does not hold findings

Worth stating plainly, because an earlier draft of this plan got it wrong and it changes several
things above.

**Wiz is the system of record for vulnerability findings.** Orbit tracks whether an application's
checks are *configured and running* — which tools, at what integration depth, how recently, against
what policy — not what those checks output. Individual findings, their severity, their age, and
their remediation status stay in Wiz and in the team's ticket tracker, correlated to the catalog
record by tag.

Consequences, all of them simplifying:

- **No finding ingestion, no SLA clock, no aging views, no mean-time-to-remediate in Orbit.** What
  was drafted as "the largest build on the roadmap" is now out of scope entirely. Remediation
  metrics for the quarterly review come from Wiz, read alongside Orbit's coverage and compliance
  numbers.
- **Orbit never executes scans**, which is what keeps the tool-setup guides above cheap.
- **The phase pages say this explicitly.** Each one's closing section now separates *"where Orbit
  is blind and will have to ask you"* (roadmap) from *"what lives elsewhere by design"* (boundary).
  A reader who can't find findings in Orbit should understand that as intent, not as an
  unfinished feature — otherwise they go looking, don't find it, and trust the rest of the page less.
- **SLA intervals are deferred.** The phase-5 page states the baseline's couple-of-business-days
  ticketing expectation as the firm part and says fix-by intervals by severity and tier are being
  defined. No invented day counts anywhere; drop them in when they're set.

The one thing still worth building here is **evidence that the checks ran** — the gate result in
Stage 3 — which is a different object from a finding. A gate result says "SAST ran on commit
`abc123` and passed the High-tier threshold." A finding says "here is CVE-2024-1234 in your
dependency tree." Orbit wants the first and not the second.

### Stage 5 — Closing the loop

- **Re-scan cadence and overdue flags**, derived from tier.
- **SAMM improvement plans** — target level per practice, owner, due date, linked evidence — plus a
  quarter-over-quarter delta view, completing the improvement cycle `program-samm.md` already
  describes.
- **Lifecycle phase telemetry** — the monitoring you're ultimately after: distribution of
  applications across phases per company, time spent in each phase, and which exit criteria block
  most often. That last metric is the useful one: it tells the program where its own process is too
  hard, not just which teams are behind.
- **Retirement** — a `retired` status plus a decommission checklist, so end-of-life applications
  stop distorting coverage percentages.

### Design principles worth holding to

1. **No work item without an output.** If nothing is produced, it can't be evidenced, measured, or
   improved — and it doesn't belong on a phase page.
2. **Prefer verified over self-reported.** A gate result on a commit beats a checkbox. A
   repo-detected PR template beats a boolean. Where the integration can check it, don't ask.
3. **Declare the phase, compute the readiness.** Never auto-advance an application. The gap between
   claim and evidence is the signal.
4. **Tier before thresholds.** Nothing severity- or cadence-dependent can be built first.
5. **Don't move scores silently.** New scored categories land behind a versioned scoring config
   with a preview of the delta.
6. **One identifier across all three layers.** A phase page slug, a baseline control's phase
   grouping, and a work item ID should reference each other directly, so
   `phase-ci-gate#secrets-detection` is a link a control can carry.
7. **Write the gaps down.** Every phase page ends with what Orbit doesn't do yet. It's more useful
   than a complete-looking page, and it keeps the docs honest as the roadmap moves.

---

## A second track: building and shipping securely for beginners

A lot of people across the companies are vibe coding applications — building with an AI agent, often
without a platform team, a pipeline, or an engineering background. They need beginner-friendly
guidance on building, deploying, and running a web application safely, and they need it in a form
**their agent can consume as well as they can**.

This rides along with the lifecycle documentation, but it is emphatically **not** a seventh phase
page, and it shouldn't be interleaved into the six.

### Why it has to be separate

The six phase pages assume a development team with a repository, a pipeline, and a release process.
This audience has none of those. Someone deploying a Next.js app to Vercel from a Claude Code
session doesn't have a CI gate to configure or a release sign-off to record — and handing them a
page that opens with severity thresholds per risk tier guarantees they close the tab.

The failure mode to design against is *bureaucratic-feeling security docs that get ignored*, which
is worse than no docs, because the reader concludes the whole program isn't for them. So the
mapping back to the six phases should be exactly one light "here's how this grows up" note, not
phase scaffolding on every page.

### Start lower than feels necessary

My first draft of this section aimed at someone already on a modern hosting stack and listed traps
like "Supabase or Firebase with row-level security never enabled." That was pitched too high. Per
your note, this audience needs the layer underneath that: **what a deployment actually is, what a
server is, what it means to expose something to the world versus keep it internal.** Someone who
doesn't know what a port is cannot act on advice about row-level security, and a page that assumes
they do teaches them that these docs aren't for them.

So the track starts at concepts, not at traps. The traps matter, but they're the third section, not
the first.

**Concepts — what is actually happening**

Someone who has only ever run `npm run dev` has no model of any of this, and every security decision
later depends on having one:

- Your laptop versus a computer somewhere else — what "deploying" means, and what changes when you do
- What a server is, and what it means for a program to "listen" on a port
- **Who can reach it**: localhost, your own network, your company's internal network, the public
  internet — the single most important distinction on this track
- How a domain name finds your server, and what DNS is doing
- What HTTPS protects, and what it doesn't
- Where your data physically lives once it isn't on your laptop

**Decisions — the choices you'll be asked to make**

Each of these is a fork where the secure option and the convenient option differ, and where the
reader currently has no basis to choose:

- Where to run it: managed hosting, a virtual machine you administer, or your own machine — with the
  security trade-off of each stated plainly (a VM you rent is a computer *you* are now responsible
  for patching; managed hosting takes that away from you)
- **Internal-only or open to the world**, and how to actually enforce the answer
- Whether it needs logins at all, and using a provider rather than building one
- Where configuration and secrets live, once "in the code" stops being acceptable
- What happens to your data: backups, and who can read it

**Traps — the specific ways this goes wrong**

Now the framework-specific material earns its place, ordered by how often it causes a real incident:

1. **Secrets in the wrong place.** A `.env` committed to a public repo. An API key in frontend code
   that ships to every visitor's browser — the reader needs to understand that "frontend" means
   "downloaded by anyone," which is itself a concept from the first section.
2. **A database anyone can read.** Managed database services are commonly set up with a key that
   the browser holds and no per-row restrictions, so one request reads every row. The application
   behaves identically either way, which is exactly why it ships.
3. **Hand-rolled logins.** Passwords in a table, sessions invented from scratch.
4. **No ownership checks.** Login works; nothing verifies the logged-in user owns the record they
   just asked for by changing a number in the URL.
5. **Unvalidated input reaching something dangerous** — a database query, a shell command, a page
   render, a file path.
6. **Accidentally public.** A tunnel left running, a preview URL indexed by Google, an admin page
   with no login, debug mode left on.

**This is the real "starting from zero" audience.** A company inside the program usually has some
tooling and needs it configured properly. A vibe-coded application has nothing, and its author
doesn't know the categories exist — or, more fundamentally, doesn't yet know what putting something
on the internet involves. So the zero-to-one content belongs here, with the program's
[guided tool setup](#stage-35--guided-tool-setup-and-basic-open-source-checks) as the grown-up
version. Both should exist and point at each other rather than repeat.

### Proposed shape

A **third top-level doc group**, alongside `Using Orbit` and `The AppSec Program`:

```
Building Securely                        ← new group
├── Start Here
│   ├── secure-build-start         Start Here: What You're About to Do
│   └── secure-build-agent         Working with Your AI Agent
├── Understanding What You're Building
│   ├── secure-build-deploying     What "Deploying" Actually Means
│   ├── secure-build-servers       Servers, Ports & Listening
│   ├── secure-build-who-can-reach Who Can Reach It: Local, Internal, Public
│   └── secure-build-domains       Domains, DNS & HTTPS
├── Decisions You'll Have to Make
│   ├── secure-build-where-to-run  Where to Run It
│   ├── secure-build-exposure      Internal-Only or Open to the World
│   ├── secure-build-logins        Logins & Who Can Do What
│   ├── secure-build-secrets       Keys, Secrets & Configuration
│   └── secure-build-data          Your Data: Where It Lives, Who Can Read It
└── Before You Share It
    ├── secure-build-local         Running & Demoing It Safely
    └── secure-build-prelaunch     Pre-Launch Checklist
```

Thirteen pages, but each one is short — this audience is served better by one idea per page than by
five comprehensive pages they bounce off. Sequence matters more than usual here: the "Decisions"
section is unreadable without the "Understanding" section, so they should land in order.

**Register.** Second person, short sentences, no unexplained jargon, and every term defined the
first time it appears. The tone to aim for is a patient colleague, not a specification. Worth
testing a draft on someone who has genuinely never deployed anything — the failure mode is invisible
to whoever wrote it.

Two implementation notes for this group:

- `GROUP_ACCENTS` in [Docs.jsx](frontend/src/pages/Docs.jsx) is keyed by group title and falls back
  to the `Using Orbit` blue. A third group needs its own accent entry, or it'll be visually
  indistinguishable from the Orbit documentation.
- **The platform docs API requires no authentication.** A real advantage here: this track can be
  linked to anyone in any Hearst company without an Orbit account, which matters because the people
  who most need it are the ones not yet in the program.

### The agent rules file

The highest-leverage piece, and the one that most directly answers "work with their agents to
reference it": a **rules file the reader drops into their project**, which their coding agent then
reads on every session.

This inverts the adoption problem. Documentation requires someone to remember to read it; a rules
file in the repo means the agent applies the guidance whether or not the human remembers it exists.

It needs to be written *for a model*, which is a different register from the prose pages:

- Imperative and unambiguous — "Never put a secret in a `NEXT_PUBLIC_*` variable," not "be careful
  with environment variables"
- Checkable, so the agent can verify rather than interpret — "Before deploying, confirm no file
  matching `.env*` is tracked by git"
- Framework-specific where it matters, since that's where the real traps live (Supabase RLS,
  Next.js server vs. client boundaries, Vercel environment scoping)
- Short. A 4,000-line rules file gets truncated or ignored; the top twenty rules earn their place.

Distribution: inline on the `secure-build-agent` page for copy-paste, and as a real downloadable
file through **Program Content**, which already handles per-company distribution and logs
`ContentAssetDownload` rows per user and company. That download telemetry is the only adoption
measurement the platform currently has, and it would tell you which companies actually picked the
rules file up.

### Why this serves the program, not just the reader

Worth stating plainly, because it justifies the investment beyond goodwill: **vibe-coded
applications are shadow IT.** They're not in the catalog, they're not tiered, nothing scans them,
and the AppSec team doesn't know they exist until one of them is the incident.

This track is the natural funnel into the catalog. Each page ends with the same quiet nudge — when
this becomes something real, register it — and the [onboarding forms](/docs/getting-started) already
work without a login, specifically so that someone outside the program can get an application into
Orbit. The beginner track is the top of that funnel, and the inventory it produces is what the
lifecycle work above depends on.

### Scope note

This is a comparable amount of writing to the six phase pages, aimed at a different audience, and
it shouldn't be smuggled in as a sub-task of them. Recommend treating it as its own workstream,
sequenced after the six phase pages land — with the exception of `secure-build-agent` and its rules
file, which are self-contained, disproportionately useful, and worth pulling forward if the vibe
coding is already happening at volume.

## Suggested sequencing

| Step | Work | Why here |
|---|---|---|
| 1 | ✅ `program-lifecycle` overview page | Establishes the work-item/output model the other six depend on |
| 2 | ✅ `phase-plan-design` and `phase-ci-gate` | The two richest pages, at opposite ends of the "is it supported today" spectrum — writing both early surfaces the template's weak spots |
| 3 | The remaining four phase pages | Template is proven by then |
| 4 | Glossary additions, reciprocal links from the baseline and SAMM pages | Wiring, once all six phase pages exist and can be linked to |
| 5 | `riskTier` + `lifecyclePhase` | The primitives; every tier-dependent sentence written in step 2–3 becomes true |
| 6 | Per-phase readiness evaluation | Turns six documents into a workflow |
| 7 | Gate result ingestion | Turns the workflow's evidence from claimed into verified |

The **Building Securely** track above runs as its own workstream rather than a step in this
sequence, since it serves a different audience and doesn't block any of the above. Its agent rules
file is the one piece worth pulling forward ahead of steps 3–4.

Steps 1–4 are docs-only and land without touching the schema. Step 5 is two small migrations.
Step 6 is where the pages stop being reading material.
