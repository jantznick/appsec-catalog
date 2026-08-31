# Application Data Model — Exploration

Companion to `APP_DATA_FIXES_PLAN.md`, which covers the unambiguous defects. This
document covers the modelling questions: what should be merged, what should be split,
and what we are not collecting that an AppSec portal needs.

Nothing here is decided. Each section states what exists today, what the problem is,
the options with their costs, a recommendation, and the questions that need an answer
before code is written. Open questions are collected at the end.

---

## 1. Products, applications and repositories

### What exists

- `Application` carries `repoUrl` (string), `language`, `framework`.
- `ApplicationScmRepo` links an application to an `ScmRepo`. It is `@unique` on
  `applicationId` — one repo per application — but there is **no** unique constraint
  on the repo side, so one repo can already serve many applications.
- `ScmRepo` holds the structured language breakdown and the parsed `RepoDependency`
  list, refreshed from the provider.
- `Product` groups applications through `ProductApplication`, which carries a
  `componentType` (company-configurable) and a `customComponentLabel`.

### The problem

This repository is the worked example: one repo, two applications (backend,
frontend), one product. Structurally that already works. What does not work:

- **Dependency attribution.** Dependencies belong to the repo, so both applications
  show the entire monorepo's dependency list. The frontend's page lists the backend's
  npm packages, and vice versa. OSV advisories are attributed to both.
- **Language and framework are copied, not derived.** `POST /scm/apply` writes
  detected values into `Application.language` and `.framework` as free text. Two
  applications sharing a repo get the same values, and scoring reads only the copies —
  so an application with a linked repo and current language data can still score as
  missing both.
- **`repoUrl` is a denormalised duplicate** of the link, written by the link handler
  and editable independently.
- **Business facts are asked per application.** Business criticality, data
  classification, and ownership are asked once per application, so a two-application
  product asks the same manager the same questions twice and can end up with two
  different answers for one product.

### Options

**A. Scope the repo link to a path.** Add `subPath` to `ApplicationScmRepo`
(`backend/`, `frontend/`). Attribute dependencies and language detection to the path.
Small change, fixes attribution, does not address duplicated business facts.

**B. Move business facts up to Product.** Criticality, data classification, ownership
and lifecycle live on `Product`; `Application` inherits unless it overrides. Fixes the
duplicate-questions problem and matches how people actually think about the things
they own. Requires deciding what happens to applications with no product.

**C. Both.** Product is the unit of *business* assessment; Application is the unit of
*technical* assessment (repo + path, language, scan coverage, deployment, tooling).

### Recommendation

C, in that order — A first, because it is self-contained and immediately useful, then
B once the ownership model is settled (section 5).

The line I would draw: **if the answer would be the same for every application in the
product, it belongs on the product.** Criticality, data classification, ownership,
lifecycle, compliance scope. If it can differ between the frontend and the backend, it
stays on the application. Scan coverage, language, deployment cadence, tooling.

### Open questions

1. Should `Product` become mandatory, with a single-application product created
   automatically on intake? Inheritance needs a defined parent, and an optional parent
   means every consumer needs a null branch.
2. When an application overrides an inherited value, is that a first-class fact we
   surface ("this component is more sensitive than its product") or just an edit?
3. Does the portfolio score roll up to the product, and if so, is it an average or a
   worst-case? A monorepo currently double-counts in every company average.

---

## 2. Environments

### What exists

Three overlapping columns and no model:

| Field | Type | Means |
|---|---|---|
| `Application.serverEnvironment` | free text | where it is hosted ("cloud", "AWS", "on prem") |
| `Application.deploymentEnvironment` | free text | which stage ("prod", "staging") |
| `Deployment.environment` | free text | which stage, per deployment record |

Scan dates (`lastSastScanDate`, `lastDastScanDate`, `lastScaScanDate`), the WAF
fields, and `facing` are all single-valued on the application. `ApplicationDomain`
links a domain to an application with no indication of which environment it serves or
what it is for.

### The problem

The security question is almost never "is the application scanned". It is "is
**production** scanned, since production last deployed". Today:

- A DAST scan against staging and a DAST scan against production are the same date
  field.
- `staging.example.com` and `www.example.com` are indistinguishable rows in
  `ApplicationDomain`, so the DNS and web snapshots already being collected cannot say
  whether a finding is on a production hostname or a scratch one.
- WAF coverage is one boolean-ish pair for an application that may be behind a WAF in
  prod and directly exposed in dev.
