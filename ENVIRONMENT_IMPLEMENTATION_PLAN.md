# Environment Implementation Plan

## Overview

Environments are currently implied by three unrelated free-text fields (`Application.serverEnvironment`, `Application.deploymentEnvironment`, `Deployment.environment`) and nothing ties them together. This plan makes an environment a first-class entity sitting between `Application` and `Domain`, so that a deployed instance of an application — "Orbit Backend in production" — is a thing the catalog can name, attach a domain to, and point at a Wiz tag.

The immediate driver is Wiz tagging. Containers and images are now tagged with three keys — `Product`, `Environment`, `Application` — and that triple is precisely the natural key of an application/environment pair resolved inside a company's Wiz folder. The catalog currently has nowhere to put the `Environment` half of that.

## Finalized Decisions

These were settled in design discussion and are not open for re-litigation during build.

1. **An environment is an instance, not a label.** `Application` today mixes logical facts (name, owner, repo, language, criticality) with facts about a particular running copy (`currentVersion`, `gitBranch`, `deploymentEnvironment`, scan dates). The latter belong to the instance.
2. **Two tables, not one.** A company-scoped `Environment` vocabulary, plus an `ApplicationEnvironment` instance row. The vocabulary makes "production" mean one thing per company and gives Wiz tag values something to validate against; the instance holds the per-copy data.
3. **`kind` on the vocabulary row** (`PRODUCTION | STAGING | DEVELOPMENT | QA | OTHER`) so a company can call it `uat` while cross-company reporting still knows what production is. Name is free text; `kind` is canonical.
4. **Four fields move** to `ApplicationEnvironment`: `currentVersion`, `gitBranch`, `lastDastScanDate`, and `deploymentEnvironment` (which is deleted rather than relocated — its only job is recording which environment a row describes, and that becomes the relation).
5. **Four fields stay on `Application`:** `lastSastScanDate` and `lastScaScanDate` (SAST scans a codebase, SCA scans a dependency manifest — both are properties of the repo at a commit, identical across environments), plus `serverEnvironment` and `deploymentType` (submitter claims collected by the intake forms).
6. **The four moved fields leave the version system.** They come out of the `ApplicationVersion` snapshot, the diff list, and the apply list, and stop being approvable. They are operational data written by deployments and integrations, not claims a submitter makes.
7. **Scoring takes the most recent DAST date across any environment.** No per-environment score divergence. The winning environment is recorded and surfaced in the UI so the provenance stays visible.
8. **Domains attach to the environment, not the application.** `app.hearst.com` and `staging.app.hearst.com` are currently indistinguishable to the DNS and web snapshot machinery.
9. **Every application gets a default environment.** The selector is hidden in the UI until a second one exists.
10. **Environments have an active/retired status.** A retired environment keeps its deploy history and its Wiz tag without cluttering pickers.
11. **Unmatched CI environment strings do not auto-create environments.** They land in an "Unassigned" bucket. A phantom row from one typo'd pipeline yaml would otherwise surface in the environment selector and the Wiz tag picker as though it were real.
12. **No mirror or derived columns on `Application`.** Per-environment values are resolved at read time. The existing mirror fields only backfill when null and freeze after the first deploy; that bug is not being reproduced at wider scope.

## Goals

- An application can have several environments, each with its own domain(s), current version, git branch, and Wiz tag.
- A Wiz `Product`/`Application`/`Environment` tag triple resolves to exactly one catalog row.
- CI pipelines are told the valid environment names up front, and a mismatch is visible rather than silent.
- Scoring and completeness keep working with no behavioural change other than the DAST-date rule.

## Non-Goals (For This Iteration)

