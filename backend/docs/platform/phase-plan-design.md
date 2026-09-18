# Phase 1 — Plan & Design

The first phase of [the lifecycle](/docs/program-lifecycle), and the one your team runs before there's code to review. Work through the items below, fill in the templates, and the phase is done — no security review needed to get started.

## Why this phase exists

Design flaws don't get caught by scanners. No static analyzer will tell you that your authorization model trusts a client-supplied tenant ID, that your password reset flow lets someone enumerate accounts, or that customer records are replicated into an analytics store nobody classified. Those are decisions, not bugs.

It's also the phase with the worst cost curve if you skip it. A missing severity gate takes an afternoon to add later. An authorization model that has to change after launch is a migration, a coordination problem across every consumer, and usually a conversation with someone's legal team.

## What triggers it

- A **new application or service**
- A **new high-impact change** — anything touching authentication, authorization, sensitive data flows, trust boundaries, or public exposure
- A **major architecture change** — splitting a monolith, changing data stores, moving between cloud providers
- A **new third-party integration**, especially one that sends or receives sensitive data
- An **acquired or inherited application** entering the program

Most Plan & Design work happens on the second bullet, not the first. New applications are rare; high-impact changes inside running applications are constant.

## Who does the work

Your team does nearly all of it. The split:

| | Who |
|---|---|
| Fills in the templates, records the data, builds the threat model | **Your dev lead** |
| Accountable for the record being accurate and the tier being right | **Your application owner** |
| Reviews the threat model, approves exceptions, confirms the tier | **Hearst's AppSec team** — you reach out |
| Often the first reviewer, and knows when to escalate | **Your security champion**, where your company runs the [Champions Program](/docs/program-security-champions) |

For a Low-tier internal tool this is one developer, half a day, working down this page. For a High-tier externally-facing application handling payment data, it's the same work plus a scheduled session with AppSec.

## The work

| # | Work item | Output |
|---|---|---|
| 1.1 | **Register the application in Orbit** | A catalog record: owner, business criticality, critical aspects, facing, data types, repository, hosting domains |
| 1.2 | **Determine your risk tier** | A tier — High, Medium, or Low — with the reasoning written down |
| 1.3 | **Write the security requirements** | A filled-in requirements block in your design doc |
| 1.4 | **Classify the data and map its flows** | Data types on the record; ingress points and data flows on the product |
| 1.5 | **Build the threat model** | An Orbit threat model: scope, actors, data types, and threats with mitigations |
| 1.6 | **Break out the high-risk components** | A component per high-risk area, each with its own threat list |
| 1.7 | **Get the design reviewed** | Review notes and decisions recorded, mitigations turned into tickets |
| 1.8 | **Choose secure-by-default patterns** | The patterns you're using, named in the design doc |
| 1.9 | **Plan your tooling coverage** | The SAST / secrets / SCA / DAST / firewall / API-security plan, recorded on the record now rather than discovered after launch |
| 1.10 | **File exceptions for anything you can't meet at launch** | An approved exception with a compensating control and an expiry date |

### 1.2 — Determine your risk tier

Score yourself against the four factors. **Highest single factor wins** — one High makes the application High tier.

| Factor | High | Medium | Low |
|---|---|---|---|
| **Data sensitivity** | PCI, PHI, credentials, or regulated personal data | Internal business data, limited PII | Public or non-sensitive |
| **Exposure** | Reachable from the public internet | Internal, or partner-restricted | Local or single-team |
| **Business impact** | Revenue-critical, or an outage is visible to customers | Degrades a workflow | Minor inconvenience |
| **Regulatory scope** | In scope for PCI DSS, HIPAA, SOX, GDPR obligations | Indirect scope | None |

<details>
<summary>Record your tier — copy this into your design doc</summary>

```markdown
## Risk Tier — <application name>

Tier: <High | Medium | Low>
Assessed by: <name>          Date: <YYYY-MM-DD>
Confirmed with AppSec: <yes | pending>

| Factor | Rating | Why |
|---|---|---|
| Data sensitivity | <H/M/L> | <e.g. stores cardholder data via Stripe tokens only> |
| Exposure | <H/M/L> | <e.g. public marketing site, no auth> |
| Business impact | <H/M/L> | <e.g. outage blocks all customer sign-ups> |
| Regulatory scope | <H/M/L> | <e.g. GDPR — EU customer personal data> |

Driving factor: <the one that set the tier>
Re-assess when: <trigger, e.g. "if we start storing card data directly">
```

</details>

Your tier sets how strict everything downstream gets — which severities block a merge in [CI Gate](/docs/phase-ci-gate), how often you re-assess, how deep this phase's review goes. Get it wrong low and you'll under-protect; get it wrong high and you'll burn your team's patience on ceremony. When in doubt, ask AppSec rather than guessing.

