# Authoring Policy Controls

How to build a Control in **Settings → Policy Controls** so it measures what you meant.

Repo-only for now. The served docs under `backend/docs/platform/` are public and
unauthenticated, and control authoring is admin-only — putting this there is a docs
visibility question, not a docs question.

A Control has a requirement in prose and a set of **field checks** that decide, per
Application, whether it is met. Everything below is about getting those checks right.

---

## Check type: Compliance vs Applies when

Every field check has a **Check type**. This is the setting most likely to surprise you,
and it is new.

| Check type | Question it answers |
|---|---|
| **Compliance** | Does this Application *meet* the requirement? |
| **Applies when** | Does this requirement *apply to* this Application at all? |

A Control with no **Applies when** checks applies to every in-scope Application. Add one
and the Control becomes conditional.

**Why it matters.** An Application that fails a Compliance check is **Not Meeting** and
drags its compliance percentage down. An Application that fails an **Applies when** check
is **Not Applicable** — it leaves the denominator entirely and costs nothing.

> **Example.** "Infrastructure-as-code must be scanned" is meaningless for an Application
> with no IaC. Add an **Applies when** check of
> `IaC / Container Not Applicable` `≠` `Not applicable`, and those Applications report
> Not Applicable instead of failing forever.

Applies-when checks combine with their own AND/OR setting, separate from the one the
Compliance checks use.

---

## Operators

Thirteen operators exist. The Field dropdown only offers the ones that suit that field's
type, so you cannot pick a text operator for a number.

| Operator | Meaning |
|---|---|
| **Exists** | The field has a value. Empty string and empty list count as absent. |
| **Not Exists** | The field is empty or unset. |
| **Equals** / **Not Equals** | Exact comparison against the value you enter. |
| **Greater Than or Equal (≥)**, **Greater Than (>)**, **Less Than or Equal (≤)**, **Less Than (<)** | Numeric comparison, or — on a date field — comparison against one fixed calendar date. |
| **Within the last N days** | The date is no more than N days ago. |
| **Older than N days** | The date is more than N days ago. |
| **Contains** | Substring match on text. There is no "Not Contains". |
| **In (array)** / **Not In (array)** | Membership in a list of values. |

### The trap with dates

On a date field, `≥ / > / ≤ / <` compare against **one fixed calendar date** picked from
a date picker. They evaluate correctly — but a Control saying "last reviewed ≥ 2026-01-01"
passes forever once an Application crosses that date, and quietly stops measuring
anything.

For "recently enough", which is almost always what a date requirement means, use
**Within the last N days** and enter a number of days:

- reviewed at least every six months → `183`
- scanned in the last month → `30`

**Older than N days** is the inverse, for finding staleness deliberately.

### What a date field actually records

Some date fields record when Orbit last *read* a setting, not when a human last changed
it. `Branch Protection Last Read` and `PR Template Last Read` are both of these. A
recency check on them proves the evidence is fresh, not that anyone reviewed anything.

---

## Verification required

Tick this when the automated checks cover only part of the requirement.

An Application whose checks all pass then reports **Verification Required** rather than
Meeting. It stays in the applicable total and is deliberately *not* counted as met —
someone has to confirm the rest.

Use **Verification note** to say what a reviewer needs to check. It is shown as evidence
on the Application, so write it for whoever will read it.

An admin override resolves a Verification Required control to Meeting.

---

## Attestation

Tick **Allows attestation** for a requirement no field can evidence — a process, a
practice, something only a person can confirm.

An Application owner with `attestation.write` can then attest with a written statement.
The Control reports **Attested** and counts as met, labelled throughout as self-reported
rather than measured. **Attestation valid days** sets how long before it expires and the
Control reverts.

Leave it off for anything measurable. A Control that can be evidenced should never be
satisfiable by assertion, and the API refuses an attestation on a Control that has not
opted in.

Every attestation, including expired and withdrawn ones, is listed on the Application's
**Infosec Policy Compliance** tab under **Attestation Record**.

---

## The five results

| Result | Meaning | Counts as met | In the denominator |
|---|---|---|---|
| **Meeting** | Compliance checks pass | Yes | Yes |
| **Not Meeting** | Compliance checks fail | No | Yes |
| **Verification Required** | Checks pass, a human must confirm the rest | No | Yes |
| **Attested** | Owner attested, within the validity window | Yes | Yes |
| **Not Applicable** | An Applies when check excluded this Application | — | **No** |

Compliance rate is `(Meeting + Attested) ÷ applicable`. The **measured** figure beside it
counts only Meeting, so self-reporting never disappears into the headline number.

### Which result wins

First match wins:

1. **Admin override** — outranks everything, including applicability and attestation.
2. **Applies when** — any scope check excluding the Application gives Not Applicable, and
   the Compliance checks never run.
3. **Compliance checks** — on pass, Verification Required if that box is ticked,
   otherwise Meeting.
4. **Attestation** — can rescue a failure, never downgrades a pass. A Control whose checks
   pass stays Meeting even if someone also attested.

Implemented in `backend/services/policy.js`, `evaluateControl`.

---

## Things that will catch you out

- **A Control with no Compliance checks fails closed.** Every in-scope Application reports
  Not Meeting until an admin overrides it. That is deliberate — an unmeasured requirement
  should not look satisfied — but a half-built Control makes the whole portfolio look
  worse while you are building it.
- **Check the field is actually populated first.** A field that is empty across the whole
  portfolio makes a Control that can never pass, and it looks identical to a Control
  everyone is failing legitimately. `4.6.1` was mapped to `gitBranch` this way: empty on
  all 91 applications, so the control could never be met.
- **Fixed-date operators go stale silently.** See above.
- **Changing a Control re-evaluates every Application immediately.** Compliance is
  computed on read, not stored, so there is no job to wait for and no way to stage a
  change.

---

## Seeding another instance

`backend/scripts/policies-export.js` and `policies-import.js` move Policies and their
Controls between instances. Export from the instance that has them right, dry-run the
import against the target, then run it for real. The import never updates or deletes, and
refuses a non-global policy.
