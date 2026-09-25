# Testing the bug-fix batch

Three commits on `claude/policy-gaps-followup`:

| | |
|---|---|
| `efe5637` | Correctness — R1–R3, B1–B4, import template |
| `ee3729b` | Layout — D1–D3, D5–D10, D12 |
| `005869c` | Drops the people column from the applications table |

```bash
cd /Users/nicholas.jantz/repos/appsec-catalog && git pull
```

Frontend hot-reloads. **Restart the backend** — R1 and D12 both depend on endpoint
changes.

I verified the first two commits in the browser before losing the ability to iterate;
`005869c` is reasoned-about, not looked at. Items marked **[unseen]** below are the ones
I have not put eyes on.

---

## 1. The two responsive breaks — do these at 1024px wide

Resize the window to roughly 1024px, or half-screen a 2560px monitor.

| # | Do | Expect |
|---|---|---|
| 1.1 | Look at the top nav | "What's New" and "Program Content" each on **one** line, not two. The bar stays one row |
| 1.2 | Look at the far right of the nav | **Logout is fully visible.** It used to be clipped to "Logo" |
| 1.3 | Narrow further, to ~900px | The email address disappears (by design, below `lg`); Logout survives |
| 1.4 | Open any application, look at the tab row | Scrolls **within the strip**. The page itself must not gain a horizontal scrollbar |
| 1.5 | Scroll the tab strip right | "Application Metadata History" and "Integrations" are reachable. Both used to be off-screen |
| 1.6 | Check the page bottom | No horizontal scrollbar on the document |

## 2. Applications table

| # | Do | Expect |
|---|---|---|
| 2.1 | Open Applications | The Status column shows `4/13 (31%)` beside `onboarded`. **This was blank for every admin** |
| 2.2 | Hover the fraction | "Application metadata answered, from the App Data tab. Security tooling is not counted." |
| 2.3 | Count the columns | Name, Company, Status, Score, Last Reviewed, Actions. **No Owner, no Team Contact** — see §6 |
| 2.4 | **[unseen]** Check nothing is cut off at the right | Score and Actions both visible without scrolling the table at 1440px+ |
| 2.5 | Look at the Delete buttons | Quiet red text, not solid red blocks |
| 2.6 | Click Delete | The confirmation modal is unchanged — still type-to-confirm |
| 2.7 | Look above the table | The Filters row has no card, no border, no "Filters" heading |
| 2.8 | Search | Placeholder reads "Search by name or description..." and searching still works |

## 3. Compliance evidence — the text fixes

Open an application → **Infosec Policy Compliance** → expand **Application Security**.

| # | Control | Expect |
|---|---|---|
| 3.1 | 4.6.3 | "Must be within the last 30 days". **Not** `within_days 30` |
| 3.2 | 4.6.6 | "Must be within the last 183 days" |
| 3.3 | 4.6.10 | "Must be within the last 90 days" |
| 3.4 | 4.6.11 | `Must equal "approved"` — single quotes, not `""approved""` |
| 3.5 | 4.6.5, 4.6.8, 4.6.9, 4.6.13 | "**At least one field must pass** for this control to be met". It used to read "All fields must at least one must pass" |
| 3.6 | 4.6.1, 4.6.2 | "All fields must pass for this control to be met" — unchanged |

## 4. The unassessed state

| # | Do | Expect |
|---|---|---|
| 4.1 | Settings → Policy Controls → Edit Policy → untick **Active** on both policies | |
| 4.2 | Open any application's compliance tab | Compliance Rate shows **—**, not 100%. Total Controls 0 |
| 4.3 | Look below Compliance Rate | **No stray `0`.** There used to be a bare zero there |
| 4.4 | Re-tick Active on both | Rate returns to a real percentage |
| 4.5 | If a policy ever has all its controls scoped out | Grey **Not Applicable** badge and "No controls apply to this application", instead of a green Compliant |

## 5. App Data tab

