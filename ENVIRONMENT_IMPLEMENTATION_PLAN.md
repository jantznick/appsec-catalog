# Environment Implementation Plan

## Overview

Environments were implied by three unrelated free-text fields (`Application.serverEnvironment`, `Application.deploymentEnvironment`, `Deployment.environment`) with nothing tying them together. This plan makes an environment a first-class entity sitting between `Application` and `Domain`, so a deployed instance — "Orbit Backend in production" — is a thing the catalog can name, attach a domain to, and point a Wiz tag at.

The driver is Wiz tagging. Resources are tagged with `Product`, `Application`, `Environment` and `Role`, and the catalog had nowhere to put the `Environment` half — no way to say which deployed copy a domain, a version or a tagged resource belonged to. (Those four were once planned as a composite key; Phase 4 explains why they became a filter instead.)

**This document is the specification.** Work not described here does not get done, and context not recorded here is not available to whoever picks this up.

---

## The vocabulary model

Read this before anything else. An earlier revision of this document described an **open** vocabulary — one `Environment` row per distinct string a company had ever deployed to. That is not the model.

**Orbit owns the taxonomy. Companies own the words.**

- Orbit defines five kinds: `PRODUCTION`, `STAGING`, `QA`, `DEVELOPMENT`, `OTHER`. These are ours, they are ranked by importance, and they are what all cross-company reporting speaks.
- A company maps its own vocabulary onto them in a settings screen: *"our PRODUCTION is called `productionIsAwesome`, our STAGING is called `Sorta Important`."*
- An `Environment` row **is** that mapping. `kind` is ours; `name` is theirs.
- A company has **at most one row per kind**, except `OTHER`, which it may have as many of as it likes.
- Nobody changes their tagging schema to suit Orbit. Orbit adapts to them.

The consequence that makes everything else simple: **"the company's production environment" is always exactly one row, or none.** No tie-break, no heuristic, no stored "which one is the real one" flag.

**Orbit names four of the five kinds.** A company's production environment is called `production` in Orbit however its pipelines spell it, so cross-company screens read consistently instead of showing eighteen words for the same thing. Only `OTHER` takes a typed name, because it is the only thing telling a sandbox from a demo.

What the company owns is the **match list**: every string its pipelines actually send. Those live one-per-row in `EnvironmentName`, canonical included, unique per company. A pipeline sending `prod-us` resolves in one indexed lookup. Nobody changes a tagging schema.

---

## Status

