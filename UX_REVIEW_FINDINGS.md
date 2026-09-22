# UX review of today's work — findings

Browser pass over the running dev instance (`localhost:3000`, backend `:5000`), against
`policy-gaps-test` @ `e53ab55`. Nothing here is fixed — this is the list to work through.

Part 1 is correctness. **Part 2 (design and polish) is at the bottom** — none of it
changes any content or wording, it is layout, consistency and density.

**Two things I changed in the dev data while testing**, because they blocked everything
else:

- Activated both policies (see F5). Until I did, every application showed 0 controls.
- Attested then withdrew 4.6.12 on *AMSTAT - Premiere/Phoenix*, to exercise the
  attestation record. The withdrawn row is still there — it is useful demo data, but
  delete it if you'd rather start clean.

---

## Regressions I introduced today

### R1 — Completeness is gone from the Applications table for every admin — **high**

The table shows only `onboarded` in the Status column. The `4/13 (31%)` figure is absent.

`GET /api/applications` serves `completeness`; the Applications page calls
`api.getAdminApplications()` → `GET /api/admin/applications` when `isAdmin()`, and that
endpoint was never given it. Because the frontend's own `calculateCompleteness` was
deleted in the same change, there is no fallback: the number simply disappeared for
every admin, which is everyone who looks at this page.

Confirmed: the API returns `{filled: 4, total: 13, percentage: 31, missing: [...]}` on
`/api/applications`, and the rendered cell is empty.

**Fix:** map `completeness` onto the rows in `routes/admin.js` the same way
`routes/applications.js` does. Or have the page call one endpoint.

### R2 — Zero applicable controls reports "100% Compliance Rate" — **high**

Before I activated the policies, every application read:

> Total Controls **0** · Meeting **0** · … · Compliance Rate **100%**

An application with nothing evaluated should not read as fully compliant. This is mine:
`applicable > 0 ? Math.round(...) : 100` in `evaluateAllControls`, mirrored in the
per-policy summary. It is currently hidden because the policies are active again, but it
returns any time a policy is deactivated, a company has no applicable policy, or a new
instance is seeded.

**Fix:** return `null` for an empty denominator and render `—`.

### R3 — Operator dropdown is truncated in the control editor — **medium**

I fixed the Field select truncation and caused a new one. The row is
Field 4 / Check type 3 / **Operator 2** / Value 3 columns, and Operator now shows
"Greater Tha" and "Within the la".

**Fix:** Field 3 / Check type 3 / Operator 3 / Value 3, or let Operator have 4.

---

## Bugs that predate today, found while testing

### B1 — "All fields must at least one must pass" — **medium**

Every OR control renders this. Seen on 4.6.5, 4.6.8, 4.6.9, 4.6.13. Two strings
concatenated ("All fields must " + "at least one must pass"). Reads as nonsense on a
page compliance owners will read.

### B2 — Raw operator identifiers leak into user-facing text — **medium**

I fixed the *editor* hints today but not the *evidence* renderer:

- `Requirement: within_days 30` — on 4.6.3, 4.6.7
- `Requirement: within_days 183` — on 4.6.6
- `Requirement: within_days 90` — on 4.6.10

Should read "Within the last 30 days". Same class, different place: the
`requiredApprovingReviewCount` field helper in the editor still says
"**gte 1** is the usual bar for segregation of duties".

### B3 — String values render double-quoted — **low/medium**

4.6.11 Threat Modeling shows:

> `Requirement: Must equal ""approved""`

The value is stored as JSON (`"approved"`) and the renderer quotes it again. Booleans are
fine (`Must equal "true"`), so it is specific to string values.

### B4 — A stray `0` renders under Compliance Rate — **low**

`{summary.total_policies && (...)}` leaks a falsy `0` into JSX when the count is zero.
Confirmed `total_policies: 0` at the time. Classic React `&&` guard on a number.

---

## Data and configuration state

### F5 — Both policies were created inactive — **needs a decision**

Both were `isActive: false`, so nothing was evaluated and every application showed 0
controls and 100%. I activated them via the UI.

Worth deciding whether the Create Policy form should default to active, or at least warn
that an inactive policy evaluates nothing. It is a quiet way to lose the whole feature.

### F6 — No tool is credited for Secrets or IaC, so every application scores 0 there — **high impact on numbers**

