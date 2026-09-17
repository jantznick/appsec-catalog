# Phase 4 — Release & Deploy

The fourth phase of [the lifecycle](/docs/program-lifecycle). The last checkpoint before your code reaches real users — evidence that the checks actually passed for *this* build, a named human signing off, and any new exposure registered.

## Why this phase exists

Everything up to here produces evidence about *something*. This phase is the only one that asks whether that evidence is about the thing you're actually shipping.

That sounds pedantic until you've seen the ways it comes apart. A scan that ran two weeks and thirty commits ago. A pipeline where the security stage was disabled during an incident and never re-enabled. An exception that expired in March. A hotfix that went out through a manual path that skips CI entirely. In every case the tooling is configured correctly, the dashboard is green, and the build that reached production was never checked.

The second reason is exposure. Release is when an application stops being theoretical — a new domain resolves, a new endpoint accepts traffic, a new ingress point appears. If that isn't registered, nothing downstream monitors it, because nothing downstream knows it exists.

## What triggers it

- A build becomes a **release candidate**
- Any **promotion to production**, including hotfixes and rollbacks

Hotfixes deserve explicit mention: they're the most common way a build reaches production without passing a gate, precisely because they happen under time pressure. The answer isn't to block them — it's that a hotfix still gets a deployment record and a note about what was skipped, so the gap is visible afterward rather than invisible forever.

## Who does the work

| | Who |
|---|---|
| Attaches evidence and reports the deployment | **Your pipeline**, automatically |
| Signs off on the release | **Your release manager or application owner** — a named person |
| Confirms environment config and secrets hygiene | **Whoever owns the deploy target** |
| Registers new domains, ingress points, and API changes | **Your dev lead** |
| Approves or extends an exception blocking a release | **Hearst's AppSec team** |

Most of this should be automated. The sign-off is the part that stays human on purpose.

## The work

| # | Work item | Output |
|---|---|---|
| 4.1 | **Attach security evidence to the release** | The SAST, secrets, SCA, and where applicable DAST results for **the exact build that shipped** |
| 4.2 | **Report the deployment to Orbit** | A deployment entry: environment, version, git branch, deployed-by, notes |
| 4.3 | **Sign off on the release** | A named approver confirming the gate passed, evidence is attached, and no exception has expired |
| 4.4 | **Check that no exception has expired** | Expired exceptions re-approved, remediated, or removed before shipping. See [Exceptions](/docs/lifecycle-exceptions) |
| 4.5 | **Confirm config and secrets hygiene for the target environment** | Secrets from a managed store, nothing sensitive in plaintext config, a least-privilege deploy identity |
| 4.6 | **Register any newly created exposure** | New hosting domains, new ingress points, and an updated API schema on file |
| 4.7 | **Update the record's deployment state** | Current version, environment, and branch reflected in Orbit |

### 4.1 and 4.3 — Evidence and sign-off

These go together, because the sign-off is just a person confirming the evidence is real and current.

<details>
<summary>Release security evidence record — generate this from your pipeline</summary>

The key discipline is that every row references **the same commit**. Evidence from a different build is not evidence.

```markdown
## Release Security Evidence — <application name>

Version:        <e.g. 2.4.0>
Commit:         <full SHA — the one being deployed>
Built:          <timestamp>
Environment:    <production | staging>
Risk tier:      <High | Medium | Low>

### Gate results for THIS commit

| Check | Ran | Result | Above threshold | Link |
|---|---|---|---|---|
| SAST    | <yes/no> | <pass/fail> | <count> | <build link> |
| Secrets | <yes/no> | <pass/fail> | <must be 0> | <build link> |
| SCA     | <yes/no> | <pass/fail> | <count> | <build link> |
| DAST    | <yes/no/NA> | <pass/fail> | <count> | <scan link> |
| Container / IaC | <yes/no/NA> | <pass/fail> | <count> | <build link> |

SBOM: <link to the artifact, or "not generated">

### Anything above threshold

| Finding | Severity | Exception ref | Expires |
|---|---|---|---|
| <none> | | | |

### Exceptions in force for this application

| Control | Exception ref | Expiry | Still valid? |
|---|---|---|---|
| <none> | | | |

### Deviations
<Anything skipped, and why. A hotfix that bypassed CI goes here — an
 honest note beats a clean-looking record nobody can trust.>
```

</details>

<details>
<summary>Release sign-off — a named person, before promotion</summary>