- `facing` is one value for an application whose staging environment is internal and
  whose production environment is not.

### Options

**A. Environment as a company-scoped lookup**, referenced by `Deployment` and
`ApplicationDomain`. Cheapest. Gives canonical names instead of free text, and lets
domains say which environment they serve. Does not give per-environment posture.

**B. `ApplicationEnvironment` join** — one row per application per environment,
carrying scan dates, WAF coverage, facing, and hosting platform. Domains and
deployments attach to the join row rather than the application. This is the model that
answers the real question.

**C. Environment belongs to the Product**, with applications having a presence in each
product environment. Matches reality — "staging" is usually a whole-stack thing, not a
per-service thing — and pairs with section 1's split. Highest cost.

### Recommendation

B, with the environment record itself company-scoped so names are canonical (the
useful half of A). C is the more honest model but should wait until the product
question in section 1 is settled, because it depends on that answer.

Domains gain two fields in this model: which environment they serve, and what they
are — public site, API, admin interface, marketing, redirect. That second field is
what makes the existing DNS and web snapshot work actionable, since "no HSTS on an
admin interface" and "no HSTS on a redirect host" are different findings.

### The migration risk

Scoring, completeness and policy all read single-valued scan-date and tooling columns.
Splitting them per environment breaks every consumer at once. The safe path is to keep
the application-level columns as a **derived rollup** of the primary environment,
recomputed on write, so existing consumers keep working while new screens read the
per-environment rows. Retire the rollup columns only once nothing reads them.

### Open questions

4. Is the environment list fixed (dev / qa / staging / prod) or company-configurable?
   Configurable means policy controls cannot reference an environment by name without
   the same validation problem `fieldPath` has today.
5. Which environment is "primary" for the rollup — always production, or explicitly
   flagged? What happens to an application that has no production environment yet?
6. Do we want per-environment *findings* (Wiz, OSV) as well as per-environment scan
   dates? That is a much larger integration change and should probably be a separate
   phase.

---

## 3. Authentication as structured data

### What exists

`authProfiles` — one nullable string. The technical form asks "does it require special
access permissions?" and, if yes, a free-text box. The API concatenates them into
`"Requires special access permissions: <text>"`. If the answer is "no", the column is
left null, which the knowledge score reads as missing data — so answering the question
correctly and negatively costs the same points as ignoring it.

### The problem and the constraint

Free text cannot be reported on, and it is one of the eight knowledge-scoring fields,
so its emptiness is already penalised. But — as raised — the range of real answers is
enormous. Some applications have username and password and nothing else. Some have a
bespoke arrangement that no dropdown will ever describe. **A structured field that
forces a wrong answer is worse than free text**, because it looks authoritative.

### Recommendation

A small structured core, each dimension independently nullable, each with an explicit
"other" that carries its own free text, plus a notes field that is always available
regardless of what is selected.

| Field | Type | Notes |
|---|---|---|
| `endUserAuthMethod` | enum, nullable | password, sso_saml, sso_oidc, social, magic_link, none, other |
| `endUserAuthOther` | string, nullable | required when method is `other` |
| `mfaRequired` | enum, nullable | required, optional, none, not_applicable |
| `serviceAuthMethod` | enum, nullable | api_key, oauth_client_credentials, mtls, signed_request, none, other |
| `serviceAuthOther` | string, nullable | required when method is `other` |
| `authNotes` | text, nullable | always shown, never required |

Three rules that make this safe:

- **"None" is a real answer, not an empty one.** An application with no
  authentication should be able to say so and be scored as having answered.
- **"Other" is never a dead end.** Selecting it reveals a required text box, and the
  text is stored in its own column — not appended into the enum value. The existing
  `deploymentMethod` and `criticalAspects` handling does the latter, which is how
  `"Other: …"` ends up inside a comma-split list and corrupts the aspect count.
- **Notes are never gated.** Today the auth free-text box only appears if you answer
  "yes" to special access, so an application with ordinary auth and an unusual quirk
  has nowhere to write it down.

### The observed side

Uploaded OpenAPI schemas already carry `securitySchemes`, and `apiSchema.js` already
parses them. Once auth is structured, declared-versus-observed becomes a report: *this
application declares OIDC, its schema advertises an API key on every path*. That is
the kind of finding the portal exists to produce, and it is a small addition once the
columns exist.

### Open questions

7. Is authentication an application fact or an environment fact? Staging with a shared
   password and production with SSO is common. If it is per-environment, this depends
   on section 2.
