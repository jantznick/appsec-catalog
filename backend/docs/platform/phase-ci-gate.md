# Phase 3 — CI Gate

The third phase of [the lifecycle](/docs/program-lifecycle). The automated checks your pipeline runs on every pull request and every default-branch build, with severity thresholds that actually fail the build. Your team configures this once; after that it runs without anyone's attention.

## Why this phase exists

This is the only phase that scales without a human in the loop. Everything else costs somebody's attention per application; a gate configured once runs on every change forever, at three in the morning, on the pull request nobody senior looked at.

It's also where the program's most reliable evidence comes from. A threat model tells you what your team intended. A gate result tells you what actually happened to a specific commit — which is why [Meeting the Policy](/docs/program-policy-baseline) calls this "the baseline's most automatable layer" and puts five required controls in it.

The failure mode to avoid is a gate everybody routes around. A pipeline that fails on 200 findings nobody has triaged doesn't get fixed, it gets bypassed — and then the gate is worse than no gate, because it produces a passing build that means nothing. Tuning is not optional polish; it's what keeps this phase real.

## What triggers it

- **Every pull request**, before merge
- **Every build on the default branch**, after merge

Both matter, for different reasons. The pull-request run is fast feedback to the person who can still cheaply change the code. The default-branch run catches what merged while a check was failing, skipped, or misconfigured — and it's what a release draws its evidence from.

## Who does the work

| | Who |
|---|---|
| Stands up the jobs, wires the thresholds, keeps the gate green for the right reasons | **Whoever maintains your pipeline** |
| Triages what the gate finds on their own change | **The developer who opened the PR** |
| Accountable for the gate existing at all, and for findings not accumulating unowned | **Your application owner** |
| Sets the severity thresholds per tier, approves exceptions, helps with tuning | **Hearst's AppSec team** |

## The work

| # | Work item | Output |
|---|---|---|
| 3.1 | **Stand up static analysis (SAST)** | A job on every PR and default-branch build; tool, integration level, and last scan date recorded in Orbit |
| 3.2 | **Stand up secrets detection** | A job that fails the build outright on a verified live secret, plus a written exposure runbook |
| 3.3 | **Stand up dependency scanning (SCA)** | A job on every PR and build covering **known vulnerabilities and licence risk**; vulnerable dependencies upgraded or justified |
| 3.4 | **Stand up baseline dynamic testing (DAST)** | A scan against staging before first production release, then on a schedule |
| 3.5 | **Configure the severity thresholds for your tier** | Pipeline config that fails the build above your threshold, with the threshold documented |
| 3.6 | **Report the gate result** | A per-build record: which checks ran, against which commit, counts by severity, pass or fail |
| 3.7 | **Triage what the gate finds** | A fix, a ticket, or an approved exception — never a silenced check |
| 3.8 | **Scan containers and infrastructure-as-code** | A pipeline or registry gate on critical misconfigurations, passed before the workload deploys |
| 3.9 | **Generate an SBOM per production release** | An SPDX or CycloneDX bill of materials, generated at build time and stored with the artifact |

3.8 and 3.9 are required, not optional. Note where each one bites: container and IaC scanning has to pass **before the workload deploys**, so it's a release gate as well as a CI check, and the SBOM has to be generated **at build time** from what actually went into the artifact.

### 3.1–3.4 — Wiring up the checks

The common failure isn't missing tools, it's tools that are present but not actually gating: a job that runs on `main` only, a scan that excludes the directory where the code lives, a step with `continue-on-error: true` that reports findings and passes anyway.

**Not sure which tool to use?** Ask Hearst's AppSec team — some tools are provided centrally, and which ones are available to you depends on what's configured for your company. Guided setup playbooks for the most common tool per category, including how to wire results back into Orbit, are on the way.

**Two ways to set this up.** Both are fully supported, and which one suits you is a decision for your company rather than a stage to pass through.

| | **Guided integration through Orbit** | **Set it up yourself** |
|---|---|---|
| How it works | Once a repository is linked, pick the tools you want in Orbit; it configures the integration directly, or **opens a pull request against your repository** with the pipeline changes for your team to review and merge | Follow the setup playbook for your chosen tool and wire it into your own pipeline |
| Requires | Granting Orbit write access to the repository | Nothing beyond what you already have |
| Tool choice | From a curated list per category | Any tool you like |
| Coverage in Orbit | Populated from the integration | You record it on the Security tab |
| Best when | You want this running quickly, and standard tooling is fine | You have particular pipeline requirements, your CI lives outside the connected repository, or your company would rather not grant write access |