`toolQuality.json` ships with Snyk `[sast, sca]`, Tenable WAS `[dast]`, Fastly NGWAF
`[appFirewall]`, Dependabot `[sca]`, GitHub Advanced Security `[sast, sca]`. Nothing
lists `secretsScan` or `iacContainerScan`.

The tool score now divides by 7 categories instead of 5, and two of them are guaranteed
zero for all 91 applications. **Every tool score in the portfolio dropped today** and
cannot recover until someone ticks those boxes in Settings → Scoring.

Also: all 91 applications have `iacContainerScanNA: null` — unanswered, not N/A — so the
IaC category stays in the denominator scoring zero rather than dropping out.

Sampled: App Sec Catalog Backend tool 16/60, Frontend 9/60, Alertspace 5/60.

### F7 — 4.6.14 still has no applies-when check (D3) — **confirmed in the UI**

Its only mapping is `IaC / Container Integration Level ≥ 1`. An application with no
containers fails it permanently. The steps are in `FRONTEND_COVERAGE_AUDIT.md` D3; it is
a data change, two minutes in the editor.

### F8 — The demo CSV template is stale — **medium**

`frontend/public/demo-applications-import.csv`, offered as "Download Demo CSV", has:

```
…,Critical Aspects,Security Testing Description,Additional Notes,SAST Tool,…
```

No Secrets columns, no IaC columns, and it still teaches **Security Testing
Description** — which we stopped collecting today and which the importer now refuses to
map. Anyone using the template gets the old schema plus a dead column.

---

## Inconsistencies

### I1 — The Security tab's read-only view hides two fields it lets you set

The cards show Tool / Integration Level / Last Scan Date for Secrets Scanning and
IaC / Container Scanning, but never show:

- `iacContainerScanNA` — while Application Firewall and API Security both show
  "Not Applicable: Yes/No"
- `sastIncludesSecrets` — while SAST shows "SAST includes SCA: Yes"

So you can set both on the intake forms and in the editor, and then cannot see them.

### I2 — A control can be both attestable and override-only

4.6.12 and 4.6.15 show an **Attest** button *and* "This control has no field mappings.
Use the override below to manually mark compliance." Two routes to the same outcome with
different audit meaning. Probably fine, but worth a deliberate decision.

### I3 — Value helper cites a number the control does not use

On 4.6.3's 30-day check the helper reads "…**183 is roughly six months**".

### I4 — Generic per-row helpers add a line to every check

"Enter a numeric value", "Select a value from the dropdown" — true but contentless, and
they cost a line on every row in a list that is trying to be compact.

### I5 — Scoring settings: the category checkboxes wrap badly

Six categories no longer fit the CATEGORIES column, so **Firewall orphans onto its own
line on every tool row**.

---

## Could not verify — needs you

### U1 — Drag to reorder field checks

Chrome does not fire native HTML5 drag from synthetic events, so I could not test the
gesture. The cards *are* `draggable` and the handlers are attached. The ↑ ↓ buttons
**do** work (verified: moved check 1 below check 2). Please try a real drag.

### U2 — "Security Tools (click to edit)" on the Security tab

Clicking the heading — by ref, by coordinate, and programmatically — never entered edit
mode for me. Could be my synthetic clicks, could be real. Worth one manual click.

### U3 — The public onboarding form

Needs a generated link; I did not want to mint one and leave it lying around. The whole
`approvable` fix and the checkbox-unchecking fix live on that path and are still
untested end to end. §2.1 of `TESTING_CHECKLIST.md` covers it.

---

## Verified working

| | |
|---|---|
| **F1** control editor no longer corrupts mappings | Saved 4.6.3 with no edits; all three mappings byte-identical, including `within_days 30` |
| **F6** attestation record | Attested 4.6.12 → badge, Attested count 1, rate 4%. Withdrew → row kept, badged **Withdrawn** with the date, count back to 0 |
| **F5** per-policy summary | "1 of 15 applicable controls met (7%), 1 by attestation" — numerator, denominator and percentage agree |
| **F4** dashboard rollup | "211 of 2534 · 211 measured · 18 awaiting verification · 14 not applicable". 91 × 28 = 2548, − 14 N/A = 2534 ✓ |
| **applies_when** is live on real data | 14 controls reporting Not Applicable across the portfolio |
| **D1** one completeness number | Denominator 13 everywhere; "4 of 13 fields filled" on the score card matches `missing` from the API |
| **D2** securityTestingDescription | Gone from the Security tab, the admin intake form and the CSV importer |
| Admin intake form | All six new fields present and conditionally gated |
| Version snapshots | Carry `secretsScanTool`, `iacContainerScanNA`, `sastIncludesSecrets` — migrations applied, the silent-failure fix holds |
| CSV importer list | Derives 33 fields, includes Secrets/IaC, excludes both legacy API Security fields |
| Control editor drawer | Field select no longer truncates; identity fields on one row; footer pinned |
| Console | Clean. No `console.log` noise, no errors on load |
| Quick Wins | Already recommends "Add a Secrets Scanning and IaC / Container Scanning tool" |

