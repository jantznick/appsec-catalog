# The Lifecycle

The AppSec program runs as **six phases** across the software development lifecycle. [Policy Baseline](/docs/program-policy-baseline) tells you what's *required*; [SAMM & Maturity](/docs/program-samm) measures how *consistently* it happens. These pages are the part in between — the work itself, the templates to do it with, and what it produces.

## How this is meant to work

**Your development teams do the technical work of phases 1–5.** Those pages are written for them: work items, fill-in-the-blank templates, and a "done when" list they can check without booking a meeting.

**Hearst's AppSec team observes phases 2–5, collaborates on phase 1, and leads phase 6.** The balance shifts as you move through the lifecycle:

| Phase | Who drives it |
|---|---|
| **1 — Plan & Design** | Your dev team, often **working directly with Hearst's AppSec team** — threat model review, design review, and confirming the risk tier are genuinely collaborative |
| **2–5 — Build through Runtime** | Your dev team executes; AppSec observes through Orbit rather than asking for status |
| **6 — Improve & Govern** | Your company's AppSec or engineering lead with Hearst's AppSec team, on a quarterly cadence. The one phase dev teams generally aren't watching. |

That's why every work item on these pages has to produce an output. An output is the only thing a security team can confirm remotely. "We threat model our high-risk features" is a claim; an approved threat model with six threats and their mitigations is something Orbit can show them.

Each phase page ends with a **What your security team sees** section spelling out exactly that — what's visible when the phase is on plan, where Orbit is still blind and they'll have to ask you, and what deliberately lives in another tool.

That last distinction matters. Orbit is a catalog and a scoring system, not a scanner and not a findings tracker. **Vulnerability findings live in Wiz**, which is the system of record for them; Orbit correlates an application to its findings by tag rather than holding them. So a phase page saying "findings aren't here" isn't describing a gap — it's describing a boundary.

## The six phases

| # | Phase | What it catches |
|---|-------|-----------------|
| 1 | **[Plan & Design](/docs/phase-plan-design)** | Design flaws, before they're expensive — the wrong auth model, an unconsidered trust boundary, sensitive data somewhere it shouldn't be. |
| 2 | **[Build & Commit](/docs/phase-build-commit)** | Mistakes while they're still one developer's uncommitted diff, with feedback fast enough to act on. |
| 3 | **[CI Gate](/docs/phase-ci-gate)** | Known vulnerability classes, leaked secrets, and vulnerable dependencies — automatically, on every change. |
| 4 | **[Release & Deploy](/docs/phase-release-deploy)** | Shipping something that never actually passed its checks, or that carries an expired exception. |
| 5 | **[Runtime & Operate](/docs/phase-runtime-operate)** | New exposure in code that hasn't changed, and findings that sit unowned. |
| 6 | **[Improve & Govern](/docs/phase-improve-govern)** | The program itself drifting — gates nobody trusts, controls nobody meets, maturity nobody measures. |

Phases 1–5 follow the order code moves through delivery. Phase 6 runs on its own cadence and feeds what it learns back into the other five.

**Phases are not a queue.** An application doesn't leave phase 1 and never return — a new high-impact feature puts that feature back through design work while the application as a whole runs in production. Phases 2 and 3 are continuous for as long as anyone is committing code, and phase 5 is where an application spends most of its life.

## The templates

Every template in the lifecycle, and where to find it. Copy them into your design docs, repository, or tickets — they're meant to be filled in, not read.

