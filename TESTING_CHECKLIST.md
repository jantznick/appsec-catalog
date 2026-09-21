# Testing checklist — `claude/policy-gaps-followup`

Everything on this branch was verified with `node --test` (156 cases) and
`npx vite build`. **None of it was opened in a browser.** That is the same gap that
produced the findings in `FRONTEND_COVERAGE_AUDIT.md`, so this list exists to be
clicked through rather than read.

Ordered by how much damage a regression would do.

## 0. Before anything

```bash
cd backend && npx prisma migrate deploy
```

Two migrations are pending. Until they run, **version history and the pending-approval
queue are silently broken** — `createApplicationVersion` catches its own error and
returns null, so nothing appears in the queue and no exception reaches the UI.

- `20260922140000_version_secrets_iac_columns`
- `20260922150000_add_iac_container_na`

Then restart the backend so the new Prisma client is loaded.

**Confirm the migration actually fixed the queue** before testing anything else: edit
any application's App Data tab, save, and check Pending Approvals has an entry. If it
is empty, nothing below that involves approval will mean anything.

---

## 1. Version history and approvals (highest risk)

| # | Do | Expect |
|---|---|---|
| 1.1 | Edit an application's App Data tab, change Language, save | An entry appears in Pending Approvals |
| 1.2 | Open that pending version | The diff shows Language old → new |
| 1.3 | Approve it | The application shows the new value |
| 1.4 | Open the application's Version History | The change is listed with both values |
| 1.5 | Edit **Secrets Scanning Tool** on the Security tab, save, open Version History | The field appears in the diff **by name**, not omitted. This is the field-registry fix — before it, seven fields were invisible in five places |
| 1.6 | Split an application | The secrets and IaC fields carry to the new application |

## 2. The intake forms (new fields)

### 2.1 Technical onboarding form (the public link)

Settings → a company → copy the onboarding link, open it in a private window.

| # | Do | Expect |
|---|---|---|
| a | Answer **Yes** to "Is there any security testing in place" | There is **no** "Describe the security testing in place" textarea any more |
| b | Scroll the Security Tools block | New: "SAST output includes secrets scanning" checkbox, and "No infrastructure-as-code or container images (N/A)" |
| c | Tick "SAST output includes secrets scanning" | The Secrets Scanning Tool / Integration Level pair **disappears**, replaced by a note |
| d | Untick it | The pair comes back |
| e | Tick the IaC N/A checkbox | The IaC Tool / Integration Level pair disappears |
| f | Fill secrets tool + level, leave IaC as N/A, submit | Success |
| g | As an admin, open Pending Approvals, find that submission | The diff shows `secretsScanTool`, `secretsScanIntegrationLevel`, `iacContainerScanNA` |
| h | **Approve it**, then open the application's Security tab | **The values are actually there.** This is the `approvable: true` fix — before it, approval accepted the submission and threw the values away with no error |
| i | Re-submit the same form with the IaC N/A box **unticked** | After approval, `iacContainerScanNA` is false, not stuck at true. This is the unchecking fix — every checkbox on that route previously could be turned on but never off |
| j | Answer **No** to "security testing in place", submit | No tool values are carried over from a previous answer |

### 2.2 Admin intake (Applications → New)

| # | Do | Expect |
|---|---|---|
| a | Scroll to Security Tools | The two new checkboxes and both tool/level pairs are present |
| b | There is no "Security Testing Description" textarea | Correct — it was removed |
| c | Create an application with secrets + IaC filled in | Open it: the Security tab shows what you entered |

### 2.3 CSV bulk import

| # | Do | Expect |
|---|---|---|
| a | Applications → Bulk Import, upload a CSV with a `Secrets Scanning Tool` column | The column auto-maps; it is in the target dropdown |
| b | Open the target dropdown | **36** fields, including IaC / Container Scanning Tool, IaC / Container Not Applicable, SAST includes secrets scanning, and both legacy API Security fields. No "Security Testing Description" |
| c | Import and open a created application | The secrets/IaC values are stored, not dropped |
| d | Stop the backend, reopen the modal | The dropdown still populates (the fallback list) rather than being empty |

## 3. Completeness and the 0-100 score (numbers will move)

This is the change most likely to surprise you. **Percentages across the app will be
different from yesterday, deliberately.**

| # | Do | Expect |
|---|---|---|
| 3.1 | Applications list, look at the `filled/total (%)` next to a status | The denominator is **13**, not 27 |
| 3.2 | Hover it | Tooltip: "Application metadata answered, from the App Data tab. Security tooling is not counted." |
| 3.3 | Pick an application, blank every security tool field, save | The completeness percentage **does not change**. Security tooling is no longer part of completeness |
| 3.4 | Fill in `Current Version`, `Deployment Type`, `Critical Aspects`, `Business Criticality` on the App Data tab | Completeness rises **and** the knowledge score rises. They now move together — before, the score asked 8 questions and the percentage asked 27 |
| 3.5 | Open the score breakdown (the knowledge component) | Missing fields are listed by their App Data tab labels, e.g. "Auth Profiles" not "Authentication Profiles" |
| 3.6 | Set a description to three spaces and save | It counts as **missing**, not filled. The whitespace rule unified on trim |
| 3.7 | Dashboard → onboarding completeness | The average moved. Sanity-check a couple of applications by hand against their App Data tab |
| 3.8 | Company portfolio CSV export | The metadata column moved by roughly one field's worth (`name` left the denominator); the security column is unchanged from yesterday |