---
---

# Part 2 — Design, layout and polish

Nothing below changes content or wording. Sizes checked: 1512×950 and 1024×800.

## Responsive — things that actually break

### D1 — The top nav wraps and clips "Logout" at 1024px — **high**

"What's New" and "Program Content" each break onto two lines, the bar grows to two rows,
and **"Logout" is cut off at the right edge** ("Logo"). 1024 is a normal laptop
half-screen width.

### D2 — The application tab strip overflows into whole-page horizontal scroll — **high**

Nine tabs (App Data … Integrations). At 1024px the strip runs past the viewport, and
because nothing constrains it the **entire page** gains a horizontal scrollbar rather
than the strip scrolling on its own. "Application Metadata History" is clipped mid-word
and "Integrations" is off-screen entirely.

Worth fixing as a scrollable/overflowing tab strip, or collapsing the tail into a "More"
menu.

## Consistency

### D3 — Destructive actions are styled three different ways

| Screen | Treatment |
|---|---|
| Applications table | Solid red **Delete** button on every row |
| Policies & Controls | Red text link **Delete** |
| Scoring settings | Plain unstyled text **Remove** |

Pick one. Related: on the Applications table the solid red Delete is the single most
visually prominent element on the page — 10 of them per screen, louder than the
application names.

### D4 — Two views of the same mapping disagree on how they render it

Policies & Controls list: `Branch Protection Last Read · Within the last N days · 30`
Application compliance evidence: `Requirement: within_days 30`

The list view uses the operator labels; the evidence builder emits the raw identifier.
Same data, two renderers, one was updated and one wasn't. (This is B2 in part 1 — noting
it here because the inconsistency is the clearest way to see it.)

### D5 — The App Data tab's two columns are structured differently

**Basic Information** mixes bare label/value pairs (Application Name, Company,
Description) with nested sub-cards (Repository & Contact, Business Criticality).
**Technical Information** is uniformly sub-cards (Tech Stack, Deployment Information,
Security & Data, Hosting Domains). Side by side the asymmetry reads as unfinished.

Also within that tab: Description renders inside a bordered box while every other value
is plain text, for no apparent reason.

## Density and wasted space

### D6 — The OWNER column is empty for all 91 applications

Confirmed against the API: `owner` is set on **0 of 91**; `devTeamContact` is set on 44.
A permanently empty column is costing table width on the busiest screen — and it is the
same field I removed from completeness because the App Data tab never asks for it.

Either drop the column, or show `devTeamContact` in it.

### D7 — Scoring settings wastes the width its own table needs

The card stops at roughly 78% of a 1512px viewport, while inside it six category
checkboxes no longer fit one line, so **"Firewall" orphans onto a second row for every
tool**. The room to fix it is sitting unused to the right.

### D8 — Empty values render as bordered boxes containing faint "Not set"

e.g. "Development Team Contact Info" on the App Data tab. A full-height bordered
container for the information that there is no information.

### D9 — The Filters card is heavy for what it holds

Full card, card padding, a "Filters" heading, wrapping one row of four controls on the
Applications page.

## Affordance

### D10 — "(click to edit)" is a weak affordance, repeated

Small grey text beside each card heading, on every card. It is also the one I could not
trigger at all (U2 in part 1) — worth confirming whether the hit target is the heading,
the hint text, or the card.

### D11 — The technical-form-link icon beside application names is unlabelled

It carries `title="Get Technical Form Link"`, so it is hover-only and invisible to
anyone scanning the list.

## One enhancement worth considering

### D12 — Close the loop on completeness where the fields actually live

Completeness is now defined as exactly the App Data tab's thirteen questions. But
nothing *on that tab* indicates which fields count or which are missing — you find that
out from Quick Wins in a different card ("Fill in Repository URL and 2 other fields").

Marking the counted fields, or a small `9/12` per card, would make the number
self-explanatory at the point where someone can act on it. No wording changes needed.