Phases 1 and 2 are **built and on main** (PR #33). **Phase 3 is built on this branch and not yet merged** — its migration has been dry-run against dev inside a rolled-back transaction but not applied. Phases 4 and 5 are not started.

### Built in Phase 3 (this branch)

- `EnvironmentName`, one row per accepted string, with `@@unique([companyId, value])`; and the partial unique index on `(companyId, kind)` excluding `OTHER`
- `resolveEnvironmentForDeployment` is one indexed lookup on `(companyId, value)` — no inference, no auto-create
- Alias-union and single-slot validation in `routes/environments.js`, with change-history recording
- `services/environmentValues.js` — the read resolver, which throws on an unloaded relation
- `ENVIRONMENT_VALUE_INCLUDE` spread into `SCORING_INCLUDE` and the five other completeness call sites, plus the policy-compliance endpoint
- A second guard in `countFieldSet`: a Prisma row that loaded the relation but skipped the resolver throws instead of silently counting a gap
- `routes/applicationEnvironments.js` — instance CRUD, with no primary endpoint (primary is derived)
- Default production instance seeded on application create, single and bulk
- `currentVersion` / `gitBranch` / `deploymentEnvironment` dropped; registry entries kept with `source: 'environment'`
- `onDelete: Cascade` → `SetNull` on both instance relations
- `Environment`, `ApplicationEnvironment` and `Deployment` in `TRACKED_FIELDS`
- The read-time deployment fallback in `GET /applications/:id` deleted, and both only-when-null deploy backfills with it
- Split clones environment instances to the new application
- Frontend: Deployment Environments settings screen, per-application Environments card
- `docs/openapi.json`: the three fields removed from request bodies, response descriptions corrected, the removed backfill prose rewritten, and all nine environment endpoints documented
- Tests: `environmentValues.test.js` (23) and `environmentNaming.test.js` (new); suite at 220 passing

### Built earlier (Phases 1–2)

- `Environment` and `ApplicationEnvironment` models, and migration `20260922120000_add_environments` with its backfill
- `20260922130000_application_name_key_trim`, which tightens the application-name index
- `services/environmentResolver.js`, with both deployment write paths going through it — `routes/deploymentTokens.js` (CI) and `routes/applications.js` (manual entry)
- `routes/environments.js` CRUD for the vocabulary, behind the `environment.manage` permission
- Real environment names in the CI sample payload on the deployment-token screen
- The "Unassigned" bucket in deploy history, showing the raw submitted string

### Measured

Both migrations **are applied** to the dev database (`prisma migrate status` reports the schema up to date). The backfill ran cleanly. Measured on dev, 91 applications across 18 companies:

| | |
|---|---|
| `Environment` rows | 17 — **all `kind = PRODUCTION`**, one per company for 17 of 18 |
| Companies with two rows of the same kind | **0** — the partial unique index below applies cleanly |
| `ApplicationEnvironment` rows | 91 — exactly one per application |
| Deployments | 4, all linked, **0 unassigned** |
| Domains re-homed | 46 / 46 |
| Applications carrying a `currentVersion` | 1 — the same count as instances carrying one |
| Applications carrying a `gitBranch` | **0 of 91** |

No duplicate application names exist under `lower(btrim(name))`, so the tightened index applies cleanly.

`gitBranch` being zero everywhere matters: the dashboard's `branchWithSecurityData` metric (`routes/dashboard.js`) reads `application.gitBranch || repo.defaultBranch`, so today it runs entirely off the repo's default branch. Moving `gitBranch` to the instance moves no number.

Measurements are from dev, 2026-10-01. Prod is expected to be near-identical.

### The state to understand before testing

**The model is live but nothing is using it.** Every environment came out `PRODUCTION`, so no application has a second one. The per-application selector is hidden on all 91, no Unassigned bucket has contents, and none of the multi-environment behaviour has data to exercise.

Note that creating a second `Environment` row by hand is **not sufficient** to see any of it: nothing creates an `ApplicationEnvironment` instance except an actual deploy, so the vocabulary row will exist and no application will be in it. Phase 3's instance CRUD is what makes the feature testable at all.

### Dual-write / single-read

`Application` remains the read path for everything. Per-environment copies exist but nothing reads them:

| Field | Written to `Application` | Written to `ApplicationEnvironment` |
|---|---|---|
| `currentVersion` | yes | yes, by the resolver |
| `gitBranch` | yes | yes, by the resolver |
| `lastDastScanDate` | yes | copied once by the backfill; nothing writes it since |
| `deploymentEnvironment` | yes | never — it is replaced by the relation |

---

## Decisions

Settled. Not open for re-litigation during build.

### The model

1. **An environment is an instance, not a label.** `Application` mixes logical facts (name, owner, repo, language, criticality) with facts about a particular running copy. The latter belong to the instance.
2. **Two tables, not one.** A company-scoped `Environment` vocabulary plus an `ApplicationEnvironment` instance row. The vocabulary makes "production" mean one thing per company and gives Wiz tag values something to validate against; the instance holds the per-copy data.
3. **Five kinds, one slot each, except `OTHER`.** `PRODUCTION | STAGING | QA | DEVELOPMENT | OTHER`. A company has at most one row of each of the first four and unlimited `OTHER` rows. Enforced by a partial unique index. This is what makes lookup-by-kind total.
4. **Names are the company's, kinds are ours.** `name` is free text and is what the company actually tags and deploys with. `kind` is canonical and is what cross-company reporting counts.
5. **`Environment.name` is a label, never a key.** Nothing matches on it. Every match is an `EnvironmentName` row, so a company with inconsistent pipelines never has to fix them all before the catalog works.

   The label is the lower-cased kind for the four named kinds, and for `OTHER` it is **the first string in that environment's own list** — there is no separate name to type, because for `OTHER` the label and the first thing its pipelines send were always the same string asked for twice. The column exists because a dozen places need one string: "Deployed to X", the CI sample payload, a dropdown entry.
6. **No inference at resolve time, ever.** A submitted string matches an `EnvironmentName` row, or it goes to Unassigned. `inferEnvironmentKind` survives only as a seed-time default and as a suggested value in the settings UI. It never attaches live data. A typo must surface, not be guessed at.
7. **Unmatched strings do not auto-create environments.** They land in the "Unassigned" bucket. A phantom row from one typo'd pipeline yaml would otherwise appear in the environment selector and the Wiz tag picker as though it were real. Triage is how a real new string becomes an alias.
8. **Environments have an active/retired status, at both levels.** A retired environment keeps its deploy history and its Wiz tag without cluttering pickers. **Active means the instance is active *and* its vocabulary row is active** — one rule, stated once, so retiring a company's whole UAT environment does not leave stale instances counting as live.
9. **Domains attach to the environment, not the application.** `app.hearst.com` and `staging.app.hearst.com` are otherwise indistinguishable to the DNS and web-snapshot machinery.
10. **No mirror or derived columns on `Application`.** Per-environment values are resolved at read time.

### Which fields move

11. **Two fields move** to `ApplicationEnvironment`: `currentVersion` and `gitBranch`. A third, `deploymentEnvironment`, is **deleted rather than relocated** — its only job is recording which environment a row describes, and that becomes the relation.
12. **`lastDastScanDate` does not move in this work.** See *Deferred: where DAST lives* below. The column on `ApplicationEnvironment` already exists and stays unused; the live value stays on `Application` and its existing editor keeps working untouched.
13. **`lastSastScanDate` and `lastScaScanDate` stay on `Application`** — SAST scans a codebase, SCA a dependency manifest, both properties of the repo at a commit and identical across environments. So do `serverEnvironment` and `deploymentType`.
14. **The moved fields leave the version system but not the field registry.** They become `versioned: false` and their columns drop, but their registry entries **stay**, carrying a new `source: 'environment'` flag. Deleting the entries would break both policy authoring and completeness — see *Why the registry entries stay*.

### Primary

15. **Primary is derived, not stored. There is no `isPrimary` flag.** An application's primary environment is the one whose `kind` is `PRODUCTION`. Because decision 3 guarantees at most one `PRODUCTION` row per company, this is deterministic rather than a heuristic — which is what an earlier revision of this document was worried about when it specified a stored flag.
16. **An application with no `PRODUCTION` environment has no primary. Nothing slides up.** Staging is never promoted. A company that genuinely considers its staging environment to be production should set that row's kind to `PRODUCTION`, which is a one-click answer in settings.
17. **"No production environment" is not flagged yet.** It is a real gap and we will want to surface it, but not in this work. It surfaces indirectly and adequately for now: `currentVersion` resolves from the primary, so an application without one reads null and counts as an unfilled completeness field through the ordinary path. No special-case code.

### Scoring

18. **Scoring's logic is not modified.** The read resolver attaches per-environment values onto the application object under the same property names, so dynamic dereferences keep working. `SCORING_INCLUDE` gains the relation — the include widens, the arithmetic does not change.
19. **`currentVersion` is the only scoring input that moves,** and only through completeness (`FIELD_SETS.metadata`). Measured: applications carrying a version and instances carrying one are both 1 on dev, so the resolver moves no completeness percentage and no knowledge score. `gitBranch` and `deploymentEnvironment` are in no completeness set and scoring never reads them.

### Compliance

20. **Environment separation lands as `verification_required`, satisfiable by attestation.** The model can evidence that environments **exist**; it cannot evidence that they are **isolated**, and no isolation signal is planned. Distinct domains per environment (available now) and distinct Wiz tags per environment (after Phase 4) are partial evidence behind a human check; neither upgrades the control to a pass.

### Naming

21. **`serverEnvironment` is a hosting platform, not a deployment environment.** The demo import CSV carries `Server Environment` = "Cloud (AWS)" with `Facing` = "External" as a separate column. It is load-bearing in knowledge scoring, in company-level defaults on `Company`, and in the threat-model AI prompt. Removal is off the table. Renaming it to `hostingPlatform` is correct and is **deferred** — roughly 20 files, and it should not ride inside this refactor.
22. **Company settings will show `Company.serverEnvironment` beside an Environments section.** Label the latter "Deployment Environments" to keep the two apart.

---

## Goals

- An application can have several environments, each with its own domain(s), current version, git branch, and Wiz tag.
- A company maps its own environment vocabulary onto Orbit's five kinds once, in settings, and both CI deploys and Wiz tags resolve through it.
- An application page shows the Wiz resources powering it — its own and the shared ones — filtered by the company's folder and the tag values assigned to its product and itself.
- CI pipelines are told the valid environment names up front, and a mismatch is visible rather than silent.
- Scoring and completeness keep working, with no behavioural change at all.

## Non-Goals

- **Where DAST lives.** Deferred as one piece — see the dedicated section below.
- **Findings and export pipeline changes.** The Wiz tag is identity. What the export service does with it is separate work. (`wizFor` in `services/securityFindingsExportService.js` ignores `tagValue` entirely and filters only by folder — a pre-existing gap this plan neither introduces nor fixes.)
- **Per-environment scoring.** One score per application.
- **CI scan-date reporting.** Nothing writes scan dates from a pipeline today and this plan does not add it.
- **The `hostingPlatform` rename.** Decision 21.
- **Flagging applications with no production environment.** Decision 17.

---

## Data Model

### `Environment` — company vocabulary

```prisma
model Environment {
  id           String                   @id @default(cuid())
  companyId    String
  company      Company                  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  /// The canonical name: what Orbit displays and what the CI sample payload tells a
  /// new pipeline to send. DERIVED from `kind` for the four named kinds, typed by
  /// the company only for OTHER. Mirrored as the canonical row in `names`.
  name         String
  /// PRODUCTION | STAGING | QA | DEVELOPMENT | OTHER — ours, canonical.
  kind         String
  names        EnvironmentName[]
  description  String?
  status       String                   @default("active") // active | retired
  displayOrder Int                      @default(0)
  sourceLabel  String?                  // original free text this row was seeded from
  applications ApplicationEnvironment[]
  deployments  Deployment[]
  createdAt    DateTime                 @default(now())
  updatedAt    DateTime                 @updatedAt

  @@unique([companyId, name])
  @@index([companyId])
  @@index([companyId, kind])
  @@index([status])
}
```

**One row per kind per company, except `OTHER`.** Prisma cannot express a partial index, so it is hand-written, the same way the application-name index is:

```sql
CREATE UNIQUE INDEX "Environment_companyId_kind_key"
  ON "Environment"("companyId", kind) WHERE kind <> 'OTHER';
```

Verified against dev before adding: no company currently has two rows of the same kind.

`sourceLabel` preserves whatever free text the row was migrated from, so a bad seed can be cleaned up later without losing what the data originally said.

### `EnvironmentName` — every string that resolves

```prisma
model EnvironmentName {
  id            String      @id @default(cuid())
  companyId     String      // denormalised so uniqueness is company-wide
  environmentId String
  environment   Environment @relation(fields: [environmentId], references: [id], onDelete: Cascade)
  value         String      // normalised: trimmed, lower-cased
  isCanonical   Boolean     @default(false)
  createdAt     DateTime    @default(now())

  @@unique([companyId, value])
  @@index([environmentId])
  @@index([companyId])
}
```

**Why a table and not a column.** These were briefly comma-packed into `Environment.aliases`, which a database cannot index into: `@@unique` on it would only have stopped two rows holding the byte-identical whole string, so `prod` could belong to two environments and nothing would complain. Uniqueness had to be a hand-written check in the route, and any writer that forgot to call it punched straight through to a value that resolved differently on different days. One row per value makes the constraint real.

**Why the canonical name is in here too.** It closes the last gap. With names in one column and aliases in another, nothing stopped one environment's *name* equalling another's *alias* — those were two constraints over two columns. With everything in one table, one index covers the whole match space: naming an `OTHER` `production` when that is already the production environment's canonical name simply fails, in Postgres, with no application code involved.

The cost is one denormalised `companyId` and keeping the canonical row in step with `Environment.name` on rename, both confined to `routes/environments.js`. In exchange, resolution is a single indexed lookup rather than fetching a company's environments and comparing in JS.

### `ApplicationEnvironment` — the instance

```prisma
model ApplicationEnvironment {
  id            String      @id @default(cuid())
  applicationId String
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  environmentId String
  environment   Environment @relation(fields: [environmentId], references: [id], onDelete: Restrict)
  status        String      @default("active") // active | retired

  currentVersion   String?
  gitBranch        String?
  /// PRESENT BUT UNUSED. The live value stays on Application until the DAST work
  /// lands — see "Deferred: where DAST lives". Nothing reads or writes this.
  lastDastScanDate DateTime?

  domains   ApplicationDomain[]
  toolLinks ApplicationToolLink[]
  createdAt DateTime            @default(now())
  updatedAt DateTime            @updatedAt

  @@unique([applicationId, environmentId])
  @@index([applicationId])
  @@index([environmentId])
  @@index([status])
}
```

`onDelete: Restrict` on the environment relation is deliberate — deleting a vocabulary row that instances still reference should fail loudly, not cascade away deploy history.

No `isPrimary` column. Primary is `kind === 'PRODUCTION'`, per decision 15.

### `Deployment`

```prisma
  environmentId  String?      // nullable: unmatched strings land here as null
  environmentRef Environment? @relation(fields: [environmentId], references: [id], onDelete: SetNull)
  environment    String       // KEEP: the raw string as submitted, for audit
```

The free-text column stays. When a pipeline sends `Production ` with a trailing space, or an environment is renamed later, the original submission is still recoverable. Nullable FK plus retained string is what makes the Unassigned bucket possible.

Note that `Deployment` points at `Environment`, **not** at `ApplicationEnvironment`. "This instance's deployments" is therefore a query on `applicationId` + `environmentId`, not a relation walk.

### `ApplicationDomain` and `ApplicationToolLink`

Both gained a nullable `applicationEnvironmentId`. **Neither has a write path that maintains it** — the backfill re-homed domains once and nothing has touched either since.

**Both relations are `onDelete: Cascade` and both are wrong.** This is a live bug on main, not something this plan introduces:

```prisma
applicationEnvironment ApplicationEnvironment? @relation(..., onDelete: Cascade)
```

Deleting an `ApplicationEnvironment` deletes the whole `ApplicationDomain` row — unlinking the domain from the **application**, not merely from the environment. `applicationId` is deliberately kept on that row because `routes/domains.js` reads through it, and the schema comment says so two lines above the relation. The same shape on `ApplicationToolLink` means deleting an instance silently drops its Wiz tag link, which contradicts decision 8.

Retiring an instance is safe, because it is a status change. Hard-deleting one is not — and Phase 3's instance CRUD is exactly what starts doing that. **Both become `SetNull`, in Phase 3, before any delete path ships.**

### Application-name uniqueness — correcting this document

Earlier revisions of this plan said to add `@@unique([companyId, name])`. **That is not what shipped, and the difference matters.** What exists is a functional unique index:

```sql
CREATE UNIQUE INDEX "Application_companyId_lower_name_key"
  ON "Application"("companyId", lower(btrim("name")));
```

`schema.prisma` deliberately does *not* declare `@@unique`, with a comment explaining why: a plain Prisma constraint is case- and whitespace-sensitive, while `applicationNameKey()` in `services/applicationNames.js` folds with `trim().toLowerCase()`. A case-sensitive constraint would disagree with the split endpoint's own conflict check. The migration carries a `DO` block that counts collisions and raises a readable error rather than failing as a raw index violation. **Keep the index expression and `applicationNameKey()` in step.**

---

## Why the registry entries stay

Deleting a field's entry from `APPLICATION_METADATA_FIELDS` is not the same as dropping its column, and conflating the two breaks three things. This is the single most load-bearing implementation note in the document.

**Two independent lists decide whether a user can build a policy on a field:**

- **The picker** — `routes/config.js` has its own hand-written `availableFields` array (`path`, `label`, `category`, `allowedOperators`, `valueType`) which populates the dropdown in the control editor.
- **The validator** — `services/policyFields.js` rejects any `fieldPath` that is not in the field registry or in a small relation allowlist.

Failure shapes:

| Action | Result |
|---|---|
| Delete from the registry only | Field still in the dropdown; saving fails with *"is not an application field"*. A dead option in the UI. |
| Delete from both | Field silently vanishes from the dropdown. Nobody can write a policy about it again, with no error to explain why. |
| **Keep both, move the storage** | Field stays pickable, saves fine, resolver supplies the value under the same name, engine evaluates it unchanged. |

**And completeness has the same requirement.** `findUnknownFieldsInSets()` in `services/completeness.js` throws for any field in `FIELD_SETS` that is neither a registry field nor a declared pseudo-field, and the tests pin it. `currentVersion` stays in `FIELD_SETS.metadata`, so its registry entry has to stay too. `getMetadataFieldLabel` would also degrade to the raw key in missing-field lists.

**So:** keep the entries, add `source: 'environment'`, set `versioned: false`. `VERSIONED_METADATA_FIELDS` derives from `versioned`, so the snapshot columns still drop cleanly and `applicationVersionColumns.test.js` still guards the removal. The registry keeps doing the job it was built for.

A related limit worth knowing: dot-notation field paths (`environments.kind`) pass validation on *shape alone* and then silently never match, because `withEvaluableRelations` in `services/policy.js` does not know the relation. **Environment structure is therefore not policy-targetable** — only the values the resolver flattens onto the application. Registering the relation is possible later; it is not in this work.

---

## Migration Plan

`prisma migrate dev` fails against the shadow database in this repo. Use `prisma migrate diff` to generate SQL, then `prisma migrate deploy`.

Steps 1–5 are **done and applied**:

1. ~~Create `Environment` and `ApplicationEnvironment`; add nullable FKs to `Deployment`, `ApplicationDomain`, `ApplicationToolLink`.~~
2. ~~Seed the vocabulary from distinct `Deployment.environment` values per company.~~
3. ~~Seed one default instance per application.~~
4. ~~Backfill the FKs and copy the fields onto the default instance.~~
5. ~~Tighten the application-name index.~~

Remaining:

6. **Add `EnvironmentName`** with `@@unique([companyId, value])`, backfill it from the names and the old comma column, move each canonical name onto its kind's word keeping the previous one as an alias, and add the partial unique index on `(companyId, kind)`.
7. **Change `ApplicationDomain.applicationEnvironmentId` and `ApplicationToolLink.applicationEnvironmentId` to `onDelete: SetNull`.**
8. **Drop `currentVersion`, `gitBranch` and `deploymentEnvironment`** from `Application` and from the `ApplicationVersion` snapshot.

There is **no `isPrimary` migration step.** An earlier revision had one; decision 15 removes it, along with its partial unique index and its backfill.

---

## Phase 3 — Field Migration, Read Resolver, Instance CRUD

The registry gate is **cleared**: `services/applicationFields.js` is on main. The `versioned` / `approvable` / `splittable` flags are the control surface for the field moves.

The column drop is **one commit**. A half-done removal is the failure mode: a field missing from the diff list is invisible in version history, and one missing from the apply list is silently discarded on approval. Neither raises an error.

### Acceptance criteria

1. **`EnvironmentName` exists and resolves.** `resolveEnvironmentForDeployment` is a single lookup on `(companyId, value)`, returning null otherwise. No inference, no kind fallback. Uniqueness is the database's job, not a route's.

2. **A read resolver attaches per-environment values onto the application object under the same property names,** so dynamic dereferences (`app[scanField]` in `services/scoring.js`, and `routes/applications.js`) keep working.
   - `currentVersion` — from the **primary** environment, i.e. the active instance whose environment's `kind` is `PRODUCTION`. Null when there is none.
   - `gitBranch` — same rule. Measured at 0 of 91 applications today, so nothing visibly moves.
   - *Active* means the instance's status is active **and** its environment's status is active.

3. **The resolver throws when the relation is not loaded.** Prisma returns `undefined` for a relation that was never `include`d and `[]` for one that was included and is empty. Those two states mean completely different things and look identical if you only check for a missing value:
   - `undefined` → **throw.** A query forgot its include. Reporting a data gap here would mean the same application scores differently depending on which endpoint you hit, which is exactly how finding E5 shipped (one of four scoring call sites omitted `apiSchema` and silently zeroed a category).
   - `[]`, or no `PRODUCTION` instance → resolve to null, which flows through the ordinary completeness path as an unfilled field.

4. **Every call site loads the relation.** `SCORING_INCLUDE` in `services/scoring.js` gains it — the include widens, the arithmetic does not change. Beyond that there are **five other `calculateCompleteness` / `countFieldSet` call sites**, none of which use `SCORING_INCLUDE` and each of which is a chance to forget:
   - `routes/dashboard.js`
   - `routes/admin.js`
   - `routes/applications.js` (two)
   - `utils/portfolioCompleteness.js`

5. **`currentVersion` stays in `FIELD_SETS.metadata`,** reading from the primary. It is not dropped. Measured: instances carrying a version and applications carrying one are both 1 on dev, so a resolver moves no completeness percentage and no knowledge score. Dropping it instead would shift every number in the portfolio.

6. **Registry entries stay, with `source: 'environment'` and `versioned: false`.** `routes/config.js availableFields` is updated in the same commit so the picker and the validator agree. See *Why the registry entries stay*.

7. **The three columns are dropped** from `Application` and `ApplicationVersion`, and `services/applicationVersionColumns.test.js` passes. It asserts in both directions — a versioned registry field with no snapshot column, and a snapshot column with no registry entry — and is the guard against a half-done removal.

8. **Instance CRUD exists.** There is currently **no way to attach an application to an environment except by deploying to it**, which is why a hand-created vocabulary row produces no visible change. Phase 3 adds routes to attach an application to one of its company's environments, edit an instance's fields, retire one (writing `ApplicationEnvironment.status`, which nothing writes today), and delete one. Behind `environment.manage`.

9. **New applications seed a default instance.** On create: find or create the company's `PRODUCTION`-kind environment, then create an empty `ApplicationEnvironment` pointing at it. No values, just structure. Without this, every application created after the migration has zero environments — the migration seeded the existing 91 and nothing maintains the invariant going forward.

10. **The two `onDelete: Cascade` relations become `SetNull`** before any instance-delete path ships. See the data-model section.

11. **`TRACKED_FIELDS` in `utils/changeHistory.js` gains `Environment`, `ApplicationEnvironment` and `Deployment`.** None are there today, so the moved fields would lose what change-history coverage they have, and a re-kind — which silently changes what cross-company production reporting counts — would leave no trail. Note that the deploy write paths do not call `recordChange` at all; provenance for a CI-written value comes from the `Deployment` row (`deployedBy`, `version`, `gitBranch`, `deployedAt`, resolved `environmentId`), which is arguably better for that case.

12. **The read-time fallback in `routes/applications.js` is deleted** — the block that patches `currentVersion` / `gitBranch` / `deploymentEnvironment` onto the GET response from the latest deployment without fixing the stored row. It exists to hide the stale-mirror bug and is why two screens disagree today.

13. **Split behaviour is defined.** One side keeps the environments; the split offers to clone them to the new application, the same as every other cloned attribute. Cloning copies the instance rows and their field values, not the domains.

### Also fixed by the resolver

Both deployment write paths currently backfill `currentVersion` / `gitBranch` only when the column is null, so the value freezes after the first deploy. The resolver **always overwrites** — a deploy is authoritative for its own environment.

---

## Phase 4 — Wiz Resources on an Application

### What changed from the triple

This section used to describe a `Product`/`Environment`/`Application` **triple as a natural key**, resolving to exactly one `ApplicationEnvironment`. That is not the design any more.

**It is a filter, not a key.** An application page composes:

| | | |
|---|---|---|
| **Company → Wiz folder** | required | No folder on the application's company, **no call is made at all** |
| **Product → tag value** | optional | Omitted when the application has no product, or belongs to several |
| **Application → tag value** | required | |

**Environment and Role are context, not filters.** They are read off each resource and displayed. They take no part in deciding which resources these are, which means a tag triple no longer resolves to an `ApplicationEnvironment` and nothing in this phase depends on the environment vocabulary.

That drops the old Definition-of-Done line about a triple resolving to one instance. It also means the environment names work from Phase 3 serves *display* for Wiz — showing and grouping by environment — rather than identity.

### Tag values are assigned, not matched

A company's tag values will not equal Orbit's record names, and expecting them to would make the feature depend on a naming convention nobody has agreed to. So **each Product and each Application in Orbit is assigned its Wiz tag value**, once, and the filter is composed from those assignments.

Free text with discovered values offered as suggestions: a company writing its tagging standard alongside the tool has to be able to assign a value before any resource carries it.

Storage mirrors the pattern already in place — `CompanyToolLink.filter.folderId`, `ApplicationToolLink.filter.tagValue` — with a new `ProductToolLink` completing the set. One new model, no new concept.

### Multi-product applications

`ProductApplication` is many-to-many. When an application belongs to **more than one** product, the product filter is **omitted** and the query runs on folder + application alone.

Less specific beats wrong. An application's resources all have to come back, and losing one because the wrong product was guessed is the worse failure. It does mean naming has to stay consistent across products.

### Built

- `listWizResourcesForFolder` (`integrations/wiz.js`) — per-resource tag objects, folder-first, product and application filters, Environment and Role carried through.
- `wizTagsToObject` keeps tags attached to the resource they came from. `normalizeWizTagValues` flattens a whole folder into `key:value` strings and cannot answer "does *this* resource carry both", which is the only question the filter asks. It stays for now because the old tag picker still uses it.
- **Server-side filtering.** The product tag goes into the query as a `where` predicate, so Wiz returns a slice rather than the folder. Three candidate predicate shapes are tried once per tenant and the first accepted is reused; if none are, narrowing happens locally and `serverFiltered: false` says so. Verified against a real tenant: `{ tags: { EQUALS: [{key, value}] } }` is accepted, and a query that scanned a whole folder now scans four resources.
- Only the **product** is pushed down. Shared resources are wanted too, and "has this tag or does not have it" is not a predicate worth constructing.
- `scripts/wiz-tag-probe.js` — read-only. Surveys what a folder returns, or with `--product`/`--application` runs the real filter, so the query is provable against a tenant before any UI exists.

### Not built

- `ProductToolLink`, and the assigned tag value on products and applications.
- `GET /api/applications/:id/wiz-resources`, composing the filter from those assignments.
- The panel on the application page.
- **Per-company tag key names.** `Product`, `Application`, `Environment` and `Role` are constants in `WIZ_TAG_KEYS` today. Companies will pick **one** key name per concept, in a settings screen much like Environments, stored in `CompanyToolLink.filter`. Note the asymmetry: Environment needs the key name *and* the value list configurable; Product and Application need only the key, because their values are assigned per record.
- **Resource types.** Two constants (`VIRTUAL_MACHINE`, `CONTAINER`) in `WIZ_RESOURCE_TYPES`, deliberately one edit to widen. Becomes config — in code or the admin UI — once the shape is proven. Each type is queried separately so an unknown one reports itself instead of losing every other type's results.

### Shared resources: the `_shared` convention

A resource carries one value per tag key, so a host serving several applications cannot name one of them without being wrong for the rest.

- A resource serving the product rather than one named application is tagged **`Application=_shared`**, with `Product` and `Environment` as normal.
- **A missing `Application` tag means the same thing.** One says it deliberately, the other by accident; for "what powers this application" they are the same answer, and treating them differently is how a database disappears off the page that needs it.
- `_shared` is **reserved** — Orbit must refuse an application of that name, and must not treat the tag as an unmatched-tag warning.
- A comma-separated list in the `Application` value was considered and rejected: it turns the tag into an unvalidated parsing contract, hits the ~256-character cloud tag value ceiling, and is not legal on GCP labels at all.
- Orbit's own stack is tagged this way — see the header comment in `docker-compose.yml`. Images carry `Product` + `Application` and deliberately no `Environment` (one image runs everywhere); containers carry all three; shared resources carry `_shared` plus a documentary `Role` label that nothing parses.

**`Role` is a candidate fourth dimension, kept open on purpose.** Today it exists only to keep "which shared thing is this" readable in the cloud console — `_shared` alone does not say database from reverse proxy — and nothing parses it.

Promoting it to a quad is on the table and worth deciding in this phase rather than being assumed away. The trade:

- **It earns its place** if `_shared` turns out to be too coarse to act on — "the database serving this product in production" is a different conversation with a different owner than "the reverse proxy", and a `Product`/`Environment`/`Application`/`Role` quad says that directly.
- **The cost is the natural key.** `Role` would have to be optional, since a dedicated application resource has no role, which means the key is a triple for some resources and a quad for others. That asymmetry has to be deliberate, and `Role` only ever narrows within `_shared`.

So the likely shape is a required key on `_shared` resources and absent elsewhere, used for grouping rather than for identity.

### Expectation to manage

Picking tag values does not make findings split by application. `wizFor` in `services/securityFindingsExportService.js` filters by folder and ignores `tagValue` entirely. Say so in the UI.

---

## Phase 5 — The Resource Panel

Split from Phase 4 so that phase stays "the query returns the right resources" rather than quietly becoming "and also build a resource browser".

**Requirement:** an application page shows the resources powering it, including shared ones.

**Mechanism:** one call to `listWizResourcesForFolder` with the application's assigned tag value and, when unambiguous, its product's. Resources come back labelled with why they matched — `application` for its own, `shared` for the product's shared infrastructure — so the panel can group them without a second query.

**Known imprecision:** every shared resource in a product appears on every application page in that product. That is over-inclusion, not omission, which is the right direction to fail for a security catalog. The escape hatch, if it is ever needed, is a documentary `Hosts:` tag used **only** to narrow the display — never for identity — so a missing, stale or malformed value degrades to showing the resource anyway.

**Open questions for this phase:**

- Live query against Wiz on page load, or a pre-filtered deep link into Wiz? The deep link is nearly free and honest about who owns the data; the live query is nicer and costs caching, rate limits and a loading state on a page that already does a lot.
- An application in two products sees both products' shared infrastructure. Group the panel by product rather than presenting one flat list.
- The `where` predicate narrows by **product**, so a large product still pages through all its resources to pick out one application's. Fine at current scale; revisit if a product ever has thousands.

---

## Deferred: where DAST lives

**All DAST work is deferred and will be done as one piece.** This section exists so the reasoning is on the page rather than re-derived.

### What is true today

- `lastDastScanDate` is a column on `Application`, edited by a human on the App Data tab and written by `PUT /applications/:id`. **Nothing else writes it.** No integration, no CI path. The duplicate column on `ApplicationEnvironment` was populated once by the backfill and has not been touched since.
- CI scan-date reporting does not exist and is not planned in this work.

### Why it is not moving now

Moving the column means building a per-environment DAST editor in the same commit, because the field is human-entered — drop the column without one and DAST dates become uneditable the same day, frozen at whatever the backfill copied.

That editor is only worth building once the shape is decided, and the current thinking is that DAST may belong on the **application** with metadata (which environment was scanned, which branch was deployed at the time) rather than on the instance. That is a scan-record shape, not a column, and it would make a move-to-instance-now into work we tear out later.

### The intended scoring rule, when the work happens

> **DAST is measured by recency from today. The deploy date is not an input.** No scan date → penalty. Scan within the cadence window → full credit. Older → decaying penalty.

This answers the question actually being asked — *do they have scanning in place* — and it makes the cross-environment comparison problem below disappear rather than needing to be solved.

### Tripwire: pipeline onboarding silently changes DAST scores

**Read this before anyone reports a mystery score drop.**

Scan freshness in `services/scoring.js` is not "is the scan recent." It is "how close is the scan date to the **last deployment** date," and it penalises **both** directions:

```
gap = scanDate − lastDeploymentDate, in days
  |gap| ≤ 1 day      → full points
  scan BEFORE deploy → −10% per day, floor 0.3
  scan AFTER  deploy → −10% per day, floor 0.3
```

Consequences, none of them intended:

| Scenario | Scan | Last deploy | Weight |
|---|---|---|---|
| Scanned yesterday, nothing deployed in 6 months | Oct 1 | Apr 1 | **0.3** |
| Never scanned at all | — | — | **0.3** |
| Scanned in Sept, *dev* deployed this morning | Sep 1 | Oct 1 | **0.3** |
| Scanned the day before deploy | Sep 30 | Oct 1 | 1.0 |

A fresh scan on a stable application scores identically to never having scanned.

**This is hidden today** because when an application has zero deployment rows the code falls through to a plain recency check (>90 days → 0.5), which is the intended rule. 87 of 91 applications are in that branch.

**The environments work makes it reachable.** Its purpose is to get pipelines posting deploys. Each application that starts reporting deployments flips from "recency" to "proximity to last deploy" — silently, one at a time, as pipelines are onboarded. And `SCORING_INCLUDE` takes the single most recent deployment **across all environments** with no filter, so a dev deploy can invalidate a production scan.

Deliberately not fixed now: pipeline onboarding is gradual and human-paced, the DAST rule above resolves it, and touching the shared comparison loop would move SAST, SCA, secrets and IaC scores too.

**When the DAST work happens, decide at the same time whether the after-deploy penalty should exist for any category.** A scan more recent than the last deploy is strictly good news everywhere, not just for DAST.

---

## Frontend

### Already shipped

The CI sample payload on the deployment-token screen lists the company's real environment names instead of `{env}`, and deploy history shows unmatched deployments with a warning badge and an "Unassigned (n)" filter. **Both appear regardless of environment count.**

### Not built

- **Environment settings UI.** The core of the new model: for each of Orbit's five kinds, which strings this company's pipelines send, what order, active or retired. Only `OTHER` takes a typed name. A `+` button adds another `OTHER`. This is a new settings screen and handler, not a tweak to an existing one.
- **The adopt/triage endpoint and UI.** The `environment.manage` permission description already promises it. Under the alias model its job is better than it was: *"`prod-us` is arriving from a pipeline — add it as an alias of your PRODUCTION environment,"* rather than creating a new row or forcing a rename.
- **Per-application instance management.** Attach this application to an environment, edit its version/branch, retire it. Backend in Phase 3 AC 8; this is its UI.
- **The per-application selector.** `deploymentEnvironmentFilter` in `ApplicationDetail.jsx` already filters deploy history by environment string; that becomes the real selector, picked once at the top and scoping both the metadata panel and the deploy history. Net reduction in UI. Hidden when the application has one environment.
- **The tag picker.** `IntegrationTagPickerModal` becomes three dependent selects (product → application → environment) instead of a flat list of `Application:`-prefixed strings.

### Suggested order

Environment settings UI → per-application instance management → adopt/triage → per-application selector → tag picker. The settings screen comes first because nothing else is testable without a second environment existing, and triage is pointless before a company has a vocabulary to adopt strings into.

---

## Permissions

`environment.manage`, on `EDIT_PERMISSIONS`, so `company_edit` and `company_admin` both hold it (the latter via its blanket `COMPANY_PERMISSIONS` grant). `company_member` is being removed.

**Unassigned triage is therefore self-service** for `company_edit` and up, not admin-only. Hard-deleting an environment is the only admin-only piece and has no permission string at all, per the catalog's invariant — retiring is the delegatable equivalent.

---

## Notes For Whoever Builds This

- **Scope checks: unknown keeps a control in scope.** `evaluateScopeCheck` treats a nullish field as "does not exclude", except for `exists` / `not_exists`. Before that fix, `not_equals` could not express "applies unless explicitly X" — it meant "has a value, and that value isn't X" — and a control scoped that way excused itself for every application with an unanswered field. If this work adds scope checks, read `POLICY_CONTROL_AUTHORING.md` first.
- **The name-to-kind mapping is duplicated** — JS in `services/environmentNaming.js`, a SQL `CASE` in the migration. Both carry comments pointing at the other. It is now **seed-time only** (decision 6), which lowers the stakes considerably, but keep them in step.
- **File and line references in this document have drifted** since the merge. Treat them as pointers to the right function, not the right line.
- **Phase 3 touches `createVersionFromData` and `applyApprovedVersion`.** So does the merge-at-approval work (section 10 of `APP_DATA_MODEL_EXPLORATION.md`). Merge-at-approval lands first; do not start Phase 3 until it has.
- **`scripts/seed-sectest.js` writes `deploymentEnvironment`** and must be updated when the column drops.
- Migrations were renamed to `20260922120000` / `20260922130000` to sort after the policy-controls branch.

---

## Definition of Done

- A company maps its own environment vocabulary onto Orbit's five kinds in one settings screen, and both CI deploys and Wiz tags resolve through it.
- A company has at most one `PRODUCTION`, `STAGING`, `QA` and `DEVELOPMENT` environment, and as many `OTHER`s as it wants.
- A submitted string matches an `EnvironmentName` row or it is Unassigned. Nothing is ever inferred, and nothing is auto-created.
- An application can hold several environments, each with its own domain(s), current version and git branch.
- An application's primary environment is its `PRODUCTION` one, derived, never stored. An application without one has no primary and nothing is promoted in its place.
- One application with one environment looks as it does today, bar the two already-shipped surfaces above.
- A CI deploy naming a known environment attaches to it and **overwrites** that environment's version and branch. A deploy naming an unknown one is recorded, visible under Unassigned, and creates nothing.
- Every application has at least one environment, including ones created after the migration.
- An instance can be created, edited, retired and deleted from the UI, and deleting one does not take a domain's link to its application with it.
- **Scoring output is unchanged.** `services/scoring.js` changes only in that `SCORING_INCLUDE` loads the relation.
- `currentVersion`, `gitBranch` and `deploymentEnvironment` appear in no version snapshot, diff or approval list, and no code reads them off `Application`.
- `currentVersion` is still pickable in the policy control editor, still saves, and still evaluates.
- `lastDastScanDate` is exactly where it was, editable exactly as it was.
- No derived or mirrored per-environment column exists on `Application`.
- An application page lists its Wiz resources: those carrying its assigned Application tag value, plus the product's shared ones (`_shared`, or no Application tag). No folder on the company means no call is made. Environment and Role are shown as context on each resource and filter nothing.