```markdown
## Release Sign-Off — <application name> <version>

Commit: <SHA>

I confirm:

- [ ] Every gate check ran **on this commit** and passed, or has an
      approved unexpired exception
- [ ] No verified live secret was found
- [ ] No exception affecting this application has expired
- [ ] New exposure (domains, endpoints, ingress points) is registered in Orbit
- [ ] Environment config and secrets hygiene confirmed for the target
- [ ] The deployment will be reported to Orbit

Deviations from the above: <none, or list them>

Signed: <name>        Role: <role>        Date: <YYYY-MM-DD>
```

For a Low-tier application with a fully automated pipeline, this is a one-line record your CI writes. For High tier it's a person reading the evidence record before clicking deploy. Don't make it a form nobody reads — if it always says "all clear" without anyone checking, delete it and be honest that you don't have a sign-off step.

</details>

### 4.5 — Environment and secrets hygiene

The check here isn't about your code, it's about the place you're putting it. Most of these are set once per environment and then only break when someone changes something under time pressure.

<details>
<summary>Pre-deploy environment checklist — per environment, re-checked on change</summary>

```markdown
## Environment Readiness — <application name>, <environment>

### Secrets and config
- [ ] All secrets come from a managed store, injected at runtime
- [ ] No secrets in the image, the repo, or plaintext config files
- [ ] Production credentials are distinct from staging and local
- [ ] Rotation cadence is defined, with a named owner
- [ ] Debug mode, verbose errors, and stack traces are OFF
- [ ] Any seeded test or demo account is removed or disabled

### Deploy identity
- [ ] The deploy credential is scoped to just what it needs
- [ ] It cannot read application data or other environments
- [ ] Deployment tokens reported to Orbit are scoped to this application only

### Network and transport
- [ ] HTTPS enforced, HTTP redirected
- [ ] Only intended ports and paths are reachable
- [ ] Admin interfaces are not publicly exposed, or are behind separate auth
- [ ] Storage buckets and databases are not publicly readable
      (check this rather than assuming it)

### Data
- [ ] Production data is not copied into non-production environments
- [ ] Backups exist, and a restore has actually been tested
```

</details>

### 4.6 — Register the new exposure

The one step in this phase that's easy to forget and expensive to miss. If a domain isn't in Orbit, [Runtime & Operate](/docs/phase-runtime-operate) can't monitor it, and nobody notices when it starts resolving somewhere unexpected.

<details>
<summary>New exposure checklist — run through this on any release that changes your surface</summary>

```markdown
## New Exposure — <application name> <version>

- [ ] **New hosting domain or subdomain?**
      → Add it under the application's Hosting Domains in Orbit, so DNS
        and web-reachability history starts being recorded
- [ ] **New external entry point?**
      → Record it as an ingress point on the product, with its channel
        and whether it requires an API key
- [ ] **New or changed API surface?**
      → Upload the updated OpenAPI/Swagger schema to the application's
        API Security section
- [ ] **New application-to-application data flow?**
      → Record it on the product, with protocol, data classification,
        and direction
- [ ] **New third-party integration?**
      → Note what data it receives; update the security requirements doc
- [ ] **Did anything become internet-facing that wasn't?**
      → Update the application's facing field — this changes your risk
        tier, your scoring multiplier, and your DAST obligation
```

That last one is worth pausing on. Going from internal to external-facing raises your tool-usage scoring ceiling by 1.5x and makes baseline DAST a requirement. An application that quietly became public without the record changing looks better scored than it should be.

</details>

## Where the outputs go