Guided integration is on the way; the playbooks are how this works today and will keep working afterwards. The rest of this page applies either way — with guided integration the checklist below is something you **verify**, and set up yourself it's something you **assemble**.

<details>
<summary>Gate configuration checklist — verify each of these per check</summary>

Deliberately tool-agnostic, so it holds whether you're on GitHub Actions, GitLab CI, Azure Pipelines, or Bitbucket. Work down it once per check.

```markdown
## Gate Configuration — <application name>

For each of SAST, secrets, SCA, DAST:

- [ ] Runs on pull requests, before merge
- [ ] Runs on the default branch, after merge
- [ ] Runs on ALL code paths — no excluded directory where real code lives
- [ ] Does NOT have continue-on-error / allow-failure set
- [ ] Fails the build above our tier's severity threshold
- [ ] Cannot be skipped by a commit message flag or a label
- [ ] A failing run is visible to the PR author without digging into logs
- [ ] Results are retained long enough to attach to a release
- [ ] Someone specific gets notified when the job itself breaks
      (a check that silently stops running is worse than no check)

Per-check specifics:

SAST
- [ ] Ruleset covers our language and framework
- [ ] Baseline set for the existing backlog, so new findings stand out

Secrets
- [ ] Full git history scanned on first run, not just new commits
- [ ] Distinguishes VERIFIED live secrets from pattern matches
- [ ] A verified secret is a hard failure, regardless of tier

SCA
- [ ] Reads our actual lockfile, not just the manifest
- [ ] Covers transitive dependencies, not just direct ones
- [ ] Runs on the default branch even when no dependency changed
- [ ] Licence checking is switched on, not just vulnerability checking
      (most tools do both, but licence rules often ship disabled)

DAST
- [ ] Points at a staging environment that resembles production
- [ ] Authenticated scan where the app has a login
- [ ] Scheduled recurrence, not only pre-release
```

</details>

### 3.2 — Secrets detection is stricter than everything else

Every other check here is graded against your risk tier. Secrets detection has one rule that applies to every application regardless of tier: **a verified live secret blocks the merge.**

A leaked credential isn't a vulnerability that might be exploitable — it's an exposure that already happened, to anyone who has read your git history since the commit landed. Severity grading doesn't apply, because the impact isn't about your code.

Which also means **the fix is not removing it from the diff.** Git keeps history; the secret is still in the previous commit and in every clone anyone has made. It has to be revoked and rotated at its source.

<details>
<summary>Secret exposure runbook — write this before you need it</summary>

The point of writing it in advance is that the moment you need it, someone is panicking and reaching for the fastest-looking option, which is usually "delete the line and force-push." That doesn't help.

```markdown
## Secret Exposure Runbook — <application name>

### Step 1 — Assume it's compromised (0–15 min)
Do NOT start with the git history. Start with the credential.

| Secret type | Where to revoke | Who can do it |
|---|---|---|
| <AWS access key>   | <IAM console>        | <name / team> |
| <Database password>| <RDS + secret store> | <name / team> |
| <Third-party API>  | <that vendor's console> | <name / team> |

### Step 2 — Rotate and redeploy
- [ ] New credential issued and stored in <secret store>
- [ ] Application redeployed / restarted against the new credential
- [ ] Confirmed the old credential no longer works

### Step 3 — Determine exposure
- [ ] When did the commit land, and was the repo public at any point?
- [ ] Pull the credential's access logs for the exposure window
- [ ] Anything unexpected → this is an incident, escalate to
      <your security contact> and Hearst's AppSec team

### Step 4 — Clean up the history
Only now, and only if it's worth it. Rewriting shared history is
disruptive; a revoked credential is already harmless.

### Step 5 — Stop it recurring
- [ ] Where should this secret have been? Is that path easy to use?
- [ ] Pre-commit hook in place locally, not just in CI?
- [ ] Record what happened on the application's App Timeline in Orbit

### Contacts
Security contact: <name, how to reach them out of hours>
AppSec team:      <how to reach Hearst's AppSec team>
```

</details>

### 3.5 — Document your severity thresholds