- **Findings and export pipeline changes.** The Wiz tag is identity — how the catalog points at the real deployed thing. What the export service does with it is separate work. (Note that `wizFor` in `services/securityFindingsExportService.js` currently ignores `tagValue` entirely and filters only by folder; that is a pre-existing gap, not something this plan introduces or fixes.)
- **Per-environment scoring.** One score per application, per decision 7.
- **CI scan-date reporting.** Nothing writes scan dates from a pipeline today, and this plan does not add it.
- **Renaming `serverEnvironment` → `hostingModel`.** It means "cloud / on-premises / hybrid", not a deployment environment, and having both names in the schema is a trap. Queued as follow-on cleanup; it crosses the shared field registry so it should land after that.
- **Reconciling the four competing definitions of completeness.** Three of them read fields touched here and will need the shared scan-date resolver, but consolidating them is its own task.

## Dependency

**The shared metadata field registry must land first.** The metadata field list is currently hand-maintained in eight places (the `ApplicationVersion` model, `createApplicationVersion`, `createVersionFromData`, `compareVersions`, `applyApprovedVersion`, `routes/config.js` `availableFields`, `BulkImportApplicationsModal.APPLICATION_FIELDS`, and a copy inside `PendingApprovals.jsx`). Removing four fields from eight hand-maintained lists is exactly the change that goes wrong quietly: a field missing from the diff list is invisible in version history, and one missing from the apply list is silently discarded on approval — neither raises an error.

This is being extracted into one registry in separate work (`APP_DATA_FIXES_PLAN.md` finding D2/1.1). Phase 1 below can proceed in parallel; Phase 3 must wait.

## Data Model Plan

### 1) New Model: `Environment` (company vocabulary)

```prisma
model Environment {
  id           String                   @id @default(cuid())
  companyId    String
  company      Company                  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  name         String                   // what the company calls it: "prod", "uat", "staging"
  kind         String                   // PRODUCTION | STAGING | DEVELOPMENT | QA | OTHER
  description  String?
  status       String                   @default("active") // active | retired
  displayOrder Int                      @default(0)
  sourceLabel  String?                  // original free-text value this row was seeded from
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

### 2) New Model: `ApplicationEnvironment` (the instance)

```prisma
model ApplicationEnvironment {
  id            String      @id @default(cuid())
  applicationId String
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  environmentId String
  environment   Environment @relation(fields: [environmentId], references: [id], onDelete: Restrict)
  status        String      @default("active") // active | retired

  // Moved from Application - facts about this running copy
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
}
```

Naming follows the existing join convention in this schema (`ProductApplication`, `ApplicationDomain`, `ApplicationScmRepo`). `onDelete: Restrict` on the environment relation is deliberate — deleting a vocabulary row that instances still reference should fail loudly, not cascade away deploy history.

### 3) Changes to `Deployment`

```prisma
  environmentId String?      // nullable: unmatched CI strings land here as null
  environmentRef Environment? @relation(fields: [environmentId], references: [id], onDelete: SetNull)
  environment   String       // KEEP: the raw string as submitted, for audit
```

The free-text column stays. When a pipeline sends `Production ` with a trailing space, or an environment is renamed later, the original submission is still recoverable. Nullable FK plus retained string is what makes the "Unassigned" bucket possible.

### 4) Changes to `ApplicationDomain`

```prisma
  applicationEnvironmentId String?
  applicationEnvironment   ApplicationEnvironment? @relation(fields: [applicationEnvironmentId], references: [id], onDelete: Cascade)
```

Added rather than replacing `applicationId`. The redundancy is deliberate: `routes/domains.js` reads `domain.applicationDomains.map(ad => ad.application)` in several places and those queries keep working untouched. Migration re-homes existing rows onto each app's seeded default environment. A consistency check (the environment's `applicationId` matches the row's `applicationId`) belongs in the write path.

### 5) Changes to `ApplicationToolLink`

```prisma
  applicationEnvironmentId String?
  applicationEnvironment   ApplicationEnvironment? @relation(fields: [applicationEnvironmentId], references: [id], onDelete: Cascade)

  @@unique([applicationId, applicationEnvironmentId, provider])  // was [applicationId, provider]
```

A null `applicationEnvironmentId` means "applies to the whole application", which is what every existing row becomes. That keeps the current `.find(l => l.provider === 'WIZ')` lookups in the export service and dashboard working during the transition.

### 6) Changes to `Application`

```prisma
  @@unique([companyId, name])
  @@index([companyId])