### 1.3 — Write the security requirements

Requirements are what's specific to *this* application. The properties every application has to hold — no back doors, no cleartext passwords, validated input, nothing extra shipped to production — are in the [Secure Coding Standard](/docs/lifecycle-secure-coding) and don't need restating here.

The most common failure here is writing "the application must be secure." A requirement is useful when it's specific enough that someone could build the wrong thing without it.

Weak: *"Handle authentication securely."*
Useful: *"All authentication goes through Okta OIDC. No local password store. Session cookies are `HttpOnly`, `Secure`, `SameSite=Lax`, expiring after 12 hours idle. Administrative actions re-prompt for authentication."*

<details>
<summary>Security requirements template — copy this into your design doc</summary>

Delete the sections that genuinely don't apply, and say why in one line rather than removing them silently — "No file upload in this application" is useful to a reviewer.

```markdown
## Security Requirements — <application name>

Risk tier: <High | Medium | Low>
Author: <name>               Date: <YYYY-MM-DD>

### Authentication
- Identity provider:                    <e.g. Okta OIDC>
- Local credential store:               <none | why one exists>
- Factors required:                     <e.g. SSO + MFA enforced at IdP>
- Session lifetime / idle timeout:
- Actions requiring re-authentication:
- Service-to-service auth:              <e.g. workload identity, mTLS>

### Authorization
- Roles:
- Where the decision is enforced:       <e.g. middleware on every route>
- Default for a new endpoint:           <deny | allow — should be deny>
- Tenant isolation enforced by:         <if multi-tenant>
- Who can grant privileges:

### Sensitive data
- What we collect:
- Where it's stored:
- Retention period:
- Encrypted at rest / in transit:
- Fields that must never be logged:
- Third parties it's shared with:

### Trust boundaries
List every point where data crosses from less trusted to more trusted,
and what validates it there.
| Boundary | What crosses | What validates it |
|---|---|---|
| <browser → API> | <user input> | <schema validation, authz check> |

### Secrets
- Where secrets live:                   <e.g. AWS Secrets Manager>
- How the app gets them at runtime:
- Rotation cadence and owner:
- Confirmed: no secrets in source or config files

### Logging and audit
- Security events we log:               <auth success/failure, authz denial,
                                         privilege change, data export>
- Where logs go, and retention:
- Who can read them:

### Third-party and supply chain
- External services this depends on:
- What data each one receives:
- What happens if one is compromised:
```

</details>

### 1.5 and 1.6 — Build the threat model

Orbit has a built-in threat model, so this one you do in the tool rather than a document. It's structured around four questions: **what are we working on, what can go wrong, what are we going to do about it, did we do a good job.**

The usual mistake is threat modeling the whole application at one level of detail, producing forty vague threats nobody acts on. Break out the high-risk parts as **components** and give each a short, specific threat list. Six good threats against your authentication flow beat forty generic ones against "the app."

Break out a component when a part of your application handles authentication, moves money, stores sensitive data, grants admin power, crosses an organizational boundary, or accepts uploaded files. Orbit has an archetype for each of those.

Two things Orbit does for you here: answering certain whole-application questions — that it handles payment data, say, or that privileged users interact with it — **automatically creates the matching component**, so your highest-risk area can't quietly go unmodeled. And where AI features are enabled for your company, **✨ Draft with AI** produces a first-pass draft (scope, actors, starter components, candidate threats) that you review and selectively accept. Treat it as a starting point that saves you the blank page, not as the model.

<details>
<summary>How to write a threat that's actually actionable</summary>

A threat is worth recording when it names an actor, an action, and an impact. "SQL injection" is a vulnerability class; it isn't a threat statement.

Format:

```
<actor> can <action> resulting in <impact>
```

Examples that pass:

- *An unauthenticated user can enumerate valid email addresses via the password-reset response, resulting in a target list for credential stuffing.*
- *A tenant admin can read another tenant's records by editing the `org_id` in the request body, resulting in a cross-tenant data breach.*
- *A compromised CI token can push an image to the production registry, resulting in arbitrary code execution in production.*

Then for each one, record in Orbit:

- **STRIDE category** — optional but useful for spotting whole categories you haven't considered
- **Mitigation** — what specifically stops it, not "validate input"
- **Status** — so an unmitigated threat stays visible rather than being lost in prose

Starter prompts by component type, if you're stuck:

