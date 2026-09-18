# Policy Baseline

The Policy Baseline is the minimum set of security practices every application is expected to follow continuously across its lifecycle — from design, through code and CI, to release and production. Every control here is required, with an [exception process](/docs/lifecycle-exceptions) for when you genuinely can't meet one.

## Risk tiers

Every application is assigned a risk tier, which sets how strict things get — which severities block a merge, how often the app gets re-assessed, how deep design review needs to be.

| Tier | Typically applies to | What it drives |
|---|---|---|
| **High** | Sensitive data, significant business impact, regulatory scope, or broad internet exposure | Strictest severity gates; most frequent re-review |
| **Medium** | Moderate data sensitivity or exposure | Standard severity gates (Critical/High block merge) |
| **Low** | Low sensitivity, limited exposure, low business impact | Lighter gate (only Critical findings block merge) |

Tiers come from a documented rubric — data sensitivity, exposure, business impact, regulatory scope — and get re-evaluated periodically or after major changes. Regardless of tier, a **verified live secret always blocks a merge.**

## Core requirements (MUST)

At a glance, every application needs:

- **Governance** — metadata registered and kept current, risk tier assigned
- **Plan & design** — security requirements defined up front, threat modeling for high-risk features
- **Build & commit** — secure coding standards followed, PRs get a real security review by someone other than the author
- **CI gate** — SAST, secrets detection, SCA, baseline DAST (if internet-facing), container/IaC scanning, and enforced severity thresholds
- **Release & deploy** — security evidence and an SBOM attached to every release
- **Runtime & operations** — scheduled re-scanning, findings triaged to closure against SLA

This is the single place that lists every control and how it's checked. Each phase page then covers the work itself — see [The Lifecycle](/docs/program-lifecycle).

<details>
<summary>Full list of required controls, and how each is checked</summary>

### Governance and inventory

| Control | What it means for you | How Orbit checks it |
|---|---|---|
| **Application metadata maintained** | Your application needs to be registered (owner, criticality, data classification, exposure, repo, CI pipeline) before its first production release, and kept current — update it within a few business days whenever ownership, repo, exposure, or data classification changes. | **Measured** — how complete the record is, and when it was last reviewed. Partly verification-required: whether your architecture documentation is complete and current is a human call. |
| **Risk tier assigned** | Your application needs an assigned risk tier and review cadence, reviewed **at least every six months** or whenever business need changes — and after any major change. | **Measured** — business criticality recorded, and reviewed inside six months. |

### Plan and design

| Control | What it means for you | How Orbit checks it |
|---|---|---|
| **Security requirements defined** | Before building new services or high-impact changes, capture the security requirements up front — auth model, sensitive data flows, trust boundaries — in your design doc or ticket, not as an afterthought. | **Attested** — these live in your design doc, so you assert it. |
| **Threat modeling for high-risk features** | Internet-facing or high-risk features need a lightweight threat model (even just a data-flow diagram and a few notes on what could go wrong) before you build, revisited when trust boundaries change. | **Measured** — whether a threat model exists, its status, and when it was last reviewed. |

### Build and commit

| Control | What it means for you | How Orbit checks it |
|---|---|---|
| **Secure coding standards** | Follow your language/framework's secure coding guidelines, keep dependency and secret hygiene clean (no secrets in git, intentional dependency bumps), and get trained on common vulnerability classes early after joining a repo. | **Attested** — backed by your guidelines (emailed to VTM@hearst.com) and training records. |
| **Segregation of duties** | No change reaches production without having been reviewed by someone who didn't write it. In practice: the default branch is protected, pull requests require a review, security checks must pass before merge, and production deploys from that protected branch through the pipeline — not from an individual's machine. | **Measured** — your repository's branch protection, read from your provider. The deploy half is attested until Orbit models environments. |
| **Security review on pull requests** | PRs need to answer a short checklist: does this touch a security-relevant boundary, does it add dependencies, does it change config or secrets, does it need an AppSec consult. Reviewers are expected to actually check the answers, not rubber-stamp them. | **Measured** — the PR template, read from your repository. Verification required: presence isn't completion. |

### CI verification (the automated gate)

These are the checks your pipeline runs on every PR and on the default branch — they're the baseline's most automatable layer.

