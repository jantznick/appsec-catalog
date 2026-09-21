# Frontend Coverage Audit

Backend capability shipped in the three merges of 2026-09-22 (PRs #31, #32, #33) that the
frontend cannot set, cannot display, or displays wrongly — plus the items deferred along
the way.

## Why this document exists

I verified the policy-control work by calling the API and reading the response. All 27
control mappings were created with `fetch`. That made the backend provably correct and
said nothing about whether the product worked.

Two symptoms Nick found by using the app:

1. The control editor showed operator **Exists** for a control stored as
   `within_days 183`, with a date picker next to the words "No value needed".
2. The control list rendered the raw string `within_days` rather than a label.

Both come from the same cause, and when I first hit that gap I wrote a hint into
`validationRules.description` — *"For 'reviewed at least every six (6) months' use
within_days with value 183"* — telling the user to do something the UI cannot do.
Documenting a limitation instead of fixing it.

**Nothing new gets built until this list is closed.**

---

## Status

Branch `claude/policy-gaps-followup`. Run `npm test` in `backend/` (149 cases) and
`npx vite build` in `frontend/` before any commit here.

| | Item | State |
|---|---|---|
| — | Version snapshots silently failing | **done** `ee23c00` |
| — | IaC / container N/A option | **done** `133b77a` |
| F1 | Editor destroys rolling-window mappings | **done** `04e6ad5` |
| F2 | Editor cannot set scope / verification / attestation | **done** `c0e4d30` |
| F4 | Dashboards understate compliance | **done** `891d30c` |
| F3 | Field registry served; VersionHistory, PendingApprovals, SplitApplicationModal | **done** `feddfcc` |
| F3 | OnboardApplication, ApplicationNew, BulkImportApplicationsModal | **done** `d6ff567` `fb58203` |
| F5 | Statuses handled in one file only | **done** `125d752` — three of the five files I named did not exist |
| F6 | Attestations cannot be listed | **done** `ad94bf6` |
| F7 | 25 uncalled client methods, untriaged | **done** — triaged, no code change; none came from today's merges |
| D1 | One `calculateCompleteness` driving the score | **next** — **explicitly requested** |
| D2 | Remove `securityTestingDescription` | open |
| D3 | Point 4.6.14 at `iacContainerScanNA` | open — needs the migration applied |
| D4 | Regenerate the prod import script | open |
| D5 | 4.6.4 / 4.6.10 | blocked on the environments workstream |

### Migrations awaiting `prisma migrate deploy`

- `20260922140000_version_secrets_iac_columns`
- `20260922150000_add_iac_container_na`

### Decision taken for the next item

The Phase 6a tool fields go **into the technical onboarding form**, which means the five
tool entries (`secretsScanTool`, `secretsScanIntegrationLevel`, `sastIncludesSecrets`,
`iacContainerScanTool`, `iacContainerScanIntegrationLevel`, plus `iacContainerScanNA`)
must flip to `approvable: true` in `services/applicationFields.js`.

The rule is *approvable iff the technical onboarding form posts it* — that tab writes
through `PUT /:id`, which never enters the approval path, so only the onboarding form
creates a pending version. `applicationFields.test.js` pins the non-approvable set in
`ADDED_SINCE_REGISTRY`, and `applicationVersionColumns.test.js` asserts every approvable
field has a snapshot column. Both must be updated in the same commit.

The two scan dates (`lastSecretsScanDate`, `lastIacContainerScanDate`) stay
`approvable: false`, matching `lastSastScanDate` and `lastScaScanDate`: they are derived
from scanner integrations, so applying a months-old snapshot over the current value would
regress the freshness component of the tool score.

---

## Findings

Ordered by damage. Every item states how it was verified.

### F1 — The control editor silently corrupts mappings on save

`frontend/src/lib/policyDisplay.js` holds a **fourth** hardcoded operator list
(`POLICY_OPERATORS`, 11 entries). It is missing `within_days` and `older_than_days`.

`getOperatorsForField` in `frontend/src/pages/PolicyControls.jsx` intersects that list
with the backend's `allowedOperators`, so the dropdown **cannot offer** either operator.
A `<Select>` whose stored value is not among its options renders the first option, so the
editor shows `exists` — and **saving writes `exists`**, destroying the mapping.

Affected controls: **4.6.3, 4.6.6, 4.6.7, 4.6.10, 6.3.12.**

Also wrong on that row: the value input renders as a date picker (from `fieldType: date`)
while the helper text reads "No value needed" (because the UI believes the operator is
`exists`). For these operators the value is a **count of days** and should be a number.

- [x] Add both operators to the frontend list with clear labels
- [x] Render a number input for day-count operators
- [x] Make an unrecognised stored operator visible rather than silently replaced

**Fixed.** The corruption was not the `<Select>` coercing a value — `PolicyControls.jsx`
line 420 *deliberately* rewrote an unrecognised operator to the first available one on
load:

```js
operator: isValidOperator ? f.operator : (availableOperators[0]?.value || 'exists'),
```

It now preserves `f.operator` verbatim, and `getOperatorOptionsFor` guarantees the stored
value is present in the options, labelled `(not supported by this UI)` when this list is
behind the engine. So the next operator added degrades to an ugly label instead of
destroying data.

The `validationRules.description` hint that told the user to type `within_days` has been
reworded to name the dropdown option, since the dropdown now has one.

Verified: 8 assertions over the helpers. **Not yet verified in the browser** — the running
dev server is served from the main checkout, not this worktree, so it needs a pull first.

> The last point is the durable fix. Four independent operator lists existed; the backend
> two were unified in #31 by deriving `POLICY_OPERATORS` from the engine's
> `IMPLEMENTED_OPERATORS`. The frontend copy was missed. A select that silently discards
> a value it does not recognise will cause this again with the next operator.

### F2 — The editor cannot set seven properties the API accepts

Verified: zero occurrences in `PolicyControls.jsx` of `verificationRequired`,
`verificationNote`, `appliesWhenLogic`, `allowsAttestation`, `attestationValidDays`,
field `role`, or `applies_when`.

So everything from Phase 2a and Phase 4 is API-only. Through the UI you cannot:

- scope a control to the applications it applies to (`applies_when` role + logic)
- mark a control as needing human verification, or write the note explaining why
- make a control attestable, or set its re-attestation period

- [x] Field role selector (compliance / applies_when) per field row
- [x] Applies-when logic (AND/OR), alongside the existing evaluation logic control
- [x] Verification required + note
- [x] Allows attestation + validity days

**Fixed.** A "Scope and evidence" section on the control form, plus a per-field
**Check type** selector (Compliance / Scope). The note and validity inputs appear only
when their checkbox is on, and the payload omits `attestationValidDays` unless
attestation is enabled, since the API rejects an empty value rather than defaulting.

One trap worth recording: the form is reset in **five** places with different
indentation, and an early attempt matched a four-space pattern as a substring of the
six-space lines, duplicating keys. The fix captures whatever indentation is present and
skips objects already carrying the properties.

Verified by sending the exact payload the form now builds to the running API: 200, with
roles, `within_days 90` and `appliesWhenLogic: OR` all round-tripping.

### F3 — Six of seven application forms are missing all eight new fields

The Phase 6a fields (`secretsScanTool`, `secretsScanIntegrationLevel`,
`sastIncludesSecrets`, `iacContainerScanTool`, `iacContainerScanIntegrationLevel`,
`iacContainerScanNA`, `lastSecretsScanDate`, `lastIacContainerScanDate`) appear in
`ApplicationDetail.jsx` and nowhere else.

| Form | Fields present |
|---|---|
| `ApplicationDetail.jsx` | 8 of 8 |
| `OnboardApplication.jsx` | 0 |
| `ApplicationNew.jsx` | 0 |
| `BulkImportApplicationsModal.jsx` | 0 |
| `SplitApplicationModal.jsx` | 0 |
| `PendingApprovals.jsx` | 0 |
| `VersionHistory.jsx` | 0 |

Consequences, each distinct:

- A team cannot declare secrets or IaC scanning **at intake**, only by editing afterwards
- A CSV import cannot carry them, though `buildBulkImportRow` accepts them
- A split does not show them, though the registry marks them `splittable`
- Version history does not display them, though they are now `versioned`
- The approval queue does not show them

> Note the intake gap is also why these are `approvable: false`: the onboarding form does
> not post them, so a pending version could only ever carry a stale copy. **If they are
> added to the onboarding form, the `approvable` flags must change with them.**

- [ ] Decide which forms should carry them, then add and flip `approvable` to match

### F4 — The executive dashboard understates compliance

`frontend/src/components/dashboard/ExecutiveDashboard.jsx` renders
`meetingControls` of `totalControls`, and `PersonaDashboards.jsx` renders
"N of M controls meeting".

`totalControls` now includes controls that are `not_applicable`, `attested` and
`verification_required`. A control correctly scoped out of an application, or legitimately
attested, counts in the denominator and not the numerator — so the figure reads worse than
reality, on the dashboard most likely to be shown to an executive.

The backend already returns what is needed and nothing consumes it:
`applicable`, `attested`, `verification_required`, `not_applicable`,
`measured_compliance_percentage`, `verificationRequiredControls`,
`notApplicableControls`.

- [x] Use `applicable` as the denominator
- [x] Surface attested separately from measured, per the reporting split #31 introduced

**Fixed.** Both dashboard rollups in `routes/dashboard.js` divided by `totalControls`, and
neither counted `attested` at all — that counter did not exist. Both now expose
`attestedControls`, `applicableControls` (`total − not_applicable`),
`compliancePercentage` as `(meeting + attested) / applicable`, and
`measuredCompliancePercentage` as `meeting / applicable`.

The executive tile reads `N of M applicable controls` with a detail line naming the split
— measured, attested, awaiting verification, not applicable — so a self-reported figure is
never mistaken for a measured one.

### F5 — The three new statuses are handled in exactly one file

`verification_required`, `not_applicable` and `attested` appear only in
`PolicyComplianceView.jsx`. Five other files render compliance data
(`ApplicationMappingsCard.jsx`, `PersonaDashboards.jsx`, `ExecutiveDashboard.jsx`,
`ProductDetail.jsx`, `ApplicationDetail.jsx`).

- [ ] Audit each for status handling; a shared status-presentation helper would stop the
      next state needing six edits

### F6 — Attestations cannot be listed

`api.getApplicationAttestations` exists and no screen calls it. You can attest and
withdraw from a control row, but there is no way to see which attestations exist on an
application, who made them, what was stated, or when they expire.

Expiry is the whole point of the model. Without a view, nobody can see what is about to
lapse.

- [ ] Attestations list, with expiry dates and the statement

### F7 — Twenty-six API client methods no screen calls

Beyond the attestation entry above, and excluding the five environments methods, which are **not** a gap: the environments UI is
planned work in that workstream's own phases and has not started. Its client methods
exist ahead of the screens by design.

`assignUserToCompany`, `createApplicationOnboard`, `getAdminSecurityFindingsJob`,
`getAiAvailability`, `getAiUsageMine`, `getApplicationApiSchema`, `getApplicationVersion`,
`getCompanySecurityFindingsJob`, `getOktaStatus`, `getPendingUsers`,
`getPlatformDocsIndex`, `getPolicyControl`, `getProductDataFlows`,
`getProductIngressPoints`, `getProgramRequestOptions`, `removeUserFromCompany`,
`reorderContentAssets`, `reviewSammAssessment`, `searchScmDependencies`,
`updatePolicyControlOrder`, `updatePolicyOrder`.

**Triaged by asking when each was introduced** (`git log -L` on its line in `api.js`),
which is the question the audit was actually about: did today's merges ship server-side
capability with no screen?

They did not. Every uncalled method predates the three branches:

| Introduced | Methods |
|---|---|
| 2026-05-11 (`init`) | `assignUserToCompany`, `createApplicationOnboard`, `getAdminSecurityFindingsJob`, `getApplicationVersion`, `getCompanySecurityFindingsJob`, `getPendingUsers`, `getPolicyControl`, `getProductDataFlows`, `getProductIngressPoints`, `removeUserFromCompany`, `updatePolicyControlOrder`, `updatePolicyOrder` |
| 2026-07-14 | `getApplicationApiSchema` |
| 2026-07-17 | `getOktaStatus` |
| 2026-08-04 | `searchScmDependencies` |
| 2026-08-11 | `reviewSammAssessment` |
| 2026-08-18 | `getAiAvailability`, `getAiUsageMine` |
| 2026-08-31 | `getPlatformDocsIndex`, `getProgramRequestOptions` |
| 2026-09-14 | `reorderContentAssets` |
| 2026-09-16 | `createEnvironment`, `updateEnvironment`, `deleteEnvironment`, `getEnvironmentKinds` — the environments workstream, UI planned for later by design |

The newest non-environments entry is nine days older than the oldest of the three
merges. So F7 is a standing backlog item about the rest of the application, not a
consequence of this work, and building twenty-five screens is not in this scope.

Two of them are worth raising separately because they are capability with no way in:
`updatePolicyOrder` and `updatePolicyControlOrder` mean policies and controls carry a
display order the server can change and no screen can set, so the compliance view's
ordering is whatever the seed data happened to be.

- [x] Triaged: none from today's merges; the rest is pre-existing backlog

---

## Deferred items

Recorded because the last plan document became the definition of done and Nick's
instructions that were not in it fell out. These are not audit findings; they are
outstanding work.

### D1 — One `calculateCompleteness` driving the 0-100 score — **explicitly requested, not done**

Nick, verbatim: *"there should only be a single calculateCompleteness function, and that
should drive the 0-100 score, the dashboard % and come from the app data tab form"*, and
*"completeness should be only app metadata"*.

Current state, verified on main: `services/scoring.js` still has its own hardcoded
`KNOWLEDGE_SCORING_FIELDS` (eight text fields) and does not import `completeness.js`.
Two definitions of completeness still coexist.

Required:

- [ ] Add a `kind: 'metadata' | 'tool'` axis to `services/applicationFields.js`. It cannot
      be a filter over the existing `group` values: `group: 'security'` mixes tool fields
      with submitter claims (`authProfiles`, `dataTypes`, `securityTestingDescription`),
      so filtering it would strip three fields that should stay.
- [ ] Point `calculateKnowledgeSharingScore` at a metadata field set
- [ ] Update `completeness.differential.test.js` in the same commit with the new
      expectation stated explicitly

Measured impact across the 91 dev applications: knowledge completeness moves **22/40 →
11/40**, about 11 points off the 100-point total. It re-ranks rather than uniformly
lowering — a few applications rise, because they have tool data but not the eight text
fields.

### D2 — Remove `securityTestingDescription`

Hard to score, low signal by default. Present in **seven** frontend files
(`BulkImportApplicationsModal`, `SplitApplicationModal`, `VersionHistory`,
`ApplicationDetail`, `ApplicationNew`, `OnboardApplication`, `PendingApprovals`), plus the
registry. Not in any completeness field set, so removal is smaller than it first appears.

- [ ] Remove the field and its registry entry

### D3 — Point 4.6.14 at `iacContainerScanNA`

The column now exists (`20260922150000`). Once applied, 4.6.14 should use it as an
`applies_when` check so an application declaring N/A reports `not_applicable` rather than
failing. Blocked only on the migration.

### D4 — Regenerate the prod import script

The `orbit-policies.json` and import script produced early in this work predate Phase 2a.
They would seed the original mappings: 4.6.3 and 4.6.7 empty, 4.6.6 with two fields, no
secrets or IaC, no attestation flags.

### D5 — Blocked on the environments workstream

The environments UI (management screen, per-application selector), the adopt/triage
endpoint, and the Wiz tag triple are that workstream's planned phases, not gaps in this
one. Listed only so the dependency is visible.


- 4.6.4 mapping. Its author confirmed the records evidence only that environments exist,
  not that they are separated, so it lands as `verification_required`.
- 4.6.10 remap when `lastDastScanDate` moves to the instance. Nick's ruling: **any**
  environment, not production-only.

---

## What this audit cannot find

It compares what the backend can express against what the frontend references. It finds
"never called" and "cannot express a known value". It does **not** find "renders, but
wrongly" — the date picker beside "No value needed" was found by a person using the app,
not by any grep here.

So this list is a floor, not a ceiling. Walking the UI will find more.

---

## How the work changes

1. **No backend capability lands without the UI that exercises it.** If the UI is a
   separate piece of work, the backend waits.
2. **Verification happens through the browser, not the API.** A 200 response is not
   evidence that a feature works.
3. **A limitation never gets documented in place of being fixed.** The `within_days` hint
   is the example not to repeat.
4. **A hardcoded list that mirrors another is a defect**, not a maintenance task. Four
   operator lists existed; two were unified and the frontend pair was missed.