| Component | Ask yourself |
|---|---|
| **Authentication** | Can someone enumerate accounts? Reset a password they don't own? Reuse a session after logout? Bypass MFA? Brute force without lockout? |
| **Authorization** | What happens if I change an ID in the request? Is a new endpoint denied by default? Can a user escalate their own role? |
| **Payment** | Can amounts or currency be tampered with client-side? Can a transaction replay? Who can issue a refund? |
| **Data storage** | What's readable by an operator? What's in backups? What's in logs that shouldn't be? |
| **Admin functions** | Is admin access separately authenticated? Is every admin action audited? Can admin reach production data directly? |
| **Integrations** | What do we trust from the partner? What happens if their credential leaks? Do we validate their responses? |
| **File upload** | Is type validated server-side? Where is it stored, and is it executable there? Is the filename sanitized? |

</details>

### 1.7 — Get the design reviewed

For **High tier**, a live session with Hearst's AppSec team. For **Medium**, send the requirements and threat model for async review. For **Low**, self-review against this page is enough.

<details>
<summary>Design review request template — send this to AppSec</summary>

```markdown
## Design Review Request — <application name>

Risk tier:            <High | Medium | Low>
Orbit record:         <link to the application in Orbit>
Target build start:   <date>
Requested format:     <live session | async review>

### What we're building
<2–3 sentences. What it does, who uses it.>

### What changed, if this is an existing application
<The high-impact change that triggered this review.>

### Links
- Security requirements: <link>
- Threat model: <in Orbit>
- Architecture diagram: <link>

### Specific questions we want answered
1. <e.g. Is token exchange between our API and the partner acceptable,
      or do we need mTLS?>
2. <e.g. Is 90-day retention defensible for these records?>

### Known gaps we're already aware of
<Anything you know isn't right yet — saves the reviewer finding it and
 tells them you're not hiding it.>
```

</details>

After the review, record the outcome — decisions, required mitigations, and anything explicitly accepted — on the application's App Timeline in Orbit, and **open a ticket for every required mitigation**. A threat model whose mitigations live only inside the threat model is a document; one whose mitigations are tickets is a plan.

### 1.9 — Plan your tooling coverage

Decide this now. The fields are on the application's [Security tab](/docs/application-security) from the moment the record exists, and filling them in during design is how you avoid discovering at release that nothing scans your dependencies.

<details>
<summary>Tooling plan — fill this in, then record it on the Security tab</summary>

```markdown
## Tooling Plan — <application name>

| Category | Tool | Integration level | Owner | In place by |
|---|---|---|---|---|
| SAST              | <e.g. Snyk Code>     | <0–4> | | |
| Secrets detection | <e.g. Gitleaks>      | <0–4> | | |
| SCA               | <covered by SAST? >  | <0–4> | | |
| DAST              | <e.g. Tenable WAS>   | <0–4> | | |
| App firewall      | <e.g. Fastly NGWAF, or N/A> | <0–4> | | |
| API security      | <tool, or N/A>       | <0–4> | | |
```

**Integration level** is how much of the tool Orbit can actually see, and it's what the score is built on: 0 none, 1 tool implemented but no data shared, 2 data shared over API, 3 dashboard and config access shared, 4 full-service partner — worth 0%, 25%, 50%, 75%, and 100% of that category's points. See [Scoring Methodology](/docs/scoring-methodology).

Mark a category **Not Applicable** where it genuinely doesn't apply (no API, no web surface to protect) — its points are redistributed across the categories that do apply, rather than counting against you.

</details>

### 1.10 — File exceptions for anything you can't meet at launch

Filing an exception is better than quietly not meeting a control, and it isn't a black mark — it's a decision made deliberately, with the risk written down and a date attached.

An acceptable one needs four things: a business justification, a compensating control, a named owner, and an expiry date. "Indefinite" isn't valid, and an expired exception has to be re-approved, remediated, or removed before your next release.

**[Exceptions](/docs/lifecycle-exceptions)** has the request template and the full rules. File yours with Hearst's AppSec team.

## Where the outputs go

| Output | Where |
|---|---|
| Application record | **Orbit** — [Applications](/docs/applications). Three ways in: the public onboarding pair, the in-app form, or CSV bulk import. See [Getting Started](/docs/getting-started). |
| Risk tier and rationale | **Your design doc** — no Orbit field yet. Tell AppSec your tier. |
| Security requirements | **Your design doc or ticket**, linked from the Orbit record |
| Data classification | **Orbit** — the application's data types |
| Data-flow map | **Orbit** — [product ingress points and data flows](/docs/products). With the threat model and API schema, this is the architecture documentation the policy requires |
| Threat model and components | **Orbit** — the [Threat Model tab](/docs/application-security) |
| Design review notes and decisions | **Orbit** — App Timeline |
| Mitigation tickets | **Your ticket tracker**, referenced from the threat model |
| Approved patterns used | **Your design doc** |
| Tooling plan | **Orbit** — the [Security tab](/docs/application-security) |
| Exceptions | **Filed with Hearst's AppSec team** — see [Exceptions](/docs/lifecycle-exceptions) |

