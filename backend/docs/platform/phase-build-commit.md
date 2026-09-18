# Phase 2 — Build & Commit

The second phase of [the lifecycle](/docs/program-lifecycle). Continuous work inside your repository — secure coding habits, a real security question on every pull request, and keeping the catalog honest as the code changes.

## Why this phase exists

This is where the feedback loop is shortest and therefore cheapest. A developer who hears about a problem while the change is still uncommitted fixes it in minutes. The same problem caught in [CI Gate](/docs/phase-ci-gate) costs a context switch; caught in [Runtime & Operate](/docs/phase-runtime-operate) it costs a ticket, a sprint slot, and a redeployment.

It's also the phase automation can't cover. A scanner will find a SQL injection; it won't notice that your new endpoint returns another tenant's records, because that's working exactly as written. Somebody has to look, and a pull request is the one moment where somebody is already looking.

## What triggers it

Continuous, from the first commit until the application is decommissioned. Per-pull-request rather than per-release — which means the work here is mostly about setting up habits and files once, then maintaining them.

## Who does the work

Almost entirely your team. Hearst's AppSec team appears only on escalation.

| | Who |
|---|---|
| Sets up the PR template, pre-commit hooks, and the repo link | **Your dev lead**, once per repository |
| Answers the checklist on their own pull requests | **Every developer** |
| Actually reads the checklist answers rather than rubber-stamping | **The reviewer** |
| Consulted when the checklist flags something | **Your security champion**, then Hearst's AppSec team |

## The work

| # | Work item | Output |
|---|---|---|
| 2.1 | **Link the repository to the application record** | A live repo link in Orbit, with detected languages, frameworks, and a dependency inventory |
| 2.2 | **Add the PR security checklist to your repository** | A pull request template, committed |
| 2.3 | **Answer and review the checklist on every PR** | A review approval where the security questions were actually considered |
| 2.4 | **Set up local and pre-commit hygiene** | A secrets pre-commit hook, committed lockfiles, deliberate dependency bumps |
| 2.5 | **Onboard new developers to the repo's security context** | A completed repo security onboarding, early rather than eventually |
| 2.6 | **Keep dependencies clean** | Advisory-flagged dependencies upgraded, or a written justification |
| 2.7 | **Keep the catalog record honest as the code changes** | Version history entries as language, framework, interfaces, or domains change |
| 2.8 | **Update the threat model when a boundary moves** | A revised threat model, tied to the change that caused it |

### 2.2 — The PR security checklist

The point of a checklist on a pull request isn't to catch everything. It's to make the author stop for fifteen seconds and notice that this change touches authentication — which is usually enough, because the author knows their change better than any reviewer will.

Keep it short. A twenty-item checklist gets ticked without reading; four questions with a follow-up get answered.

<details>
<summary>Pull request template — commit this to your repository</summary>

Save as `.github/PULL_REQUEST_TEMPLATE.md` (GitHub), `.gitlab/merge_request_templates/Default.md` (GitLab), or your provider's equivalent, so it pre-fills on every pull request.

```markdown
## What this changes

<!-- One or two sentences. -->

## Security check

Answer all four. "No" is a perfectly good answer — the point is that
someone looked.

- [ ] **Does this touch a security-relevant boundary?**
      Authentication, authorization, session handling, tenant isolation,
      or anything that decides who can see or do what.
      → If yes, what changed and what enforces it now:

- [ ] **Does this add or change a dependency?**
      → If yes, why this library, and did the scan come back clean:

- [ ] **Does this change configuration, secrets, or infrastructure?**
      → If yes, what, and confirm nothing sensitive is in this diff:

- [ ] **Does this change what data we collect, store, log, or send
      to a third party?**
      → If yes, what, and is it covered by our data classification:

- [ ] **Does this need an AppSec consult?**
      Yes if: new external exposure, a new trust boundary, a change to
      how authorization is decided, handling a new category of sensitive
      data, or you answered yes above and aren't confident in the answer.

## Reviewer

- [ ] I read the answers above rather than assuming them
- [ ] Anything flagged for consult has been raised before merge
```