| Template | Phase | Use it for |
|---|---|---|
| Risk tier worksheet | [1](/docs/phase-plan-design) | Scoring your application against the four tier factors, and recording the result |
| Security requirements | [1](/docs/phase-plan-design) | Auth, authorization, sensitive data, trust boundaries, secrets, logging, third parties |
| Threat statement format and starter prompts | [1](/docs/phase-plan-design) | Writing threats that are actionable, with per-component prompts if you're stuck |
| Design review request | [1](/docs/phase-plan-design) | Asking Hearst's AppSec team for a review, with the right context attached |
| Tooling plan | [1](/docs/phase-plan-design) | Deciding your SAST / secrets / SCA / DAST / firewall / API-security coverage before you build |
| Exception request | [1](/docs/phase-plan-design) | Anything you can't meet at launch |
| Pull request template | [2](/docs/phase-build-commit) | The four security questions, pre-filled on every PR |
| Repository hygiene checklist | [2](/docs/phase-build-commit) | Secrets, dependencies, and branch-protection settings, once per repo |
| Repo security onboarding | [2](/docs/phase-build-commit) | The five-minute handover for a developer joining the codebase |
| Dependency decision record | [2](/docs/phase-build-commit) | Anything you don't simply upgrade |
| Gate configuration checklist | [3](/docs/phase-ci-gate) | Confirming each CI check is wired up correctly rather than just present |
| Documented severity thresholds | [3](/docs/phase-ci-gate) | Recording what blocks a build at your tier |
| Secret exposure runbook | [3](/docs/phase-ci-gate) | What to do when a live secret is found — written before you need it |
| Finding disposition record | [3](/docs/phase-ci-gate) | Recording a fix, a ticket, or an exception so triage leaves a trace |
| Release security evidence | [4](/docs/phase-release-deploy) | The gate results for the exact commit you're shipping |
| Release sign-off | [4](/docs/phase-release-deploy) | A named person confirming the evidence before promotion |
| Environment readiness checklist | [4](/docs/phase-release-deploy) | Secrets, deploy identity, network, and data hygiene per environment |
| New exposure checklist | [4](/docs/phase-release-deploy) | Registering new domains, endpoints, ingress points, and API changes |
| Re-scan schedule record | [5](/docs/phase-runtime-operate) | What gets re-scanned, how often, by whom |
| Incident response runbook | [5](/docs/phase-runtime-operate) | Who to call, what to turn off, where the evidence is |
| Periodic application review | [5](/docs/phase-runtime-operate) | Confirming the record, the tier, and the work are all still true |
| Decommission checklist | [5](/docs/phase-runtime-operate) | Retiring an application without leaving exposure behind |
| SAMM improvement plan | [6](/docs/phase-improve-govern) | Targets per practice, and the three gaps you're actually working |
| Quarterly program review | [6](/docs/phase-improve-govern) | The agenda, the numbers, and what's blocking teams |
| Exception and override review log | [6](/docs/phase-improve-govern) | Catching overrides and exceptions that have outlived their reason |

## How each phase is described

Every phase page is built the same way, so once you've read one you can skim the rest.

| Section | What you'll find |
|---|---|
| **Why this phase exists** | The specific risk it catches, and what catching it later costs instead. |
| **What triggers it** | What starts the work — a new application, a high-impact change, every pull request, every release, a schedule. |
| **Who does the work** | Your team's part, and where Hearst's AppSec team comes in. |
| **The work** | The core of the page: each work item, what it produces, and the template to do it with. |
| **Where the outputs go** | For each output, one answer to "where does this go?" |
| **Done when** | A checkable list, written as statements about artifacts rather than about effort. |
| **How tiers change this** | What's different for a High-tier application versus a Low-tier one. |
| **How this maps to policy and maturity** | Which baseline controls this phase satisfies, and which SAMM practices it's evidence for. |
| **What your security team sees** | What's visible in Orbit when this phase is on plan — and where it isn't. |

## Work items and outputs

The unit of work in every phase is a **work item**, and each one has to produce something you can point at:

> A work item names a discrete piece of work, who does it, what triggers it, and **one output**.

Outputs are what the program measures. Nobody is asked to report on effort or intent; the question is always whether the artifact exists and whether it's current.

### Where outputs live

Every output has exactly one home. Most are in Orbit, some belong in your repository or your ticket tracker, and a few don't have a home in Orbit yet — for those, each phase page says where to keep them meanwhile, and treats the gap honestly: it's a place your security team can't confirm the work remotely.

<details>
<summary>The full list, across all six phases</summary>