Your thresholds come from your risk tier (score yours in [Phase 1](/docs/phase-plan-design#12-determine-your-risk-tier)):

| Tier | What blocks a merge |
|---|---|
| **High** | Strictest — the tightest severity gate of the three |
| **Medium** | Critical and High findings |
| **Low** | Critical findings only |

Two rules cut across all of them: a **verified live secret** always blocks, and an **approved, unexpired exception** is the only legitimate way past a threshold. If your pipeline lets a build through above threshold without one, the gate isn't configured — it's decorative.

<details>
<summary>Threshold record — keep this next to your pipeline config</summary>

```markdown
## Severity Thresholds — <application name>

Risk tier: <High | Medium | Low>
Confirmed with AppSec: <date>

| Check | Blocks the build at | Reports only |
|---|---|---|
| SAST    | <Critical, High> | <Medium, Low> |
| Secrets | Any VERIFIED live secret — no exceptions | Unverified matches |
| SCA     | <Critical, High> | <Medium, Low> |
| DAST    | <Critical>       | <High and below> |

Where this is enforced: <file path / pipeline config location>

Active exceptions letting a build through above threshold:
| Control | Expiry | Owner | Exception ref |
|---|---|---|---|
| <none> | | | |
```

</details>

### 3.7 — Triage what the gate finds

Four legitimate outcomes for a finding: fix it, ticket it with an owner and a date, file an [exception](/docs/lifecycle-exceptions), or dismiss it as a false positive with a specific reason.

**Not legitimate:** suppressing the rule, adding a blanket ignore path, or lowering the threshold so the build passes. Those silently reduce coverage for everyone after you and leave a passing build that proves nothing. A genuinely noisy rule is a tuning conversation with Hearst's AppSec team, not a local suppression.

**[Remediating Findings](/docs/lifecycle-remediation)** covers the whole of this — triage, ownership, what blocks and what doesn't, verifying closure, and what to do when the same finding keeps coming back.

## Where the outputs go

Orbit holds the **coverage** picture — which tools cover this application, how deeply, when they last ran. Your CI system holds the **per-build** record.

| Output | Where |
|---|---|
| SAST / SCA / DAST coverage: tool, integration level, last scan date | **Orbit** — the [Security tab](/docs/application-security) |
| Secrets detection coverage | **Your pipeline config** — no Orbit field yet |
| Gate configuration checklist | **Your repository**, next to the pipeline config |
| Severity threshold record | **Your repository**, next to the pipeline config |
| Secret exposure runbook | **Your repository** or team wiki — somewhere findable at 2am |
| Per-build gate result | **Your CI system** |
| Container and IaC scan results | **Your CI system** |
| Build SBOM | **Your build artifact store**, alongside the artifact |
| Finding dispositions | **Your ticket tracker**, or the PR thread for anything fixed in place — see [Remediating Findings](/docs/lifecycle-remediation) |

Two things worth knowing about how Orbit reads the fields you fill in:

**Integration level** isn't "do you have the tool," it's how much of it Orbit can see: 0 none, 1 implemented but no data shared, 2 data shared over API, 3 dashboard and config access shared, 4 full-service partner — worth 0%, 25%, 50%, 75%, and 100% of that category's points. There's also a shortcut for the common case where one tool does both static analysis and dependency scanning: check that SAST includes SCA, and SCA is scored from the same tool, level, and date instead of being entered twice.

**Scan freshness is measured against your deployments**, which surprises most people. A scan earns full credit when its date falls within a day of your most recent deployment in either direction, and tapers off the further it drifts; a missing scan date drops to 30%. The question isn't "did you scan recently" but "does your scanning track your shipping" — a monthly scan on a weekly deploy cadence is a gap no matter how recent the scan. See [Scoring Methodology](/docs/scoring-methodology).

## Done when

Continuous phase, so these are steady-state conditions rather than a finish line — true at any moment, for any application that has shipped:

- SAST, secrets detection, and SCA all run on pull requests **and** on the default branch
- Baseline DAST exists against staging, if the application is internet-facing
- Severity thresholds are configured and match your assigned risk tier
- The tool, integration level, and last scan date for each category are current in Orbit
- No finding above threshold is outstanding without an approved, unexpired exception
- No check has been suppressed or bypassed to make the build pass

## How tiers change this

| | High | Medium | Low |
|---|---|---|---|
| **Severity gate** | Strictest | Critical and High block | Critical blocks |
| **Secrets** | Verified live secret blocks — no tier exemption | Same | Same |
| **DAST** | Required if internet-facing, most frequent schedule | Required if internet-facing | Required if internet-facing |
| **Container / IaC** | Required — strictest thresholds | Required | Required |
| **SBOM** | Required per production release | Required | Required |

## How this maps to policy and maturity

### Baseline controls satisfied here

Every CI verification control from [Meeting the Policy](/docs/program-policy-baseline): **static analysis** (3.1), **secrets detection** (3.2), **dependency scanning** (3.3), **baseline dynamic testing** (3.4), **container and IaC scanning** (3.8), and **severity thresholds enforced** (3.5). Work item 3.9 carries the baseline's **SBOM per production release**, which is evidenced at [release](/docs/phase-release-deploy).

### SAMM practices this is evidence for

From [SAMM & Maturity](/docs/program-samm): **Security Testing** (the active testing itself), **Secure Build** (a secure build process and dependency management), and **Defect Management** (findings triaged and tracked rather than accumulating).

The maturity distinction is where most programs stall at level 1: having these jobs *available* is not the same as having them run on every change, in every repository, with thresholds that actually block. Going 1→2 here is mostly consistency across repositories; 2→3 is measuring the gate rather than just running it.

## What your security team sees

When you've done the above, here's what Hearst's AppSec team can confirm by logging into Orbit:

| They see | Where |
|---|---|
| Which testing tools cover this application, and how deeply | The Security tab; the **Executive dashboard** rolls up security testing coverage by type across your portfolio |
| Whether your scanning keeps pace with your shipping | Scan dates against deployment history, via the Tool Usage half of your [score](/docs/scoring-methodology) |
| SAST and SCA coverage across all your applications | The **Developer dashboard**, including applications with no repository or tool link at all |
| Which applications have a pipeline wired into Orbit at all | The **Developer dashboard**'s CI/CD control coverage, via deployment tokens |
| Whether secrets detection covers you | The Security tab — tool, integration level, last scan date. For GitHub-linked repositories, secret scanning and push protection are read through the API rather than self-reported |
| Whether container and IaC scanning is in place | The Security tab, as a single combined field — most tools covering one cover both |
| Whether you're meeting the CI controls | The Infosec Policy Compliance tab, showing which field drove each pass or fail |
| What's in your dependency tree, independent of your SCA tool | The [Dependencies](/docs/dependencies) page, with [OSV.dev](https://osv.dev) advisory flags — the fastest way to answer "which of our applications uses this package" when an advisory drops |

**Where they're blind, and will have to ask you.** This phase has the widest gap in the platform between what the baseline requires and what Orbit can currently record, so it's worth being direct:

- **Whether any of it actually ran on the commit that shipped.** Orbit knows which tools you say cover the application and roughly when each last ran. It doesn't know SAST ran on the build that went to production and passed your threshold. That's the difference between self-reported coverage and verified evidence, and closing it is the highest-value integration on the platform roadmap. The mechanism already exists in narrower form — a [deployment token](/docs/settings-and-automation) is a tightly-scoped credential that lets your pipeline report a deployment event with a ready-made command; reporting gate results is the same shape of thing.
- **What your thresholds are.** Not recorded, and can't sensibly be until risk tier exists as a field.
- **Whether your container and IaC scan passed for the workload that deployed.** Coverage is recorded, but the control asks for the scan to have passed *before that particular workload went out* — and tying a scan to a deployment isn't something Orbit can do yet, so this one reads as needing verification rather than as a pass.
- **Which SBOM went with which release.** Orbit's dependency inventory is rebuilt from your manifests on every repository sync and keeps no history, so it describes your repo now rather than what shipped in a given build. Per-release SBOMs need dependencies snapshotted against a deployment; until that lands, don't treat the Dependencies page as satisfying 3.9. SBOM is the harder one: Orbit's dependency inventory is rebuilt from your manifests on every repository sync and keeps no history, so it can't answer *which* SBOM went with *which* release. That needs dependencies snapshotted against a deployment — until it lands, don't treat the Dependencies page as satisfying 3.9.

**What lives elsewhere by design.** Individual findings — what the gate reported, at what severity, and whether it's fixed — are **not** going into Orbit. **Wiz is the system of record for vulnerability findings**, and your scanner's own console is where you work a specific result. Orbit tracks whether the checks are configured and running, not what they output. So when a page here says findings aren't in Orbit, that's a boundary rather than a missing feature, and the [Dependencies](/docs/dependencies) page's OSV advisory flags stay deliberately informational for the same reason.

---

Around this phase: **Phase 2 — Build & Commit** before it, **Phase 4 — Release & Deploy** after. See **[The Lifecycle](/docs/program-lifecycle)** for all six phases.