</details>

Adoption here is verifiable rather than self-reported — the template is a file in your repository, so the presence of it is a fact rather than a claim. That matters for what your security team can confirm, below.

### 2.3 — Reviewing the answers

This is also where **segregation of duties** comes from. The policy requires that no change reaches production without having been seen by someone who didn't write it, and the combination that delivers it is ordinary: a protected default branch, pull requests that require a review, security checks that must pass before merge, and no force-push — the four repository settings in the checklist below. Those settings *are* the control; the rest of this section is about the review being real rather than a rubber stamp.

One half of it lives outside this phase, though: production has to deploy *from* that protected branch through the pipeline, or the review is decorative. See [Release & Deploy](/docs/phase-release-deploy).

The checklist fails in a specific way: the author ticks four boxes, the reviewer approves without reading them, and now there's a security process that produces nothing but a false sense of coverage.

What makes a review real:

- **A "yes" needs a follow-up answer**, not just a tick. "Yes, this touches authorization" with nothing after it is an unanswered question.
- **The reviewer checks the claim against the diff.** If the author said no dependencies changed and the lockfile is in the diff, that's the whole value of the checklist right there.
- **Escalation is normal, not a failure.** Flagging a consult should cost the author nothing socially, or nobody will ever do it.

### 2.4 — Local and pre-commit hygiene

The goal is that a secret never reaches the remote at all. [CI Gate](/docs/phase-ci-gate) catches secrets after they're pushed — by which point the credential is already exposed and has to be rotated. A pre-commit hook catches it while it's still local and costs nothing.

<details>
<summary>Repository hygiene checklist — work through this once per repo</summary>

```markdown
## Repository Hygiene — <repo name>

### Secrets
- [ ] A secrets pre-commit hook is installed and documented in the README,
      so a new clone gets it too
- [ ] `.env`, `.env.*`, and local config are in `.gitignore`
- [ ] `git ls-files | grep -E '^\.env|\.pem$|\.p12$|credentials'` returns nothing
- [ ] An `.env.example` exists with keys but no values, so nobody has to
      guess what to set (and nobody copies a real value from a teammate)
- [ ] Local development uses its own credentials, never production ones

### Dependencies
- [ ] The lockfile is committed
- [ ] Dependency bumps are their own pull request, not bundled into a
      feature change where nobody reviews them
- [ ] Automated update PRs (Dependabot / Renovate) have a named owner,
      or they pile up unread

### Repository settings
- [ ] The default branch is protected — no direct pushes
- [ ] Pull requests require at least one review
- [ ] Security checks are required to pass before merge, not advisory
- [ ] Force-push to the default branch is disabled
- [ ] Repository visibility is correct (and you've checked, not assumed)
- [ ] Who has write and admin access is current — ex-team members removed
- [ ] Nobody can merge their own pull request without a second approval
      (this and the four settings above are what segregation of duties
       actually consists of)
```

</details>

### 2.5 — Onboarding a developer to the repo

Someone joining a repository inherits every security decision in it without knowing any of them. This is a five-minute handover that saves a class of mistake.

<details>
<summary>Repo security onboarding — run this with every new developer</summary>

```markdown
## Repo Security Onboarding — <developer name>, <repo name>

Walked through by: <name>          Date: <YYYY-MM-DD>

- [ ] Where this app sits: risk tier, whether it's internet-facing, what
      sensitive data it handles
- [ ] Read the security requirements doc (from Phase 1)
- [ ] Read the threat model in Orbit — particularly the components
- [ ] Where secrets live, and how to get them for local development
      (and that production credentials are never used locally)
- [ ] Pre-commit hooks installed and confirmed working
- [ ] The PR security checklist, and that flagging a consult is encouraged
- [ ] What our severity thresholds are and what blocks a merge
- [ ] Who to tell, immediately, if they think they've leaked a credential —
      by name, not "security"
- [ ] The [Secure Coding Standard](/docs/lifecycle-secure-coding) — what our
      code has to be true of, regardless of what we're building
- [ ] The vulnerability classes that matter most in this codebase:
      <e.g. "we're a Rails app handling payments — mass assignment and
      IDOR are our recurring themes">
```