8. Do we score structured auth at all, or only require it to be *answered*? Scoring it
   creates an incentive to claim SSO.

---

## 4. AI and third-party components

### What exists

Nothing, for catalogued applications. `AiConfig`, `AiRequest`, `AiModelPricing` and
`AiAccessRule` are infrastructure for **Orbit's own** AI features — the ledger that
attributes token spend to a company. They say nothing about whether a catalogued
application uses AI.

`RepoDependency` covers code dependencies from the repo. There is no record of SaaS
vendors, external APIs called, or model usage.

The threat model's component archetypes are `auth`, `payment`, `data_storage`,
`integration`, `admin`, `file_upload`, `messaging`, `other`. There is no AI archetype,
so an application whose main risk surface is an LLM gets no STRIDE prompts for it.

### The problem

"Which of our applications send data to a model, which model, and what data" is a
question this portal will be asked, and it currently cannot answer it at all. It is
also the question where the existing data model helps most, because the answer is
mostly a join between things we already have concepts for: an application, a data
classification, and a third party.

### Recommendation

Model it as a **component inventory** rather than an AI-specific table, with AI as one
kind of component. Third-party SaaS, external APIs and model usage are the same shape
of question — *what is it, who runs it, what data crosses the boundary* — and a
separate AI table would need all of that duplicated.

Sketch, `ApplicationComponent` (or `ApplicationEnvironment`-scoped, per section 2):

| Field | Notes |
|---|---|
| `kind` | `ai_model`, `saas_vendor`, `external_api`, `internal_service` |
| `name` | "Claude Opus 4.5", "Stripe", "internal-billing" |
| `vendor` | who operates it |
| `hosting` | `vendor_api`, `self_hosted`, `embedded`, `unknown` |
| `dataSent` | data classification keys (section 6) |
| `dataReceived` | data classification keys |
| `notes` | free text, always available |

Plus, for `kind = ai_model` specifically, the questions that actually change the risk:

- **What does the output do** — displayed to a user, used in an automated decision, or
  executed (tool use, code execution, agentic). This is the single biggest risk
  discriminator and nothing else in the model captures it.
- **Can an end user influence the prompt** — the prompt-injection surface.
- **Is there human review** before the output takes effect.
- **Training and retention terms** — whether the vendor trains on our data.

And add an `ai_model` archetype to `COMPONENT_ARCHETYPES` with STRIDE presets and
starter threats, so the threat modelling flow prompts for the right questions. That is
a small, self-contained change and probably the cheapest useful AI work available.

### Open questions

9. Is the component inventory declared by the team, derived from dependencies
   (`RepoDependency` can already spot `@anthropic-ai/sdk`, `openai`, etc.), or both?
   Derived-plus-confirm is the pattern that keeps the form short.
10. Does AI usage feed the risk weighting the way PCI/PII/PHI do today, or is it
    reported separately until we know what the distribution looks like?
11. Do we need this per-environment as well? A model in staging with synthetic data and
    the same model in production with customer data are different risks.

---

## 5. Ownership

Four ways to name a responsible party, none of them a user record:

- `Application.owner` — free text
- `Application.devTeamContact` — free text, and the form asks for "name, email, phone,
  etc." in one box
- `Contact` — a structured model with `name`, `title`, `email` and an application
  relation, referenced only by the seed script
- `ApplicationVersion.requesterEmail` — captured on every technical form submission

For a portal whose day-to-day job is chasing people, ownership should be a relation
with a role — technical owner, business owner, security champion — pointing at `User`
where one exists and falling back to a contact record where it does not. The
`Invitation` flow and the security champions concept in the platform docs are the two
ends of a join that does not exist yet.

Per section 1, ownership is probably a product-level fact.

### Open question

12. Do we require ownership to resolve to a `User` (which forces onboarding before an
    application can be complete), or allow an unregistered contact?

---

## 6. One data classification vocabulary

This underpins sections 2, 3 and 4, and is the highest-leverage merge available.

There are currently five vocabularies for "what sensitive data does this handle":

| Where | Vocabulary |
|---|---|
| Technical form checkboxes | PCI, PII, PHI |
| `config/scoring/riskFactors.json` | PII 1.2, PCI 1.5, PHI 1.3 |
| `services/threatModel.js DATA_TYPE_OPTIONS` | none, credentials, pii, payment, health, other_regulated |
| `config/scoring/sensitiveFields.json` | Credential, PII, Government Identifier, PCI, Financial, PHI, Tenant Identifier |
| `ProductDataFlow.dataClassification` | free string |

