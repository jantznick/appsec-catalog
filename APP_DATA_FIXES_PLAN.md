# Application Data — Immediate Fixes

Companion to `APP_DATA_MODEL_EXPLORATION.md`. This document covers only the changes
that are unambiguous defects: the behaviour is wrong today, the correct behaviour is
not a matter of opinion, and the fix needs no schema migration and no product decision.

Everything that requires a modelling decision — new columns, environments, products,
structured auth, AI inventory — is deferred to the exploration doc.

## Scope

Application-specific data only: the `Application` record and the tables hanging
directly off it. Two intake forms (manager, technical), CSV import, the detail
editor, and the API-key write path.

## Background

The two intake forms ask structured questions — radios, checkboxes, selects — and the
API flattens the answers into free-text sentences before storing them. Scoring and
policy then try to recover the structure by substring-matching those sentences.

Fixing that properly means new columns and a backfill, which is Phase 2 work. The
fixes below are the subset that can land first: they stop data being lost, stop
scores moving for reasons unrelated to security posture, and reduce the blast radius
of the flattening while it still exists.

---

## Phase 0 — Fixes landing now

### 0.1 Marking metadata as reviewed lowers the score it saves

**Symptom.** An admin clicks "Mark as reviewed" and the application's score drops on
every dashboard.

**Cause.** Four call sites recompute and persist a score. Three load the application
with `apiSchema` included; `POST /:id/review` (`routes/applications.js:1890`) does
not. An uploaded API schema is what earns the API-security tool category, so the
review endpoint writes a score with that category zeroed while still counting it in
the denominator. Dashboards read the most recent `Score` row, so the bad value wins.

**Fix.** Add `apiSchema: { select: { id: true } }` to the review endpoint's include,
matching the other three call sites.

**Follow-up.** The include is duplicated at four call sites and will drift again.
Extract a single `applicationScoringInclude` constant and use it everywhere.

**Verify.** Upload an API schema, note the score, mark as reviewed, confirm the score
is unchanged.

---

### 0.2 A GET request writes a database row

**Symptom.** The `Score` table grows without bound. Score history reflects page views
rather than changes in posture.

**Cause.** `GET /api/applications/:id/score` (`routes/applications.js:688`) inserts a
new `Score` row on every call. Dashboards then load *every* score row for every
application in scope, sort by date and keep the first
(`routes/dashboard.js:58`, `:180`) — an unbounded query whose cost grows with traffic.

**Fix.**
- Remove the `prisma.score.create` from the GET handler. The response already carries
  freshly computed values; nothing needs the row to be written to render the page.
- Where scores *are* persisted (create, update, approve, review), write only when the
  computed value differs from the latest stored row.
- Add `take: 1` per application to the dashboard reads, or select the latest row per
  application rather than sorting the whole table in memory.

**Risk.** Score history becomes sparser. That is the intent — the current history is
not a record of change, and any trend chart built on it is reading traffic patterns.

**Verify.** Load an application page repeatedly; confirm no new `Score` rows.

---

### 0.3 "Anything else we should know" is written to the wrong column

**Symptom.** An application's business purpose grows longer every time an engineer
resubmits the technical form, mixing two authors' content. The `additionalNotes`
column stays null.

**Cause.** `routes/applications.js:520` concatenates the technical form's
`additionalNotes` onto `description` separated by three newlines, while line 550
explicitly carries the real `additionalNotes` column over unchanged. Each
resubmission appends again.

**Fix.**
- Write `additionalNotes` to `additionalNotes`. Leave `description` alone.
- Render and edit `additionalNotes` on the application detail page — it is currently
  writable from CSV import, the New Application page and the API, appears in version
  diffs, and is displayed nowhere.

**Not in scope.** Existing rows have engineer notes already fused into `description`.
Splitting them is a backfill question and belongs with the Phase 2 migration, where
the `\n\n\n` delimiter is a usable (if imperfect) seam.

**Verify.** Submit the technical form twice with different notes; confirm
`description` is unchanged and `additionalNotes` holds the latest submission.

---

### 0.4 The manager form drops the "Other" critical aspect

**Symptom.** A manager who stages several applications with "Add Application" loses
the free-text "Other" aspect on all of them except the last.