**Judgement call worth confirming or rejecting:** `name` and `companyId` are excluded
because they can never be blank, and `owner` is excluded because the App Data tab does
not ask for it. If you want any of them counted, it is one line in
`backend/services/completeness.js`.

## 3b. The tool score now has seven categories

Secrets and IaC/container scanning are graded. **Do this first — until a tool is
credited in the new categories, every application scores zero in both.**

| # | Do | Expect |
|---|---|---|
| 3b.1 | Settings → Scoring → Tool quality | Each tool row now has six category checkboxes: SAST, DAST, SCA, **Secrets**, **IaC / Container**, Firewall |
| 3b.2 | Tick **Secrets** on the tools that genuinely cover it, **IaC / Container** likewise, and save | Saves without a validation error; reload shows them ticked |
| 3b.3 | Reopen an application with a secrets tool named | Its tool score rises now that the tool is credited |
| 3b.4 | Name a tool that is *managed for something else* (e.g. Snyk) as your secrets tool, without ticking Secrets for it | Scores **0** for that category, not the 0.8 unknown-tool fallback. That is existing behaviour — a managed tool only earns credit in its listed categories — but it bites here because the config ships with nothing credited for the new ones |
| 3b.5 | Tick "SAST output includes secrets scanning" on an application, leave the standalone fields blank | The score **rises**. It is judged as your SAST tool. Before this change it scored zero, making the checkbox worse than useless |
| 3b.6 | Tick the IaC N/A box on an application with no containers | The score **rises** — the category leaves the denominator rather than sitting at zero |
| 3b.7 | Leave `iacContainerScanNA` unanswered with no tool | Still scores zero. Unanswered is a gap; only an explicit N/A is an answer |
| 3b.8 | CSV importer dropdown | **No** "Legacy API Security Tool" or "Legacy API Security Integration Level" — there is no API security tool in this product, and I had wrongly added them |

**Worth a decision:** the shipped `toolQuality.json` credits no tool for secrets or
IaC. Until you tick those boxes every application loses two categories' worth of score,
so portfolio numbers will dip before they recover.

## 4. Policy compliance display

| # | Do | Expect |
|---|---|---|
| 4.1 | An application → Infosec Policy Compliance | Summary cards: Total, Meeting, Not Meeting, Attested, Verification Required, Not Applicable, Compliance Rate |
| 4.2 | If any control is scoped out | Under "Total Controls", a smaller "N applicable" line |
| 4.3 | Expand a policy | The header reads "**X of Y applicable controls met (Z%)**", and the three numbers agree. If any control is attested or N/A it says so. Before, it read "3 of 5 controls meeting (100%)" |
| 4.4 | Attest to an attestable control | The control turns Attested; an **Attestation Record** card appears at the bottom of the tab |
| 4.5 | Read that card | Control ID, name, Active badge, your statement, who attested, expiry date |
| 4.6 | Withdraw the attestation | The card entry stays, now badged **Withdrawn**, with the withdrawal date. The control goes back to Not Meeting |
| 4.7 | Product detail → the applications table | Hovering the "Policy Compliance" header explains what the number measures |

## 5. Control editor (regression check on already-merged fixes)

| # | Do | Expect |
|---|---|---|
| 5.1 | Settings → Policy Controls → open a control that uses `within_days` (4.6.x scan freshness) | The operator shows as `within_days`, not silently swapped to `exists` |
| 5.2 | Change the control's name only and save | Reopen: the `within_days` mapping and its day count are **unchanged**. This was the corruption bug |
| 5.3 | Add a field mapping, set Check type to **Applies when** | It saves and reloads as a scope check |
| 5.4 | Set Verification required + a note, and Allows attestation + valid days | All four persist across a reload |

## 6. D3 — the one thing left (a data change, not code)

After the migrations:

Settings → Policy Controls → **4.6.14** → add a field mapping:
`iacContainerScanNA` / Check type **Applies when** / operator `not_equals` / value
**Not applicable**.

Then open an application that has ticked the IaC N/A box: 4.6.14 should report
**Not Applicable** rather than Not Meeting, and leave the compliance denominator.

## 7. Prod policy seed

```bash
node backend/scripts/policies-export.js --url http://localhost:3001 --token "$DEV_TOKEN" > orbit-policies.json
node backend/scripts/policies-import.js --url https://<prod> --token "$PROD_TOKEN" --file orbit-policies.json --dry-run
```

The dry run writes nothing and prints every policy and control it would create, with
each control's check counts and its attestation/verification flags. Read that list
against Settings → Policy Controls on dev before running it for real.

It will refuse a non-global policy and skip anything that already exists.

---

## What to look for that is not on this list

The findings in the audit were found by using the app, not by reading it. The areas
touched by this branch that a checklist is least likely to catch:

- Anywhere a **percentage** is shown. Several denominators changed.
- Any screen that shows **which fields are missing**. Those labels now come from the
  registry and some of them changed wording.
- The **approval diff** for an application edited before the migrations ran — it may
  have no history to diff against, because none was being written.