| Output | Phase | Where it lives |
|---|---|---|
| Application catalog record | 1 | Orbit — [Applications](/docs/applications) |
| Risk tier and its rationale | 1 | Not in Orbit yet |
| Security requirements | 1 | Your design doc or ticket |
| Data classification | 1 | Orbit — application data types |
| Data-flow map | 1 | Orbit — [product ingress points and data flows](/docs/products) |
| Threat model and components | 1 | Orbit — [Threat Model tab](/docs/application-security) |
| Design review notes and decisions | 1 | Orbit — App Timeline |
| Approved patterns used | 1 | Your design doc |
| Tooling coverage plan | 1 | Orbit — [security tool fields](/docs/application-security) |
| Repo link and dependency inventory | 2 | Orbit — [Integrations](/docs/integrations), [Dependencies](/docs/dependencies) |
| PR security checklist | 2 | Your repository |
| Secure coding training completion | 2 | Not in Orbit yet |
| Metadata change history | 2 | Orbit — version history |
| SAST / SCA / DAST coverage and scan dates | 3 | Orbit — [security tool fields](/docs/application-security) |
| Secrets detection coverage | 3 | Not in Orbit yet |
| Severity threshold configuration | 3 | Your pipeline configuration |
| Per-build gate result | 3 | Your CI system |
| Container and IaC scan results | 3 | Your CI system |
| Build SBOM | 3 | Your build artifact store |
| Release evidence | 4 | Your release record |
| Deployment event | 4 | Orbit — [Deployments](/docs/application-data) |
| Release sign-off | 4 | Your release record |
| New domains, ingress points, API schema | 4 | Orbit — [Domains](/docs/domains), products, API Schema |
| Scheduled re-scan | 5 | Orbit records the scan date; the schedule lives in your tooling |
| DNS and web exposure history | 5 | Orbit — [Domains](/docs/domains) |
| Cloud posture findings | 5 | Your Wiz/Tenable console, tag-linked to Orbit |
| Findings and their SLA status | 5 | Your ticket tracker |
| Incident response runbook | 5 | Not in Orbit yet |
| Metadata review | 5 | Orbit — review history |
| Decommission record | 5 | Not in Orbit yet |
| SAMM assessment | 6 | Orbit — [SAMM Assessments](/docs/policies-and-samm) |
| Maturity targets and improvement plan | 6 | Not in Orbit yet |
| Exceptions | 1, 3, 4, 5 | Filed with Hearst's AppSec team |
| Program metrics | 6 | Orbit — [Dashboards](/docs/dashboards) |
| Champions and ASCOE materials | 6 | Orbit — [Program Content](/program-content) |

</details>

## Done when, and how to read it

Each phase page has a **Done when** list — what has to be true before that phase's work is finished.

They're deliberately written as statements about artifacts rather than about effort: "threat model status is at least `in_review` with a named reviewer," not "the team has thought about threats." That's so your team can check them without a security review, and so the answer doesn't depend on who's asking.

For the continuous phases (2, 3, and 5) there's no finish line, so the lists read as steady-state conditions instead — things that should be true at any given moment, like "the linked repository has synced within the last 30 days."

## How risk tiers change the work

Every application carries a **risk tier** — High, Medium, or Low — from data sensitivity, exposure, business impact, and regulatory scope. The tier doesn't change *which* phases apply; it changes how deep the work goes in each one.

| | High | Medium | Low |
|---|---|---|---|
| Design review | Live session with AppSec | Async review | Self-service |
| Threat model | Approved before build, components for every high-risk area | Required, in review | Whole-application level |
| Severity gate | Strictest | Critical and High block | Critical blocks |
| Re-assessment | Most frequent | Standard | Lightest |

[Phase 1](/docs/phase-plan-design) has the worksheet for scoring your own tier; [Policy Baseline](/docs/program-policy-baseline#risk-tiers) has what drives it. One rule ignores tiers entirely: **a verified live secret blocks a merge on every application.**

## How this connects to the rest of the program

Three layers, each answering a different question about the same work:

| Layer | The question | Where |
|---|---|---|
| **Policy Baseline** | What's required? | [Policy Baseline](/docs/program-policy-baseline) |
| **Lifecycle phases** | How is it done, and what does it produce? | These pages |
| **SAMM** | How consistently does it happen across the organization? | [SAMM & Maturity](/docs/program-samm) |

A baseline control tells you dependency scanning is required. The phase page tells you it belongs in [CI Gate](/docs/phase-ci-gate), runs on every pull request, is owned by whoever maintains your pipeline, and produces a scan result plus either an upgrade or a written justification. SAMM then asks whether that's true for one repository or for all of them.

## Orbit's role

Orbit doesn't run your scans or your pipeline. It holds the catalog those results attach to, evaluates your applications against the [policy controls](/docs/policies-and-samm) derived from the baseline, and scores how well each one is covered — so the work your teams do in these phases becomes something your security team can see.