| Control | What it means for you | How Orbit checks it |
|---|---|---|
| **Static analysis (SAST)** | Static analysis runs on every PR and on the default branch; findings get triaged against the severity thresholds for your tier. | **Measured** — tool and integration level on your record. |
| **Secrets detection** | Every PR and default-branch build is scanned for secrets. A verified live secret blocks the build outright — it must be revoked and rotated, not just removed from the diff. | **Measured** — tool, integration level and last scan date. For GitHub-linked repositories, secret scanning and push protection are readable through the API. |
| **Dependency scanning (SCA)** | Dependencies are scanned for known vulnerabilities **and licence risk** on every PR and default-branch build; vulnerable ones get upgraded or explicitly justified, and a licence that conflicts with how the application is distributed gets raised before release. | **Measured** — tool and integration level, or SAST recorded as covering it. |
| **Baseline dynamic testing (DAST)** | If your application is internet-facing, it needs a baseline dynamic scan against a staging/test environment before its first production release, and on a recurring schedule after that. | **Measured** — tool, integration level and last scan date. |
| **Container and IaC scanning** | Container images and infrastructure-as-code are scanned for critical misconfigurations — in CI, at the registry gate, or both — and **before the workload is deployed**, not only on commit. | **Measured** — tool and integration level. Verification required: configured isn't the same as passed before this workload deployed. |
| **Severity thresholds enforced** | Builds fail automatically when findings exceed the severity threshold for your risk tier, unless there's an approved exception on file. | **Attested** — the thresholds themselves live in your pipeline config. |

### Release and deploy

| Control | What it means for you | How Orbit checks it |
|---|---|---|
| **Release security evidence** | Each release needs its latest scan results (SAST, secrets, SCA, and DAST if applicable) attached to the release record, tied to the specific build/version that shipped. | **Attested** — scan dates sit on the application rather than on a build, so tying evidence to what shipped isn't measurable yet. |
| **SBOM per production release** | Every production release needs a software bill of materials (SPDX or CycloneDX), generated at build time and stored with the release artifact — it's what makes incident response and supply-chain review possible after the fact. | **Measured** once dependencies are snapshotted against a deployment. Attested until then. |

### Runtime and operations

| Control | What it means for you | How Orbit checks it |
|---|---|---|
| **Scheduled re-scanning** | Internet-facing applications get re-scanned on a recurring schedule (independent of your release cadence), not just at release time — because exposure and threats change even when your code doesn't. | **Measured** — last scan date against the cadence for your tier. |
| **Findings triaged to closure** | Blocker/high findings get a ticket within a couple of business days, and every finding is tracked against an SLA (by severity and tier) until it's closed or an exception is filed. | **In Wiz**, by design. Orbit confirms the checks are configured, not what they found. |

</details>

## Exceptions

Can't meet a control right now? File an exception request with Hearst's AppSec team. An exception needs a business justification, a compensating control (extra monitoring, manual review, a time-bound waiver), an owner, and an expiry date — "indefinite" isn't valid. Expired exceptions must be re-approved, remediated, or removed before the next release; pipelines are expected to block on them automatically.

## How Orbit checks this

Both policy sections — **Application Security** and **Software Development Lifecycle** — are loaded into Orbit as policies with their controls, and every application in scope is evaluated against them. Results appear control by control on the application's **Infosec Policy Compliance** tab, showing which field drove each pass or fail.

Not every control can be checked the same way, and the difference matters when you're reading your own compliance figure.

**What's measured today is your catalog record.** Controls are evaluated against fields you maintain in Orbit — whether a SAST tool is recorded, at what integration level, whether an SCA tool covers your dependencies, whether the metadata is complete. That's a real check, and it's the honest description of it: Orbit is confirming what your record says, not reaching into your scanner to confirm a scan ran or reading your repository.

**Three things to know about how the evaluation behaves**, because they shape what you'll see:

- **A control can come back as needing verification, rather than as a pass or a fail.** Some requirements are only partly checkable from catalog data: the fields Orbit can see all pass, but they don't cover the whole control. Those resolve to **verification required**, and a person confirms the rest — an administrator records that judgement, which is what promotes it to meeting. It counts as neither meeting nor not meeting, and it does **not** count toward your compliance percentage.

  The useful way to hold this: **a green check and "verified" aren't the same thing.** A control in this state isn't a problem — it's Orbit being honest that the automated part of the check isn't the whole of it.

- **A control with nothing mapped to it reads as not meeting.** It doesn't come back as unknown or get skipped. So a low compliance figure can mean the control genuinely isn't met, or that Orbit has no way to check it yet — the evidence line on each control tells you which.

- **There's no "not applicable" yet.** A control scoped to something that doesn't describe your application — internet-facing only, say — still counts against you. Conditional scoping is coming; until then, an override is how that gets handled.

**Some controls no field could ever prove.** That there's no back door in your code, that no compiler ships in your production image, that your test data isn't real customer data. These are handled by **attestation**: the application owner asserts it, records what backs the claim, and re-attests before it expires so it can't silently go stale. See [Secure Coding Standard](/docs/lifecycle-secure-coding) for what evidence to have ready.

Attested compliance is reported **separately** from measured compliance. A single blended percentage would hide how much of it is self-reported, which is the first thing anyone auditing the programme asks.

## How this connects to Orbit

Orbit evaluates applications against these controls automatically wherever the catalog already has the data, and supports a manual override where it can't — see [Policies & Compliance](/docs/policies-and-samm) for how that evaluation works. This page defines *what's* required; Orbit tracks *whether you're meeting it*.