| Output | Where |
|---|---|
| Release security evidence | **Your release record or CI system** — no Orbit home yet |
| Deployment event | **Orbit** — the [Deployments tab](/docs/application-data), manually or from your pipeline |
| Release sign-off | **Your release record** — no Orbit home yet |
| Environment readiness checklist | **Your repository** or runbook |
| New hosting domains | **Orbit** — [Domains](/docs/domains) |
| New ingress points and data flows | **Orbit** — the [product](/docs/products) |
| Updated API schema | **Orbit** — the [Security tab's](/docs/application-security) API Security section |
| Current version, environment, branch | **Orbit** — the application record |

On 4.2: automate this. Orbit issues **deployment tokens** — deliberately narrow credentials that can only report a deployment event for the applications they're scoped to, so a leaked one can at worst log a bogus deployment. Orbit generates a ready-to-use `curl` or `wget` command pre-filled with the token and application ID, leaving placeholders for `environment`, `version`, `gitBranch`, `deployedBy`, and `notes` to fill in from your pipeline. See [Settings & Automation](/docs/settings-and-automation).

This matters more than it looks: your deployment history is what [scan freshness scoring](/docs/scoring-methodology) measures against. Without reported deployments, Orbit can't tell whether your scanning keeps pace with your shipping, and scan dates are graded against nothing.

On 4.6: once an API schema is on file, Orbit turns it into a browsable security view — endpoint count, declared authentication schemes, and per-endpoint whether auth is required, which sensitive fields it touches, and what to check. Uploading the schema is also what earns the API Security category in your score; it's full credit once a schema is on file, or zero.

## Done when

- Evidence for the shipped build is attached, with every check referencing the same commit
- A deployment entry exists in Orbit, with version and environment
- A named person signed off
- No expired exception applies to this application
- Environment config and secrets hygiene confirmed for the target
- Every new domain, ingress point, and API change is registered
- The record's current version and environment are up to date

## How tiers change this

| | High | Medium | Low |
|---|---|---|---|
| **Sign-off** | A named person reads the evidence before promotion | A named person, evidence reviewed at a glance | Automated record is enough |
| **Evidence** | All checks, per release, retained | All checks, per release | Gate pass/fail per release |
| **DAST before release** | Required if internet-facing, current scan | Required if internet-facing | Required before first production release |
| **Expired exception** | Blocks the release | Blocks the release | Blocks the release |

The bottom row is the same across all three on purpose.

## How this maps to policy and maturity

### Baseline controls satisfied here

From [Policy Baseline](/docs/program-policy-baseline): **release security evidence** (4.1, 4.3) is the explicit one — the requirement that each release carries its latest scan results "tied to the specific build/version that shipped." This phase is also where the **exceptions** process is enforced in practice (4.4), since an expired exception has to be resolved before the next release.

### SAMM practices this is evidence for

From [SAMM & Maturity](/docs/program-samm): **Secure Deployment** (Implementation) — hardened deployments with consistent configuration and secrets handling — and **Requirements-driven Testing** (Verification), since release is where you confirm the tests that verify your Phase 1 requirements actually ran.

## What your security team sees

| They see | Where |
|---|---|
| That you deploy, how often, to which environments, at which versions | The application's Deployments tab, filterable by environment |
| Whether your scanning keeps pace with your shipping | Scan dates measured against deployment history, in the Tool Usage half of your [score](/docs/scoring-methodology) |
| Whether a pipeline is wired into Orbit at all | The **Developer dashboard**'s CI/CD control coverage, via deployment tokens configured |
| Your live external surface, and how it changes over time | [Domains](/docs/domains) — DNS snapshots, detected DNS changes, and web-reachability history |
| Your API surface and how it protects itself | The API Schema view — endpoint count, auth schemes, flagged sensitive fields |
| How your applications compose, and where traffic enters | Product ingress points and data flows |

**Where they're blind, and will have to ask you:**

- **Whether the build that shipped actually passed its checks.** This is the structural gap in the current model: scan dates live on the *application*, not on a build, so nothing connects "the SAST run" to "version 2.4.0 that shipped on Tuesday." The baseline asks for evidence tied to the specific build that shipped, and the data model can't yet express that sentence. Your release record is the source of truth meanwhile.
- **Whether anyone signed off.** No approver, no timestamp, no record.
- **Whether an exception has expired.** Orbit's administrator-set policy-control overrides carry no expiry date, so there's nothing for a release check to test. Exceptions live with Hearst's AppSec team — see [Exceptions](/docs/lifecycle-exceptions) for why an expired one blocks a release regardless of tier.
- **Whether your environment hygiene was confirmed.** Not recorded.

The first of those is the one worth understanding, because it changes how much the green dashboard means. Orbit can currently tell your security team that you own a SAST tool and that it ran recently. It can't tell them it ran on what you shipped. Closing that — a per-build gate result posted from your pipeline, the same way deployments already are — is the highest-value integration on the platform roadmap.

---

Around this phase: **[Phase 3 — CI Gate](/docs/phase-ci-gate)** before it, **[Phase 5 — Runtime & Operate](/docs/phase-runtime-operate)** after. See **[The Lifecycle](/docs/program-lifecycle)** for all six phases.
