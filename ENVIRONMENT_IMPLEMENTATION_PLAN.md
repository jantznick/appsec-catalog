# Environment Implementation Plan

## Overview

Environments were implied by three unrelated free-text fields (`Application.serverEnvironment`, `Application.deploymentEnvironment`, `Deployment.environment`) with nothing tying them together. This plan makes an environment a first-class entity sitting between `Application` and `Domain`, so a deployed instance — "Orbit Backend in production" — is a thing the catalog can name, attach a domain to, and point a Wiz tag at.

The driver is Wiz tagging. Containers and images are tagged with three keys — `Product`, `Environment`, `Application` — and that triple is the natural key of an application/environment pair inside a company's Wiz folder. The catalog had nowhere to put the `Environment` half.

**This document is the specification.** Work not described here does not get done, and context not recorded here is not available to whoever picks this up. Roughly half the decisions governing this feature previously lived in conversation rather than in the file; this revision folds them in.

---

## Status

Phases 1 and 2 are **built and on main** (PR #33). Phases 3 and 4 are not started.

### Built

- `Environment` and `ApplicationEnvironment` models, and migration `20260922120000_add_environments` with its backfill
- `20260922130000_application_name_key_trim`, which tightens the application-name index
- `services/environmentResolver.js`, with both deployment write paths going through it — `routes/deploymentTokens.js` (CI) and `routes/applications.js` (manual entry)
- `routes/environments.js` CRUD, behind the `environment.manage` permission
- Real environment names in the CI sample payload on the deployment-token screen
- The "Unassigned" bucket in deploy history, showing the raw submitted string

### Migrated and measured

Both migrations **are applied** to the dev database (`prisma migrate status` reports the schema up to date). The backfill ran cleanly. Measured on dev, 91 applications across 18 companies:

| | |
|---|---|
| `Environment` rows | 17 — **all `kind = PRODUCTION`** |
| `ApplicationEnvironment` rows | 91 — exactly one per application |
| Deployments | 4, all linked, 0 unassigned |
| Domains re-homed | 46 / 46 |
| Instances carrying a `currentVersion` | 1 — the same count as applications carrying one |

No duplicate application names exist under `lower(btrim(name))`, so the tightened index applies cleanly.

### The state to understand before testing

**The model is live but nothing is using it.** Every environment came out `PRODUCTION`, so no application has a second one. The per-application selector is hidden on all 91, no Unassigned bucket has contents, and none of the multi-environment behaviour has data to exercise. Anyone testing this must hand-create a second environment first.

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

1. **An environment is an instance, not a label.** `Application` mixes logical facts (name, owner, repo, language, criticality) with facts about a particular running copy. The latter belong to the instance.
2. **Two tables, not one.** A company-scoped `Environment` vocabulary plus an `ApplicationEnvironment` instance row. The vocabulary makes "production" mean one thing per company and gives Wiz tag values something to validate against; the instance holds the per-copy data.
3. **`kind` on the vocabulary row** (`PRODUCTION | STAGING | DEVELOPMENT | QA | OTHER`) so a company can call it `uat` while cross-company reporting still knows what production is. Name is free text; `kind` is canonical.
4. **Four fields move** to `ApplicationEnvironment`: `currentVersion`, `gitBranch`, `lastDastScanDate`, and `deploymentEnvironment` — the last deleted rather than relocated, since its only job is recording which environment a row describes, and that becomes the relation.
5. **Four fields stay on `Application`:** `lastSastScanDate` and `lastScaScanDate` (SAST scans a codebase, SCA a dependency manifest — both properties of the repo at a commit, identical across environments), plus `serverEnvironment` and `deploymentType`.
6. **The four moved fields leave the version system.** They are operational data written by deployments and integrations, not claims a submitter makes. **Half done:** all four are already `approvable: false` on main (`09cdd0e`). Setting `versioned: false` and dropping the columns remains, and belongs to Phase 3.
7. **Scoring takes the most recent DAST date across ANY environment.** Not the primary. Deliberate, for two reasons: teams should not be pushed toward scanning production, and this measures policy compliance rather than serving as a hard audit — a real audit requests the scan evidence itself. The winning environment is recorded and surfaced so the provenance stays visible.
8. **Domains attach to the environment, not the application.** `app.hearst.com` and `staging.app.hearst.com` are otherwise indistinguishable to the DNS and web-snapshot machinery.
9. **Every application gets a default environment.** The selector stays hidden until a second one exists. A default environment is a container, not something scored — decision 7 gives one score per application and decision 9 hides the UI, so a seeded default cannot distort anything.
10. **Environments have an active/retired status.** A retired environment keeps its deploy history and its Wiz tag without cluttering pickers.
11. **Unmatched CI environment strings do not auto-create environments.** They land in an "Unassigned" bucket. A phantom row from one typo'd pipeline yaml would otherwise appear in the environment selector and the Wiz tag picker as though it were real.
12. **No mirror or derived columns on `Application`.** Per-environment values are resolved at read time.

### Primary environment

13. **An explicit primary flag on `ApplicationEnvironment`**, marking the production or main environment. A stored designation, not a value re-derived per read — re-deriving would make every read depend on a heuristic.
14. **An application with no primary counts as failing** anything that needs one. It is a data point we do not have, and flagging it is how it gets fixed.
15. **Retiring the primary leaves the application with no primary.** The retirement is allowed and nothing is silently promoted in its place; the application then reads as a data gap, exactly as if one had never been set. Blocking the retirement would make decommissioning awkward for no gain.
16. **An application's only environment may be marked primary automatically** if that is cheap to implement. If it is not, leave it unset — the resulting failures surface it and the user marks it, which is the same outcome by a slower route.
17. **DAST reads any environment; completeness reads the primary.** Two rules on one model, deliberately. DAST is deliberately permissive (decision 7). `currentVersion` is deliberately specific, because knowing what is running in production is the thing worth knowing and is useful during outreach to companies. Other checks already exist to catch a DAST scan that ran against the wrong branch.

### Compliance outcomes

18. **4.6.4 Environment Separation lands as `verification_required`, satisfiable by attestation.** The model can evidence that environments **exist**; it cannot evidence that they are **isolated**, and no isolation signal is planned. Distinct domains per environment (available now) and distinct Wiz tags per environment (after Phase 4) are partial evidence behind a human check; neither upgrades the control to a pass. The control is attestable today (365 days) as the interim route.
19. **The primary environment does not change 4.6.10.** That control reads any environment, per decision 7. Do not switch it on the strength of a primary existing.

### Naming

20. **`serverEnvironment` is a hosting platform, not a deployment environment.** The demo import CSV carries `Server Environment` = "Cloud (AWS)" with `Facing` = "External" as a separate column. It is load-bearing in knowledge scoring, in company-level defaults on `Company`, and in the threat-model AI prompt. Removal is off the table. Renaming it to `hostingPlatform` is correct and is **deferred** — roughly 20 files, and it should not ride inside this refactor.
21. **Company settings will show `Company.serverEnvironment` beside an Environments section.** Label the latter "Deployment Environments" to keep the two apart.

---

## Goals

- An application can have several environments, each with its own domain(s), current version, git branch, and Wiz tag.
- A Wiz `Product`/`Application`/`Environment` tag triple resolves to exactly one catalog row.
- CI pipelines are told the valid environment names up front, and a mismatch is visible rather than silent.
- Scoring and completeness keep working, with no behavioural change other than the DAST-date rule.

## Non-Goals

- **Findings and export pipeline changes.** The Wiz tag is identity. What the export service does with it is separate work. (`wizFor` in `services/securityFindingsExportService.js` ignores `tagValue` entirely and filters only by folder — a pre-existing gap this plan neither introduces nor fixes.)
- **Per-environment scoring.** One score per application, per decision 7.
- **CI scan-date reporting.** Nothing writes scan dates from a pipeline today and this plan does not add it.
- **The `hostingPlatform` rename.** Decision 20.

---

## Data Model

### `Environment` — company vocabulary

```prisma
model Environment {
  id           String                   @id @default(cuid())
  companyId    String
  company      Company                  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  name         String                   // "prod", "uat", "staging"
  kind         String                   // PRODUCTION | STAGING | DEVELOPMENT | QA | OTHER
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

`sourceLabel` preserves whatever free text the row was migrated from, so a bad seed can be cleaned up later without losing what the data originally said.

### `ApplicationEnvironment` — the instance

```prisma
model ApplicationEnvironment {
  id            String      @id @default(cuid())
  applicationId String
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  environmentId String
  environment   Environment @relation(fields: [environmentId], references: [id], onDelete: Restrict)
  status        String      @default("active") // active | retired

  isPrimary        Boolean   @default(false)   // PHASE 3 — see decisions 13-17
  currentVersion   String?
  gitBranch        String?
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

**`isPrimary` needs a partial unique index**, hand-written because Prisma cannot express it:

```sql
CREATE UNIQUE INDEX "ApplicationEnvironment_primary_key"
  ON "ApplicationEnvironment"("applicationId") WHERE "isPrimary";
```

Same pattern as `Application_companyId_lower_name_key`.

### `Deployment`

```prisma
  environmentId  String?      // nullable: unmatched CI strings land here as null
  environmentRef Environment? @relation(fields: [environmentId], references: [id], onDelete: SetNull)
  environment    String       // KEEP: the raw string as submitted, for audit
```

The free-text column stays. When a pipeline sends `Production ` with a trailing space, or an environment is renamed later, the original submission is still recoverable. Nullable FK plus retained string is what makes the Unassigned bucket possible.

### `ApplicationDomain` and `ApplicationToolLink`

Both gained a nullable `applicationEnvironmentId`. **Neither has a write path that maintains it** — the backfill re-homed domains once and nothing has touched either since. Phase 4 changes `ApplicationToolLink`'s unique constraint from `[applicationId, provider]` to include the environment, which must move the `applicationId_provider` upsert in the routes at the same time.

### Application-name uniqueness — correcting this document

Earlier revisions of this plan said to add `@@unique([companyId, name])`. **That is not what shipped, and the difference matters.** What exists is a functional unique index:

```sql
CREATE UNIQUE INDEX "Application_companyId_lower_name_key"
  ON "Application"("companyId", lower(btrim("name")));
```

`schema.prisma` deliberately does *not* declare `@@unique`, with a comment explaining why: a plain Prisma constraint is case- and whitespace-sensitive, while `applicationNameKey()` in `services/applicationNames.js` folds with `trim().toLowerCase()`. A case-sensitive constraint would disagree with the split endpoint's own conflict check. The migration carries a `DO` block that counts collisions and raises a readable error rather than failing as a raw index violation. **Keep the index expression and `applicationNameKey()` in step.**

---

## Migration Plan

`prisma migrate dev` fails against the shadow database in this repo. Use `prisma migrate diff` to generate SQL, then `prisma migrate deploy`.

Steps 1–4 are **done and applied**:

1. ~~Create `Environment` and `ApplicationEnvironment`; add nullable FKs to `Deployment`, `ApplicationDomain`, `ApplicationToolLink`.~~
2. ~~Seed the vocabulary, one `Environment` per distinct `Deployment.environment` value per company, mapping onto `kind` where it matches and `OTHER` otherwise, retaining the original string in `sourceLabel`.~~
3. ~~Seed one default instance per application.~~
4. ~~Backfill the FKs and copy the three fields onto the default instance.~~
5. ~~Tighten the application-name index.~~

Remaining:

6. **Add `isPrimary` and its partial unique index, and populate it.** The seeding heuristic already exists and is proven: backfill step 6 of `20260922120000_add_environments` already picks each application's primary — the environment whose name matches `Application.deploymentEnvironment`, else one with `kind = PRODUCTION`, else first by name — uses it to copy the three fields and re-home domains, then discards the choice. **Persist that same choice rather than inventing a new rule.** It has already run cleanly across all 91 dev applications.
7. **Drop the four moved columns** from `Application` and from the `ApplicationVersion` snapshot. Phase 3 only.

---

## Phase 3 — Field Migration and Read Resolvers

The registry gate is **cleared**: `services/applicationFields.js` is on main. The `versioned` / `approvable` / `splittable` flags on `APPLICATION_METADATA_FIELDS` are now the control surface for the field moves — removing four fields is flag changes plus entry deletion in one file, not the eight hand-maintained lists an earlier revision of this document enumerated.

This is **one commit**. A half-done removal is the failure mode: a field missing from the diff list is invisible in version history, and one missing from the apply list is silently discarded on approval. Neither raises an error.

### Acceptance criteria

1. `isPrimary` exists, is populated per migration step 6, and the partial unique index is in place.
2. A read resolver attaches per-environment values onto the application object **under the same property names**, so dynamic dereferences (`app[scanField]` at `services/scoring.js`, and `routes/applications.js`) keep working. Done this way, **`services/scoring.js` needs no changes at all.**
   - `lastDastScanDate` — max across the application's active environments, plus which environment it came from (decision 7).
   - `currentVersion` — from the primary environment only (decision 17).
3. **The resolver throws when the relation is not loaded.** Prisma returns `undefined` for a relation that was never `include`d and `[]` for one that was included and is empty. Those two states mean completely different things and look identical if you only check for a missing value:
   - `undefined` → **throw.** A query forgot its include. Reporting a data gap here would mean the same application scores differently depending on which endpoint you hit, which is exactly how finding E5 shipped (one of four scoring call sites omitted `apiSchema` and silently zeroed a category).
   - `[]`, or no primary → **dock the score and surface it** as a real gap, per decision 14.
   - There are **7 completeness call sites across 5 files** today, one of which is `services/scoring.js`, reached from every query that scores an application. Each is a chance to forget.
4. `currentVersion` **stays in `FIELD_SETS.metadata`**, reading from the primary environment. It is not dropped. Measured: instances carrying a version and applications carrying one are both 1 on dev, so a resolver moves no completeness percentage and no knowledge score. Dropping it instead would shift every number in the portfolio.
5. The four fields are `versioned: false` in `services/applicationFields.js` and their columns are dropped from `Application` and `ApplicationVersion`.
6. `services/applicationVersionColumns.test.js` passes. It asserts in both directions — a versioned registry field with no snapshot column, and a snapshot column with no registry entry — and is the guard against a half-done removal.
7. **`ApplicationEnvironment` and `Deployment` are added to `TRACKED_FIELDS`** in `utils/changeHistory.js`. Neither is there today, so the moved fields would lose what change-history coverage they have. Note that the deploy write paths do not call `recordChange` at all — provenance for a CI-written value currently comes from the `Deployment` row (`deployedBy`, `version`, `gitBranch`, `deployedAt`, resolved `environmentId`), which is arguably better for that case.
8. Delete the read-time fallback in `routes/applications.js` that patches the GET response without fixing the stored row. It exists to hide the stale-mirror bug and is why two screens disagree today.

### Also fixed by the resolver

Both deployment write paths currently backfill `currentVersion` / `gitBranch` only when the column is null, so the value freezes after the first deploy. The resolver **always overwrites** — a deploy is authoritative for its own environment.

---

## Phase 4 — Wiz Tag Triple

Entirely unstarted, and the original point of the exercise.

- Rewrite `normalizeWizTagValues` (`integrations/wiz.js`) to return per-resource tag **objects** rather than flattened `key:value` strings. The current flattening cannot correlate `Product`, `Environment` and `Application` read off the same resource.
- Rewrite `listWizTagsForFolder` (`integrations/wiz.js`), which filters to values starting with `Application:`, to return `{product, application, environment}` triples.
- Extend `validateWizApplicationFilter` / `normalizeWizApplicationFilter` (`integrations/resolve.js`) to carry the triple and link against the `ApplicationEnvironment` rather than the `Application`.
- **All three tag keys are required**, plus a per-company config for what each key is called — some companies call a product a "solution". That config lands in `CompanyToolLink.filter` alongside the existing `folderId`.
- Retired environments **keep** their Wiz tag links; the tag still describes what ran there.
- `ApplicationToolLink`'s unique constraint becomes per-environment, moving the `applicationId_provider` upsert in the routes at the same time.

---

## Frontend

### Already shipped

The CI sample payload on the deployment-token screen lists the company's real environment names instead of `{env}`, and deploy history shows unmatched deployments with a warning badge and an "Unassigned (n)" filter. **Both appear regardless of environment count** — decision 9's "no new UI" applies to the *selector* specifically, not to the feature.

### Not built

- **The adopt/triage endpoint.** The `environment.manage` permission description already promises it. Adopt a raw string into an existing environment, or create a new one from it.
- **Environment management UI** — CRUD for the company vocabulary: name, kind, status, display order, primary.
- **The per-application selector.** `deploymentEnvironmentFilter` in `ApplicationDetail.jsx` already filters deploy history by environment string; that becomes the real selector, picked once at the top and scoping both the metadata panel and the deploy history. Net reduction in UI. Hidden when the application has one environment.
- **The tag picker.** `IntegrationTagPickerModal` becomes three dependent selects (product → application → environment) instead of a flat list of `Application:`-prefixed strings.

### Suggested order

Adopt/triage endpoint → environment management UI → per-application selector → tag picker. Pipelines can then be corrected before anything depends on them.

---

## Permissions

`environment.manage`, on `EDIT_PERMISSIONS`, so `company_edit` and `company_admin` both hold it (the latter via its blanket `COMPANY_PERMISSIONS` grant). `company_member` is being removed.

**Unassigned triage is therefore self-service** for `company_edit` and up, not admin-only. Hard-deleting an environment is the only admin-only piece and has no permission string at all, per the catalog's invariant — retiring is the delegatable equivalent.

---

## Notes For Whoever Builds This

- **Scope checks: unknown keeps a control in scope.** `evaluateScopeCheck` treats a nullish field as "does not exclude", except for `exists` / `not_exists`. Before that fix, `not_equals` could not express "applies unless explicitly X" — it meant "has a value, and that value isn't X" — and a control scoped that way excused itself for every application with an unanswered field. If this work adds scope checks (by environment kind, by facing, by an N/A declaration), read `POLICY_CONTROL_AUTHORING.md` first.
- **The name-to-kind mapping is duplicated** — JS in `services/environmentNaming.js`, a SQL `CASE` in the migration. Both carry comments pointing at the other. Mitigation, not a fix.
- **File and line references elsewhere in this document have drifted** since the merge. Treat them as pointers to the right function, not the right line.
- **Phase 3 touches `createVersionFromData` and `applyApprovedVersion`.** So does the merge-at-approval work (section 10 of `APP_DATA_MODEL_EXPLORATION.md`). Merge-at-approval lands first; do not start Phase 3 until it has.
- Migrations were renamed to `20260922120000` / `20260922130000` to sort after the policy-controls branch.

---

## Definition of Done

- An application can hold several environments, each with its own domain(s), current version, git branch and DAST scan date.
- One application with one environment looks as it does today, bar the two already-shipped surfaces above.
- A CI deploy naming a known environment attaches to it and **overwrites** that environment's version and branch. A deploy naming an unknown one is recorded, visible under Unassigned, and creates nothing.
- Exactly one primary environment per application, or none; never two.
- An application with no primary reads as a data gap rather than silently passing.
- Scoring output is unchanged except that `lastDastScanDate` is the most recent across active environments, and the UI shows which environment it came from.
- `services/scoring.js` is unmodified.
- The four moved fields appear in no version snapshot, diff or approval list, and no code reads them off `Application`.
- No derived or mirrored per-environment column exists on `Application`.
- A Wiz `Product`/`Environment`/`Application` triple resolves to exactly one `ApplicationEnvironment`.