```

The model has no `@@` block at all today — no unique constraint and not even an index on `companyId`. Wiz tag resolution needs application names to be unique within a company. **This migration will fail if duplicate names already exist**; see Open Questions.

Removed: `currentVersion`, `gitBranch`, `deploymentEnvironment`, `lastDastScanDate`.
Retained: `serverEnvironment`, `deploymentType`, `lastSastScanDate`, `lastScaScanDate`.

## Migration Plan

`prisma migrate dev` fails against the shadow database in this repo. Use `prisma migrate diff` to generate SQL, then `prisma migrate deploy`.

Ordered steps, all reversible up to step 5:

1. Create `Environment` and `ApplicationEnvironment`; add the nullable FKs to `Deployment`, `ApplicationDomain`, and `ApplicationToolLink`. No data changes.
2. **Seed the vocabulary.** For each company, create an `Environment` row per distinct `Deployment.environment` value (trimmed, case-folded for matching). Map values onto `kind` where they clearly match a known kind; everything else gets `OTHER`. Retain the original string in `sourceLabel`.
3. **Seed one default instance per application.** Derive the name from `deploymentEnvironment`, falling back to `serverEnvironment`, falling back to a `PRODUCTION`/"Production" default. Anything that does not map cleanly onto a known kind gets a Production default rather than a junk name — this row becomes visible in the UI the moment a second environment is added, so it must not be garbage.
4. **Backfill the FKs.** Attach `Deployment` rows to environments by trimmed case-insensitive name match (unmatched stay null); re-home `ApplicationDomain` rows onto each app's default instance; copy `currentVersion` / `gitBranch` / `lastDastScanDate` from `Application` onto the default instance.
5. **Add `@@unique([companyId, name])` on `Application`.** Run a duplicate check first (see Open Questions).
6. **Drop the four moved columns** from `Application` and from the `ApplicationVersion` snapshot. Only after the shared field registry has landed and its generated lists no longer reference them.

## Backend Implementation Plan

### Phase 1: Schema, Migration, Backfill

Steps 1–4 above. Everything still reads from `Application`; nothing breaks.

### Phase 2: Environment Resolution Service

One helper, used by both deployment write paths — `routes/deploymentTokens.js:330` (CI) and `routes/applications.js:3246` (manual entry in the UI). Not `services/deployService.js`, which despite the name is the prod-deploy trigger for Orbit itself.

The helper:

1. Trims and case-insensitively matches the incoming string against the company's `Environment` rows.
2. On a match, resolves or creates the `ApplicationEnvironment` row for that app/environment pair.
3. On no match, leaves `environmentId` null and keeps the raw string. No auto-creation.
4. Writes `currentVersion` and `gitBranch` onto the `ApplicationEnvironment`, **always overwriting**. A deploy is authoritative for its own environment. This is the fix for the existing freeze-after-first-deploy behaviour at `routes/applications.js:3266-3272` and `routes/deploymentTokens.js:355-361`, which only backfill when the column is null.

### Phase 3: Field Migration and Read Resolvers

Blocked on the shared field registry.

- Remove the four fields from the registry's snapshot / diff / apply lists, then drop the columns.
- Add a shared scan-date resolver that attaches `lastDastScanDate` (max across the app's active environments, plus which environment it came from) onto the application object. Both consumers dereference the field dynamically — `app[scanField]` at `services/scoring.js:512` and `routes/applications.js:730` — so attaching the resolved value under the same property name means **`scoring.js` needs no changes at all**. `lastSastScanDate` and `lastScaScanDate` remain plain column reads.
- Delete the read-time fallback at `routes/applications.js:1858` that patches the GET response without fixing the stored row. It exists to hide the stale-mirror bug and is what makes two screens disagree today.

### Phase 4: Wiz Tag Triple

- Rewrite `normalizeWizTagValues` (`integrations/wiz.js:389`) to return per-resource tag *objects* rather than flattened `key:value` strings. The current flattening cannot correlate `Product`, `Environment`, and `Application` read off the same resource.
- Rewrite `listWizTagsForFolder` (`integrations/wiz.js:418`), which currently filters to values starting with `Application:`, to return `{product, application, environment}` triples.
- Extend `validateWizApplicationFilter` / `normalizeWizApplicationFilter` (`integrations/resolve.js`) to carry the triple, and link against the `ApplicationEnvironment` rather than the `Application`.

## Frontend Implementation Plan

### `ApplicationDetail.jsx`

The environment selector partly exists already: `deploymentEnvironmentFilter` (line 1932) filters deploy history by environment string. That becomes the real selector — picked once at the top, scoping both the metadata panel and the deploy history, instead of a metadata box describing one environment and a separate filter for the list. Net reduction in UI.

Hidden entirely when the app has one environment, per decision 9.

### `CICDDeploymentView.jsx`

The sample payload hardcodes `"environment": "{env}"` in both generators — line 129 (curl) and line 148 (wget). Both become the app's actual environment names joined with `|`, e.g. `"{prod|qa|uat}"`, or the bare name when there is only one. The note at line 325 ("replace the example values with your actual deployment data") should state that the environment must match one of the listed names.

### Deploy History

An "Unassigned" group for deployments with a null `environmentId`, showing the raw submitted string, so a pipeline sending `Prod` against an environment named `prod` is visible and fixable from either side.

### Environment Management

CRUD for the company vocabulary — name, kind, status, display order. Plus triage for unassigned deployments: adopt a raw string into an existing environment, or create a new one from it.

### Tag Picker

`IntegrationTagPickerModal` becomes three dependent selects (product → application → environment) reflecting the triple, instead of a flat list of `Application:`-prefixed strings.

## Phased Delivery Order

1. Phase 1 — schema, migration, backfill. Safe to land alone; nothing reads the new tables yet.
2. Phase 2 — resolution service and both deployment write paths. Environments start populating from CI.
3. Frontend: token screen sample command + Unassigned bucket. Pipelines can be corrected before anything depends on them.
4. Frontend: environment management + selector.
5. Phase 3 — field migration and read resolvers. **Gated on the shared field registry.**
6. Phase 4 — Wiz tag triple and per-environment linking.

## Open Questions To Confirm During Build

1. **Do duplicate application names exist within any company?** `@@unique([companyId, name])` will fail the migration if so. Needs a check against production data before step 5, and a decision on how to resolve collisions. Also needs confirming that nothing in CSV import or the merge-at-approval path relies on duplicates being allowed.
2. **Is `Product` in the Wiz tag redundant?** `ProductApplication` is many-to-many, so an application can sit under two products. If that happens in practice, the `Product` tag value carries information the app/environment pair does not, and resolution needs all three keys. If a deployed instance always belongs to exactly one product, the tag is human-readable context and the key is just application + environment.
3. **Do retired environments keep their Wiz tag links?** Retained is probably right — the tag still describes what ran there — but it affects whether retired instances appear in the tag picker.
4. **Who can create environments?** Company users, or admins only? Affects whether the Unassigned triage flow is self-service.
5. **Should the two scan dates that stay on `Application` remain approvable?** They are still operational data written by integrations rather than submitter claims. Removing them from the version lists is defensible on those grounds but is not required by this plan, since their columns keep holding the truth. Owned by the field-registry work.

## Definition of Done

- An application can hold several environments; each carries its own domain(s), current version, git branch, and DAST scan date.
- One application with one environment looks exactly as it does today — no new UI surfaces.
- A CI deploy naming a known environment attaches to it and overwrites that environment's version and branch. A deploy naming an unknown one is recorded, visible under Unassigned, and creates nothing.
- The token setup screen shows the app's real environment names.
- Scoring output is unchanged except that `lastDastScanDate` is the most recent across active environments, and the UI shows which environment it came from.
- `services/scoring.js` is unmodified.
- The four moved fields appear in no version snapshot, diff, or approval list, and no code reads them off `Application`.
- No derived or mirrored per-environment column exists on `Application`.