The first two agree by coincidence, not by construction. `DATA_TYPE_OPTIONS` is the
best starting point — it has keys, labels, and an explicit "none" — but it is missing
government identifier and financial account, which `sensitiveFields.json` already
knows how to detect in an uploaded schema.

Define one taxonomy with keys, labels, severity and a risk weight. Have intake, threat
modelling, the OpenAPI scanner, product data flows, the component inventory and
scoring all reference it.

The payoff is a workflow that is impossible today: the schema scanner already finds an
SSN field in an uploaded OpenAPI document, and the application record has no way to say
whether we declared it. Shared keys give declared-versus-observed drift for free.

### Open question

13. Is the taxonomy fixed or company-configurable? Fixed makes cross-company reporting
    and the risk weights meaningful. Configurable is more accurate per customer and
    makes the scoring config per-company too.

---

## 7. Application interfaces and data flows

`Application.interfaces` is a JSON array of application ids inside a `String` column,
with no foreign keys. `ProductDataFlow` models the same relationship properly — both
endpoints foreign-keyed, plus `flowName`, `dataClassification`, `protocol`,
`direction`, `requiresApiKey` and `notes`.

They are the same concept modelled twice, and the intake form populates the weaker one.
A flow between two applications is an application-level fact; a product is a view over
flows. Promoting the flow model down a level removes the JSON column, its silent
parse-failure handling, and the roughly 120 lines of parse-mutate-restringify
reciprocal-update logic in the update handler.

`ProductIngressPoint` has the same shape of problem: "this application is an entry
point and it requires an API key" is an application fact only recordable from inside a
product.

---

## 8. Lifecycle state

`Application.status` holds onboarding workflow state (`pending_technical`,
`onboarded`, and a `pending_executive` value the schema documents but nothing sets).
There is no lifecycle state — in development, live, deprecated, decommissioned.

A decommissioned application currently sits in every average, every compliance
denominator and every "missing SAST" report forever. This is cheap to add and removes
a whole category of noise from the dashboards.

Related: applications auto-created from a free-typed interface name are given status
`onboarded` with no data, so they count as fully onboarded applications with near-zero
scores. A `stub` lifecycle state keeps them out of averages until someone fills them
in.

---

## 9. Declared versus observed

Every field in the catalogue is self-reported, and the scorer assumes worst case when a
field is blank — which rewards a plausible guess over an honest gap.

Meanwhile the portal already ingests ground truth: Wiz findings, OSV advisories, repo
dependencies, DNS and web snapshots, deployment records, and uploaded API schemas.

Adding a provenance marker to the tooling fields — self-declared, observed-from-Wiz,
observed-from-repo — lets scoring weight verified data higher, and makes the most
valuable screen in an AppSec portal a single join away: *twelve applications claim SAST
at integration level 3; four of them have produced a finding in the last ninety days.*

---

## Open questions, collected

**Products and repos**
1. Should `Product` become mandatory, with a single-application product auto-created?
2. Is an application overriding an inherited product value a first-class fact?
3. Does portfolio score roll up to the product, and as an average or worst case?

**Environments**
4. Fixed environment list or company-configurable?
5. Which environment is "primary" for the rollup columns?
6. Per-environment findings, or only per-environment scan dates for now?

**Authentication**
7. Is auth an application fact or an environment fact?
8. Do we score structured auth, or only require that it be answered?

**AI and components**
9. Declared, derived from dependencies, or derived-and-confirmed?
10. Does AI usage feed risk weighting like PCI/PII/PHI, or report separately at first?
11. Per-environment component inventory?

**Ownership**
12. Must ownership resolve to a `User`, or may it be an unregistered contact?

**Classification**
13. Fixed taxonomy, or company-configurable?

---

## Suggested order

Independent of the answers above, the dependency order is fairly clear:

1. **Classification vocabulary** (section 6) — everything else references it, and it
   is a code change with no schema migration.
2. **Lifecycle state** (section 8) — small, self-contained, immediately removes
   dashboard noise.
3. **AI archetype in the threat model** (section 4) — small, self-contained, delivers
   AI value before the component inventory exists.
4. **Repo sub-path** (section 1, option A) — fixes monorepo dependency attribution.
5. **Environments** (section 2) — the largest change, and the one most other things
   want to depend on.
6. **Product-level business facts** (section 1, option B) — after ownership is settled.
7. **Component inventory** (section 4) — after classification and environments.
8. **Interfaces as flows** (section 7) — after products are settled.