**Cause.** `pages/OnboardManager.jsx:199` merges `criticalAspectsOther` into the
aspects list only for the application still sitting in the form at submit time.
Applications already staged keep `criticalAspectsOther` as a separate key that the
API does not read.

**Fix.** Do the merge in `handleAddApplication` when the entry is staged, so every
queued application carries a complete `criticalAspects` value. Same normalisation
function for both paths.

**Verify.** Stage two applications, each with a distinct "Other" value, submit, and
confirm both are stored.

---

### 0.5 PCI/PII/PHI detection matches ordinary English

**Symptom.** Applications are silently held to a stricter security bar than their
team ever claimed.

**Cause.** With no boolean columns to read (see 0.6), scoring falls back to
substring-matching the flattened `dataTypes` string
(`services/scoring.js:449`). It uppercases each comma-separated fragment and tests
`includes("PHI")` / `"PCI"` / `"PII"`:

```
"Storage: S3 plus a graphics CDN"  ->  GRAPHICS contains PHI  ->  PHI = true
"Hosted in Memphis"                ->  MEMPHIS  contains PHI  ->  PHI = true
"Delphi service layer"             ->  DELPHI   contains PHI  ->  PHI = true
```

A false PHI hit raises the risk weight on all five tool categories.

**Fix.** Match whole tokens, not substrings — compare each trimmed fragment against
the classification word with a word-boundary check rather than `includes`. This is a
stopgap that reduces false positives; it does not make the string reliable. The real
fix is 0.6 plus the Phase 2 columns.

**Verify.** Add a test fixture with each of the three strings above and assert no
classification is detected.

---

### 0.6 Scoring reads three columns that do not exist

**Symptom.** None visible — which is the problem.

**Cause.** `services/scoring.js:429` checks `app.pciData`, `app.piiData` and
`app.phiData` before falling back to string parsing, with a comment saying the
boolean fields are "more accurate". Those columns are not on the `Application` model.
The check is always `undefined`, so the fallback in 0.5 is the only path that ever
runs.

**Fix now.** Comment the dead branch honestly, or remove it, so nobody reading the
scorer believes structured data is in play. Do not delete the intent — Phase 2 adds
these exact columns and the branch becomes live.

**Fix in Phase 2.** Add `pciData`, `piiData`, `phiData` as nullable booleans, populate
them from the technical form, and the existing branch starts working as written.

---

### 0.7 `facing` is compared case-sensitively in one place and not another

**Symptom.** A CSV row with `internal` in the facing column is scored as though the
field were blank — which the scorer resolves by assuming External, the worst case.

**Cause.** Scoring tests `app.facing === 'External'` exactly
(`services/scoring.js:304`). The policy engine lowercases both sides before comparing
(`services/policy.js:69`). Two consumers, two answers, same column.

**Fix.** Normalise on comparison in scoring, matching the policy engine. Separately,
normalise on write so the stored value is canonical going forward.

**Note.** The proper fix is an enum, which is Phase 2. This makes the two existing
consumers agree in the meantime.

**Verify.** Import a CSV with `internal`, `Internal` and `INTERNAL`; confirm all three
score identically.

---

### 0.8 `businessCriticality` is never range-checked

**Symptom.** Values outside 1–5 are accepted and push the importance calculation past
its intended ceiling. Decimal values from CSV are silently truncated.

**Cause.** All four write paths call `parseInt` with no bounds. The CSV importer
parses the cell with `parseFloat` first, so `4.9` passes client validation and
becomes `4` on the server.

**Fix.** One shared coercion helper: integer, clamped to 1–5, rejecting out-of-range
input with a 400 rather than storing a silently altered value. Apply on all four write
paths.

**Verify.** POST `businessCriticality: 10` and `4.9`; both should be rejected with a
clear message rather than stored.

---

### 0.9 Bulk import logs the full request payload

**Symptom.** Contact details and data-handling descriptions land in container logs,
which have different retention and access than the database.

**Cause.** `routes/applications.js:2718`, `:2765` and `:2861` print
`JSON.stringify(applications)` for the whole request and again per row.

**Fix.** Remove the payload logging. Keep a single summary line — company, row count,
created ids — which is what the logs are actually useful for.