That last item is the one worth actually thinking about. Generic secure-coding training is easy to provide and easy to ignore; "here are the two mistakes this specific codebase keeps making" lands.

</details>

### 2.6 — Keeping dependencies clean

Orbit pulls your dependency inventory from the linked repository and checks it against [OSV.dev](https://osv.dev) advisories, across your whole portfolio. Treat that as informational and your [CI Gate](/docs/phase-ci-gate) SCA tool as authoritative — but the portfolio view is the fastest way to answer "which of our applications uses this package" when an advisory lands.

<details>
<summary>Dependency decision record — for anything you don't just upgrade</summary>

```markdown
## Dependency Decision

Package:        <name@version>
Advisory:       <CVE / GHSA id>     Severity: <as reported>
Applications affected: <from Orbit's Dependencies page>

Decision:       <upgraded | justified | replaced | accepted with exception>

If upgraded:    <new version, PR link>

If justified — all three must be true and stated:
  Reachable in our code?   <no — and how you know: "the vulnerable
                            function is in their CLI, we import only
                            the parser">
  Exploitable in context?  <no — and why>
  Revisit when:            <trigger or date — not "never">

If accepted with exception: <exception ref, expiry date>
```

"We don't think it affects us" is not a justification. The three questions above are, and answering them takes about as long as writing the vague version.

</details>

## Where the outputs go

| Output | Where |
|---|---|
| Repository link, languages, frameworks, dependency inventory | **Orbit** — the [Integrations tab](/docs/integrations) and the [Dependencies](/docs/dependencies) page |
| PR security checklist | **Your repository** — `.github/PULL_REQUEST_TEMPLATE.md` or equivalent |
| Checklist answers and review | **The pull request itself** |
| Repository hygiene checklist | **Your repository** or team wiki |
| Pre-commit hook config | **Your repository**, referenced in the README |
| Repo security onboarding | **Wherever you track onboarding** — no Orbit field yet |
| Dependency decision records | **The pull request**, or your ticket tracker |
| Metadata changes | **Orbit** — recorded automatically in version history |
| Threat model updates | **Orbit** — the [Threat Model tab](/docs/application-security) |

On 2.1: linking a repository is the highest-value single action in this phase. It's what turns Orbit from a place you maintain metadata by hand into one that reflects your actual codebase — detected languages and frameworks, a real dependency inventory, advisory checks. GitHub, GitLab, Bitbucket, and Azure DevOps are supported, and connecting your own account isn't admin-only. Once linked you can re-sync, switch repos, or unlink at any time.

Linking is also planned to become an optional shortcut into the next phase: having linked a repository, you'll be able to choose which security tools should cover the application and have Orbit either configure the integration itself or **open a pull request against your repository** with the pipeline changes. That's one of two supported ways to stand up your [CI Gate](/docs/phase-ci-gate) — the other is following the setup playbook and wiring it in yourself, which needs no write access to your repository and stays available regardless. Neither is going away; pick whichever fits how your company works.

On 2.7: most of this is automatic. Orbit records a version-history entry for metadata changes, tagged with whether the change came through the UI or the API. What isn't automatic is remembering to update the record when something structural changes — a new hosting domain, a new application you now interface with, a framework migration. The baseline asks for this within a few business days of ownership, repository, exposure, or data-classification changes.

## Done when

Continuous phase, so these are steady-state conditions — true at any moment:

- The repository is linked in Orbit and has synced within the last 30 days
- A PR security checklist exists in the repository and pre-fills on new pull requests
- A secrets pre-commit hook is installed and documented
- The default branch is protected and security checks are required, not advisory
- No advisory-flagged dependency is unaddressed and unjustified
- Catalog metadata matches reality — profile completeness at 100%
- The threat model's last review is no older than the last trust-boundary change

## How tiers change this

| | High | Medium | Low |
|---|---|---|---|
| **PR review** | Two reviewers on anything touching a security boundary | One reviewer | One reviewer |
| **AppSec consult** | Expected for any new trust boundary | On the author's judgment | On request |
| **Repo onboarding** | Required before first commit | Expected | Recommended |
| **Threat model updates** | On any boundary change | On significant change | Annually |

## How this maps to policy and maturity

### Baseline controls satisfied here

From [Policy Baseline](/docs/program-policy-baseline): **secure coding standards** (2.4, 2.5, 2.6 — the standard itself is the [Secure Coding Standard](/docs/lifecycle-secure-coding)), **security review on pull requests** (2.2, 2.3), and **segregation of duties** (2.3, with the deploy half in [phase 4](/docs/phase-release-deploy)). It also carries much of **application metadata maintained** (2.1, 2.7), shared with [Plan & Design](/docs/phase-plan-design).

### SAMM practices this is evidence for

From [SAMM & Maturity](/docs/program-samm): **Education & Guidance** (Governance) through repo onboarding and the champions network; **Secure Build** (Implementation) through dependency management and build hygiene; and **Security Requirements** (Design), since the PR checklist is where up-front requirements either get honored or quietly dropped.

## What your security team sees

| They see | Where |
|---|---|
| Whether a repository is linked, and when it last synced | The Integrations tab; the **Developer dashboard** surfaces applications with no repository or tool link at all, and applications with a repo recorded that has never synced |
| Repositories going stale | The **Program Operations dashboard** lists linked repos not synced in over 30 days |
| Your real dependency tree, with advisory flags | The [Dependencies](/docs/dependencies) page, searchable across the whole portfolio by package, application, or ecosystem |
| Detected languages and frameworks — the actual stack, not the self-reported one | The application record, populated from the repo |
| That metadata is being maintained rather than set once | Version history, with each change tagged UI or API |
| **Segregation of duties** — that changes are reviewed by someone who didn't write them | Your repository's branch protection, read from your source-control provider: required approver count, whether stale reviews are dismissed, whether administrators are exempt. Direct evidence rather than an assertion |
| Whether a PR security template exists in the repository | Read from the repository itself |
| Whether the threat model is being kept current | Threat model status and last-reviewed date |

**Where they're blind, and will have to ask you:**

- **Whether a PR security checklist exists, and whether anyone reads it.** The template is a file in a repository Orbit is already connected to, so Orbit reads it directly rather than taking your word for it — checking the standard locations and looking for a security section. Note the limit of that: detecting the file proves the template exists, not that anyone fills it in. Whether reviewers actually answer the questions is still something only your team knows.
- **Whether developers have been onboarded to the repo's security context.** No training or onboarding records anywhere.
- **Whether pre-commit hooks are installed.** These run on a developer's machine, so nothing outside it can confirm they're there. Self-reported, and likely to stay that way.
- **Whether the threat model is stale relative to the code.** Orbit stores the model's last-reviewed date and your deployment history but doesn't compare them — so a model approved eighteen months and four hundred commits ago looks identical to one reviewed last week. The scoring engine already does exactly this kind of comparison for scan freshness, so the mechanism exists; it just isn't applied here.

---

Around this phase: **[Phase 1 — Plan & Design](/docs/phase-plan-design)** before it, **[Phase 3 — CI Gate](/docs/phase-ci-gate)** after. See **[The Lifecycle](/docs/program-lifecycle)** for all six phases.