**Together, 1.4, 1.5 and 1.6 are your architecture documentation.** The policy requires architecture documentation to be kept complete and current as part of an application's metadata — and the threat model's scope and actors, the product's ingress points and data flows with their protocols and data classifications, the API schema, and the recorded interfaces between applications are exactly that. Because they live in Orbit rather than in a diagram someone exported once, keeping them current is a matter of updating the record rather than remembering a separate document exists.

Orbit can see that those records exist; it can't judge whether they're complete and current. That's a call a person makes when your application is reviewed, so expect this one to come back as needing verification rather than as an automatic pass.

On 1.4: ingress points and data flows are the most underused feature in Orbit relative to how much they help a design review. Once a product has two or more applications mapped in, you can record where external traffic enters (with the channel, and whether it needs an API key) and how data moves between the applications behind it (protocol, data classification, direction). That's your attack surface documented in one place instead of scattered across notes. See [Products](/docs/products).

## Done when

- The application exists in Orbit, with profile completeness at or above the threshold for your tier
- A risk tier is assigned, with its reasoning written down
- Security requirements are filled in and linked from the record
- The threat model's status is at least `in_review` — `approved` for High tier — with a named reviewer
- A component exists for every high-risk area the application actually has
- Every mitigation the threat model calls for exists as a ticket
- Anything that can't meet the baseline at launch has an approved, unexpired exception

## How tiers change this

| | High | Medium | Low |
|---|---|---|---|
| **Threat model** | `approved` before build; a component for every high-risk area | Required; `in_review` is enough to start building | Whole-application level |
| **Design review** | Live session with AppSec | Async review | Self-service, against this page |
| **Requirements** | Full template, every section | Template, summarized | Auth, data, and boundaries at minimum |
| **Re-review** | On any trust-boundary change | On significant change | Annually, or on major change |

## How this maps to policy and maturity

### Baseline controls satisfied here

From [Meeting the Policy](/docs/program-policy-baseline): **application metadata maintained** (1.1), **risk tier assigned** (1.2), **security requirements defined** (1.3), and **threat modeling for high-risk features** (1.5, 1.6).

### SAMM practices this is evidence for

This phase is where the whole **Design** function from [SAMM](/docs/program-samm) gets its evidence — **Threat Assessment** (the model and its components), **Security Requirements** (defined by risk rather than left implicit), and **Security Architecture** (patterns chosen deliberately). It also feeds **Policy & Compliance** under Governance, through exceptions being tracked rather than informal.

## What your security team sees

When you've done the above, here's what Hearst's AppSec team can confirm by logging into Orbit — without asking you for anything:

| They see | Where |
|---|---|
| Threat model exists, its status, and who reviewed it | The application's Threat Model tab; the **Application Owner dashboard** tracks how many applications have a threat model *started* versus *approved* |
| Every high-risk area has its own component | The Threat Model tab, component list |
| Your metadata is complete and current | Profile completeness on the record; the **Program Operations dashboard** lists applications below 100% and applications never reviewed |
| Your attack surface is documented | Product ingress points and data flows |
| Your tooling plan is real | The Security tab's tool and integration-level fields, and the Tool Usage half of your [score](/docs/scoring-methodology) |
| You're meeting the applicable controls | The Infosec Policy Compliance tab, control by control, showing which field drove each pass or fail |

**Where they're still blind, and will have to ask you:**

- **Your risk tier.** No field for it yet, so nothing downstream can key off it automatically — Orbit derives an internal importance weighting from your criticality, facing, and data types for scoring purposes, but there's no confirmed tier on the record. Until there is, your tier lives in your design doc and in AppSec's notes.
- **Your security requirements.** No structured home, so they can't tell a thorough requirements set from an empty one.
- **Your design review outcome.** The threat model's reviewer field is the closest thing to a recorded sign-off; there's no review request or approval workflow.
- **Your exceptions.** Filed with the AppSec team rather than in Orbit. The administrator-set **manual override** on a policy control is a different thing — it marks a control that can't be evaluated from catalog data, and carries no expiry, owner, or compensating control.

Each of those is a place where a phase that's going fine still looks ambiguous from the outside, and each is on the platform roadmap.

---

Next in the lifecycle: **Phase 2 — Build & Commit**, where the design turns into code. See **[The Lifecycle](/docs/program-lifecycle)** for all six phases.
