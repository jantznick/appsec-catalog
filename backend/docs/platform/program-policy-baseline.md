# Policy Baseline

The Policy Baseline is the minimum set of security practices every application is expected to follow continuously across its lifecycle — from design, through code and CI, to release and production. Controls are **MUST** (required, with an exception process) or **SHOULD** (strongly recommended, not yet mandatory everywhere).

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
- **Build & commit** — secure coding standards followed, PRs get a real security review
- **CI gate** — SAST, secrets detection, SCA, baseline DAST (if internet-facing), and enforced severity thresholds
- **Release & deploy** — security evidence attached to every release
- **Runtime & operations** — scheduled re-scanning, findings triaged to closure against SLA

<details>
<summary>Full list of required controls</summary>

### Governance and inventory

| Control | What it means for you |
|---|---|
| **Application metadata maintained** | Your application needs to be registered (owner, criticality, data classification, exposure, repo, CI pipeline) before its first production release, and kept current — update it within a few business days whenever ownership, repo, exposure, or data classification changes. |
| **Risk tier assigned** | Your application needs an assigned risk tier and review cadence, re-checked periodically or after major changes. |

### Plan and design

| Control | What it means for you |
|---|---|
| **Security requirements defined** | Before building new services or high-impact changes, capture the security requirements up front — auth model, sensitive data flows, trust boundaries — in your design doc or ticket, not as an afterthought. |
| **Threat modeling for high-risk features** | Internet-facing or high-risk features need a lightweight threat model (even just a data-flow diagram and a few notes on what could go wrong) before you build, revisited when trust boundaries change. |

### Build and commit

| Control | What it means for you |
|---|---|
| **Secure coding standards** | Follow your language/framework's secure coding guidelines, keep dependency and secret hygiene clean (no secrets in git, intentional dependency bumps), and get trained on common vulnerability classes early after joining a repo. |
| **Security review on pull requests** | PRs need to answer a short checklist: does this touch a security-relevant boundary, does it add dependencies, does it change config or secrets, does it need an AppSec consult. Reviewers are expected to actually check the answers, not rubber-stamp them. |

### CI verification (the automated gate)

These are the checks your pipeline runs on every PR and on the default branch — they're the baseline's most automatable layer.

| Control | What it means for you |
|---|---|
| **Static analysis (SAST)** | Static analysis runs on every PR and on the default branch; findings get triaged against the severity thresholds for your tier. |
| **Secrets detection** | Every PR and default-branch build is scanned for secrets. A verified live secret blocks the build outright — it must be revoked and rotated, not just removed from the diff. |
| **Dependency scanning (SCA)** | Dependencies are scanned for known vulnerabilities on every PR and default-branch build; vulnerable ones get upgraded or explicitly justified. |
| **Baseline dynamic testing (DAST)** | If your application is internet-facing, it needs a baseline dynamic scan against a staging/test environment before its first production release, and on a recurring schedule after that. |
| **Severity thresholds enforced** | Builds fail automatically when findings exceed the severity threshold for your risk tier, unless there's an approved exception on file. |

### Release and deploy

| Control | What it means for you |
|---|---|
| **Release security evidence** | Each release needs its latest scan results (SAST, secrets, SCA, and DAST if applicable) attached to the release record, tied to the specific build/version that shipped. |

### Runtime and operations

| Control | What it means for you |
|---|---|
| **Scheduled re-scanning** | Internet-facing applications get re-scanned on a recurring schedule (independent of your release cadence), not just at release time — because exposure and threats change even when your code doesn't. |
| **Findings triaged to closure** | Blocker/high findings get a ticket within a couple of business days, and every finding is tracked against an SLA (by severity and tier) until it's closed or an exception is filed. |

</details>

## Recommended (SHOULD)

Not yet mandatory everywhere, but expected to become required as adoption matures — worth adopting now if you aren't already:

- **Container and IaC scanning** — scan container images and infrastructure-as-code for critical misconfigurations, in CI or at the registry gate.
- **SBOM for production releases** — generate a software bill of materials (SPDX or CycloneDX) per release and store it with the release artifact, for incident response and supply-chain review.

## Exceptions

Can't meet a control right now? File an exception request with Hearst's AppSec team. An exception needs a business justification, a compensating control (extra monitoring, manual review, a time-bound waiver), an owner, and an expiry date — "indefinite" isn't valid. Expired exceptions must be re-approved, remediated, or removed before the next release; pipelines are expected to block on them automatically.

## How this connects to Orbit

Orbit evaluates applications against these controls automatically wherever the catalog already has the data, and supports a manual override where it can't — see [Policies & Compliance](/docs/policies-and-samm) for how that evaluation works. This page defines *what's* required; Orbit tracks *whether you're meeting it*.