---

### 0.10 CSV auto-mapping claims any column containing "name" or "app"

**Symptom.** "Owner Name", "Tool Name" and "App Owner" are proposed as the
application name. Meanwhile "SAST Tool" never matches `sastTool` and is left unmapped.

**Cause.** `BulkImportApplicationsModal.jsx:188` maps a header to the required `name`
field if the lowercased header contains "name" *or* "app". The second rule matches on
the raw field key with no separator handling.

**Fix.**
- Drop the "app"/"name" substring rule. Match the required field on an exact,
  normalised header (`name`, `application name`, `app name`).
- Normalise separators on both sides before comparing (`sast tool` -> `sasttool`) so
  the ordinary human header matches.
- Leave anything ambiguous unmapped rather than guessing. The mapping screen already
  shows the user every column; an unmapped column is visible, a wrongly mapped one is
  not.

**Also.** The component's state comment describes a step 3 review screen that does not
exist — the import fires straight from the mapping step. Either build the review step
or correct the comment; a preview before a write that cannot be undone is worth
having, but it is a product decision rather than a defect fix.

---

## Phase 1 — Structural, still no data migration

These are larger but carry no schema change and no product decision. Recommended
before any Phase 2 work touches the data.

### 1.1 One field registry

`routes/config.js` already holds most of a field catalogue — path, label, category,
type, allowed operators, value options — built for the policy field picker. The same
list is hand-maintained in seven other places:

- the `Application` and `ApplicationVersion` models (two parallel column lists)
- `createApplicationVersion` (snapshot copy)
- `createVersionFromData` (pending-version copy, with its own coercion rules)
- `compareVersions` (diff list)
- `applyApprovedVersion` (apply list)
- `BulkImportApplicationsModal.APPLICATION_FIELDS` (CSV column list)

A field missing from the diff list is invisible in version history. Missing from the
apply list, it is silently discarded on approval. Neither failure raises an error.

Promote the catalogue to a shared module and generate the version snapshot, diff and
apply lists from it.

### 1.2 One completeness definition

Four field lists currently answer "how complete is this application record?":

| Definition | Fields | Location |
|---|---|---|
| `KNOWLEDGE_SCORING_FIELDS` | 8 | `services/scoring.js` |
| `calculateCompleteness` | 21 | `services/completeness.js` |
| `calculateCompleteness` | 21 | `frontend/src/utils/applicationCompleteness.js` (hand-mirrored) |
| Basic + Technical + Security | 14 + 11 | `utils/portfolioCompleteness.js` |

`owner` counts in two of them. `criticalAspects` and `currentVersion` count in exactly
one. `devTeamContact` counts in two — a different two. One application therefore has
several defensible completeness percentages depending on the screen.

Collapse to one implementation, parameterised by which field set a caller wants, and
share it between frontend and backend rather than mirroring it by hand.

### 1.3 Validate policy field paths

`PolicyControlField.fieldPath` is stored and read as a free string with no check that
it names a real column (`services/policy.js:11`, `routes/policyControls.js:142`). A
typo resolves to `null`, fails the `exists` operator, and marks every application
non-compliant for that control — permanently and silently. Validate against the
registry from 1.1 on save.

### 1.4 Tests

The repository has no test files. Scoring, completeness and version round-tripping are
pure functions with dense branching, and are where most of the defects above live.
Table-driven tests for those three should land before Phase 2 changes any data.

---

## Deferred to the exploration doc

Not defects, or not decidable without a product call:

- New columns for the twelve technical-form answers that have nowhere to land
- Retiring the `"NA"` string sentinel
- `interfaces` as a join table rather than JSON in a `String` column
- Environments as first-class objects
- Products absorbing the repo/deployable-unit relationship
- Structured authentication with an escape hatch
- AI and third-party component inventory
- Ownership as a relation rather than free text
- Lifecycle state separate from onboarding state
- Public endpoint exposure and invite-link tokens

`GET /api/applications/public/:id` returning the full application row without
authentication is a real exposure and arguably belongs in Phase 0. It is listed here
because narrowing it means deciding what the technical form is allowed to prefill,
which is a small product decision rather than a pure fix.