| # | Do | Expect |
|---|---|---|
| 5.1 | Open an application with gaps → App Data | Empty counted fields read "**Not set — counts toward completeness**" in amber |
| 5.2 | Count them against the score card | The amber markers equal the shortfall in "9 of 12 fields filled" |
| 5.3 | Look at a field that does *not* count (Additional Notes) | Plain grey "Not set" — no amber |
| 5.4 | Click the **Edit** button beside a card heading | **Edit mode opens.** The old "(click to edit)" hint never worked — it sat in the header, outside the clickable overlay on the body |
| 5.5 | Compare the two columns | Both are made of titled sub-cards. The left used to mix bare fields with cards |
| 5.6 | Find an empty Description or Team Contact | No empty bordered box — just the marker text |

## 6. The judgement call I want you to overrule if you disagree

**The applications table no longer has a people column at all.**

`owner` was empty on all 91 rows and no form sets it. I first repointed the column at
`devTeamContact`, which was worse: it is free text, 59 characters at its longest here,
and an uncapped cell in an auto-layout table sizes to content — it measured 459px and
pushed the table to 1471px inside a 1166px wrapper, hiding Score and Actions. You told
me not to cap it, and you were right, so I removed the column instead.

If you want a contact in the table, the options are a narrower derived value (first
contact only, or a count) rather than the raw field.

## 7. Scoring settings

| # | Do | Expect |
|---|---|---|
| 7.1 | Settings → Scoring | Six category checkboxes per tool: SAST, DAST, SCA, Secrets, IaC / Container, Firewall |
| 7.2 | Look at each row | **"Firewall" is on the same line as the rest.** It used to orphan onto a second row for every tool |
| 7.3 | Check the card width | Wider than before; it no longer stops ~78% across |

## 8. Import template

| # | Do | Expect |
|---|---|---|
| 8.1 | Applications → Bulk Import → Download Demo CSV | 32 columns including Secrets Scanning Tool, IaC / Container Not Applicable, SAST includes secrets scanning |
| 8.2 | Check it does **not** contain | "Security Testing Description" or "Owner" |
| 8.3 | Upload it back | Every column auto-maps — no column left on "Skip this column". I verified this against the registry programmatically, but not through the modal |
| 8.4 | Import and open a created application | Secrets and IaC values are stored |

## 9. Control editor

| # | Do | Expect |
|---|---|---|
| 9.1 | Settings → Policy Controls → Edit 4.6.3 | Operator reads "Greater Than or Equal (≥)" and "Within the last N days" in full — **not** "Greater Tha" / "Within the la" |
| 9.2 | Look at a check row | One line of guidance at most. "Enter a numeric value" and "Select a value from the dropdown" are gone |
| 9.3 | The days helper | No longer cites 183 on a control that uses 30 |
| 9.4 | The `requiredApprovingReviewCount` hint | "≥ 1 is the usual bar", not "gte 1" |
| 9.5 | Drag a check by its handle | Reorders. **Still unverified** — synthetic events cannot drive native HTML5 drag |
| 9.6 | Save with no edits, reopen | All three mappings unchanged, including `within_days 30` |

---

## Still outstanding — not code

Both are yours to do, and both are dev-only until repeated in prod:

1. **4.6.14 needs a scope check.** Settings → Policy Controls → 4.6.14 → add
   `IaC / Container Not Applicable` / **Applies when** / `not_equals` / **Not
   applicable**. Without it, every application with no containers fails it forever.
2. **No tool is credited for Secrets or IaC** in Settings → Scoring, so every
   application scores 0 in two of seven categories and all tool scores are depressed.
   You approved crediting GHAS + Snyk for Secrets and Snyk for IaC; I did not get to it
   before losing browser access.

## One decision I flagged and did not make

`currentVersion` counts toward completeness but is `approvable: false`, so it cannot be
CSV-imported and is not written back on approval. I dropped it from the import template
rather than change `approvable`, which would alter the approval path.

## Findings I withdrew after reading the code

Listed so you do not go looking for fixes that were never needed:

- **I1** — the Security tab *does* render `sastIncludesSecrets` and `iacContainerScanNA`
  ("Covered by the SAST tool", "Not applicable"). The application I sampled had both
  unset. Smaller real point underneath: `null` (never asked) is indistinguishable from
  `false` (answered "we do have IaC").
- **F5** — policy creation already defaults to active in the form, the API and the
  schema. Your two were inactive for some other reason, most likely how I created them.
- **D11** — the technical-form-link icon already has `title` and `aria-label`.
- A score-denominator mismatch I thought I saw (`16/60` beside `32/50`) was me misreading
  a screenshot. It says `16/50`.
