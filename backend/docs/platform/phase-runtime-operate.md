# Phase 5 — Runtime & Operate

The fifth phase of [the lifecycle](/docs/program-lifecycle), and the one your application spends most of its life in. Re-scanning on a schedule, watching your external surface, triaging findings to closure, and keeping the record honest — long after the code stopped changing.

## Why this exists

Your exposure changes even when your code doesn't. A dependency you shipped last year gets a critical advisory. A TLS certificate expires. A subdomain starts pointing at a bucket somebody deleted. A technique that didn't work against your authentication flow in March works in November. None of that produces a commit, so none of it triggers any other phase.

This is also where most real incidents actually start — not in a novel design flaw, but in something known that nobody was watching. Which makes this the phase where "going quiet" is the failure. An application that shipped and then stopped appearing anywhere looks identical to one that's being carefully maintained, right up until it isn't.

## What triggers it

- **Continuous**, from first production release until decommission
- **Schedule-driven** re-assessment, on a cadence set by your risk tier
- **Event-driven**: a new advisory affecting your stack, a detected DNS change, an incident, a material change to the application

## Who does the work

This is the phase with the most shared ownership, which is also why work falls through the gaps here more than anywhere else.

| | Who |
|---|---|
| Runs scheduled scans, watches infrastructure posture | **Your platform team**, with Hearst's AppSec team |
| Triages and fixes findings | **Your dev team** |
| Accountable for findings not sitting unowned, and for the record staying current | **Your application owner** |
| Monitors external exposure, reviews metadata, re-confirms tiers | **Hearst's AppSec team** |
| Runs the incident when there is one | **Whoever your IR runbook names** |

## The work

| # | Work item | Output |
|---|---|---|
| 5.1 | **Re-scan on a schedule, independently of releases** | A recurring scan on your tier's cadence, and a refreshed scan date in Orbit |
| 5.2 | **Watch your external exposure** | DNS and web-reachability history, with changes reviewed rather than just recorded |
| 5.3 | **Watch infrastructure and cloud posture** | Findings from Wiz or Tenable correlated back to the application via its tag |
| 5.4 | **Triage findings to closure** | A ticket within a couple of business days for blocker and high findings; every finding tracked until closed or excepted. See [Remediating Findings](/docs/lifecycle-remediation) |
| 5.5 | **Watch dependencies and advisories** | Repository re-synced, advisories re-checked, affected packages upgraded |
| 5.6 | **Keep incident response ready** | A current runbook, current contacts, and an exercise actually run |
| 5.7 | **Review the record periodically** | A review entry confirming the metadata is still accurate |
| 5.8 | **Re-confirm the risk tier after material change** | A re-confirmed tier, and an updated cadence if it moved |
| 5.9 | **Decommission cleanly at end of life** | Record retired, domains released, tokens revoked, data disposition recorded |

### 5.1 — Scheduled re-scanning

The baseline requires internet-facing applications to be re-scanned on a recurring schedule **independent of your release cadence** — because a quiet application isn't a safe one.

<details>
<summary>Re-scan schedule record — keep this with your application's runbook</summary>

Cadences come from your risk tier; confirm the actual intervals with Hearst's AppSec team rather than guessing.

```markdown
## Re-scan Schedule — <application name>

Risk tier: <High | Medium | Low>      Internet-facing: <yes | no>

| Scan | Cadence | Scheduled where | Owner | Last run |
|---|---|---|---|---|
| DAST (external) | <per tier> | <tool/scheduler> | | <YYYY-MM-DD> |
| SAST (full repo) | <per tier> | <CI schedule> | | |
| SCA / dependency | <per tier, minimum weekly> | <CI schedule> | | |
| Infrastructure / cloud | <per tier> | <Wiz / Tenable> | | |

- [ ] Each scan writes its date back to Orbit's Security tab
- [ ] Someone is notified when a scheduled scan FAILS TO RUN
      (a schedule that silently stopped is the common failure here)
- [ ] The DAST target still resembles production
```

</details>

### 5.4 — Findings triage

**Where findings live:** in **Wiz**, which is the system of record for vulnerability findings, and in your own scanners' consoles for what they each report. Orbit doesn't hold individual findings and isn't going to — it tracks whether your checks are configured and running, not what they output. Link your Wiz or Tenable tag to the application (on the [Integrations tab](/docs/application-data)) so tool-side findings correlate back to the catalog record.

**What's required of you:** the baseline asks that blocker and high findings get a ticket within a couple of business days, and that every finding is tracked until it's closed or an exception is filed. Work them in your normal ticket tracker, from Wiz as the source.

Fix-by intervals by severity and risk tier are being defined by Hearst's AppSec team; until they're published, treat the couple-of-business-days ticketing expectation as the firm part and ask AppSec where a specific finding's timeline should land.

The thing to watch for is findings that are technically tracked but functionally abandoned — a ticket in a backlog with no due date, reopened every quarter, never scheduled. Getting a ticket open is the easy half.

**[Remediating Findings](/docs/lifecycle-remediation)** covers the rest: triage, ownership, what blocks and what doesn't, verifying a finding is actually closed, and what to do when the same one keeps coming back.

### 5.6 — Incident response readiness

Write this before you need it. The value of a runbook is almost entirely in the fact that it was written calmly.

<details>
<summary>Incident response runbook — one per application, reviewed annually</summary>

```markdown
## Incident Response Runbook — <application name>

Last reviewed: <YYYY-MM-DD>     Owner: <name>

### Who to call, in order
| Role | Name | How to reach them | Out of hours? |
|---|---|---|---|
| Application owner | | | |
| On-call engineer | | | |
| Your security contact | | | |
| Hearst AppSec team | | | |
| Comms / legal (if data is involved) | | | |

### First 30 minutes
- [ ] Write down what you observed, with timestamps — start the log now,
      not afterwards
- [ ] Decide: is this ongoing, or already over?
- [ ] Contain if you can do so without destroying evidence
      (revoke credentials and sessions before deleting anything)
- [ ] Notify the list above. Over-notifying is cheap.

### What we can turn off, and what that costs
| Action | How | Impact |
|---|---|---|
| <Revoke all sessions> | <where> | <all users re-login> |
| <Disable the public endpoint> | <where> | <feature unavailable> |
| <Rotate the DB credential> | <where> | <brief downtime> |
| <Roll back to previous version> | <how> | <feature loss> |

### Where the evidence is
- Application logs: <where, and retention period>
- Access / audit logs: <where>
- Infrastructure logs: <where>
- Who can pull them: <name — before you need them at 2am>

### If sensitive data may be involved
- [ ] Do NOT delete anything
- [ ] Escalate to Hearst's AppSec team immediately — regulatory clocks
      may already be running
- Data types this application handles: <from the Orbit record>

### Afterwards
- [ ] Timeline written up
- [ ] Root cause, without blaming a person
- [ ] Fixes ticketed with owners
- [ ] Threat model updated if this was a threat we hadn't considered
- [ ] Recorded on the application's App Timeline in Orbit
- [ ] Worth sharing at [ASCOE](/docs/program-center-of-excellence)? Another
      company is probably one change away from the same incident.

### Last exercise
Tabletop run on: <YYYY-MM-DD>    What we found: <e.g. "nobody could
actually rotate the DB password without the platform lead">
```

An exercise that surfaces one broken assumption has paid for itself. That's the normal outcome, not a bad sign.

</details>

### 5.7 and 5.8 — Periodic review

These pair naturally into one recurring conversation, on your tier's cadence.

<details>
<summary>Periodic application review — run on your tier's cadence</summary>

```markdown
## Application Review — <application name>

Date: <YYYY-MM-DD>     Reviewed by: <name>     Tier: <H/M/L>

### Is the record still true?
- [ ] Owner and dev team contact current (people change teams)
- [ ] Repository URL still the right one
- [ ] Facing (internal/external) still accurate
- [ ] Data types still accurate — has it started handling anything new?
- [ ] Hosting domains current — any added or retired?
- [ ] Interfaces with other applications current
- [ ] Business criticality still right
- [ ] Profile completeness at 100%

### Is the tier still right?
- [ ] Re-scored against the Phase 1 tier factors
- [ ] Tier unchanged / changed to <tier> because <reason>
- [ ] If it changed: thresholds, cadences, and DAST obligations updated

### Is the security work still happening?
- [ ] Scan dates current and tracking deployments
- [ ] Repository synced recently
- [ ] Threat model reviewed since the last significant change
- [ ] No findings past SLA
- [ ] No expired exceptions
- [ ] IR runbook reviewed, contacts still valid

### Still in use at all?
- [ ] Yes / [ ] Candidate for decommission → go to 5.9
```

</details>

### 5.9 — Decommissioning

The most-skipped work item in the lifecycle, and the one that quietly creates the most risk: a forgotten application still resolving, still holding data, still running a framework nobody has patched in three years.

<details>
<summary>Decommission checklist — work top to bottom</summary>

```markdown
## Decommission — <application name>

Decision by: <name>       Date: <YYYY-MM-DD>
Replaced by: <application, or "retired outright">

### Before switching anything off
- [ ] Confirmed nothing still depends on it — check the interfaces
      recorded in Orbit, and ask
- [ ] Data retention requirement identified: <keep until X | delete now>
- [ ] Final export taken if data must be retained, and stored <where>
- [ ] Users notified

### Switch off
- [ ] Traffic stopped / endpoints returning 410 or redirecting
- [ ] DNS records removed — not left pointing at nothing
      (a dangling record pointed at a deprovisioned host is a
       subdomain takeover waiting to happen)
- [ ] TLS certificates revoked or allowed to lapse deliberately
- [ ] Application instances stopped and deprovisioned

### Credentials and access
- [ ] Orbit deployment tokens for this application revoked
- [ ] Orbit API tokens scoped to it revoked
- [ ] Third-party API keys it held revoked at the provider
- [ ] Service accounts and IAM roles removed
- [ ] Repository archived, CI pipelines disabled

### Data
- [ ] Databases deleted or archived per the retention decision
- [ ] Storage buckets deleted, and confirmed not public in the meantime
- [ ] Backups handled per retention — deleting the app but keeping
      unencrypted backups forever is not decommissioning

### In Orbit
- [ ] Hosting domains removed from the application
- [ ] Removed from any product it was mapped into
- [ ] App Timeline note recording the decommission and where data went
- [ ] Ask Hearst's AppSec team to retire the record, so it stops
      counting against your coverage numbers
```

</details>

## Where the outputs go

| Output | Where |
|---|---|
| Refreshed scan dates | **Orbit** — the [Security tab](/docs/application-security) |
| Re-scan schedule record | **Your runbook** — no Orbit field for the cadence yet |
| DNS and web exposure history | **Orbit** — [Domains](/docs/domains), recorded automatically |
| Cloud and infrastructure findings | **Your Wiz or Tenable console**, tag-linked to the Orbit record |
| Findings and their remediation status | **Wiz** (system of record) and **your ticket tracker** — not Orbit, by design. See [Remediating Findings](/docs/lifecycle-remediation) |
| Dependency re-sync | **Orbit** — the [Integrations tab](/docs/integrations) and [Dependencies](/docs/dependencies) |
| Incident response runbook | **Your repository or wiki** — no Orbit home yet |
| Incident write-ups | **Orbit** — the App Timeline |
| Metadata review | **Orbit** — recorded when AppSec marks the record reviewed |
| Re-confirmed risk tier | **Your design doc** and AppSec's notes — no Orbit field yet |
| Decommission record | **Orbit** — App Timeline note; the record itself can't be retired yet |

On 5.2: this one runs without you. Once a hosting domain is on the application, Orbit takes DNS snapshots, detects and records changes between them, and keeps web-reachability history. The work is reviewing what it finds — an unexpected DNS change is often the first visible sign of something worth knowing about.

On 5.7: metadata review has real weight in your score. Review freshness is worth 10 points, full credit the day the record is reviewed, decaying in a straight line to zero at six months; never reviewed scores zero. See [Scoring Methodology](/docs/scoring-methodology).

## Done when

Continuous phase, so these are steady-state conditions:

- Last DAST scan is within your tier's cadence, for internet-facing applications
- Scheduled scans are running, and someone is notified when one fails to run
- The linked repository has synced within the last 30 days
- Blocker and high findings have a ticket, an owner, and a date — not just a backlog entry
- No exception has expired
- Metadata reviewed within your tier's cadence, at minimum inside six months
- The risk tier has been re-confirmed within its cadence, or since the last material change
- The IR runbook was reviewed in the last year, and an exercise has actually been run
- Applications no longer in use have been decommissioned, not just forgotten

## How tiers change this

| | High | Medium | Low |
|---|---|---|---|
| **Re-scan cadence** | Most frequent | Standard | Lightest |
| **Metadata review** | Most frequent | Standard | Annually |
| **Tier re-confirmation** | Periodic, plus on material change | On material change | On major change |
| **IR runbook** | Required, exercised | Required | Contacts at minimum |
| **Findings turnaround** | Tightest | Standard | Most generous |

## How this maps to policy and maturity

### Baseline controls satisfied here

From [Meeting the Policy](/docs/program-policy-baseline): **scheduled re-scanning** (5.1) and **findings triaged to closure** (5.4) are the two required controls. This phase also carries the ongoing half of **application metadata maintained** (5.7) and **risk tier assigned** (5.8) — both of which are continuing obligations rather than one-time setup.

### SAMM practices this is evidence for

This phase is where the whole **Operations** function from [SAMM](/docs/program-samm) gets its evidence:

- **Incident Management** — detecting, responding to, and learning from incidents (5.6)
- **Environment Management** — keeping infrastructure patched and free of config drift (5.3)
- **Operational Management** — lifecycle management: inventory, end-of-life, data handling (5.7, 5.9)

It also feeds **Defect Management** under Implementation, through 5.4.

## What your security team sees

| They see | Where |
|---|---|
| Your live external surface, and every change to it | [Domains](/docs/domains) — DNS snapshots, detected changes, web-reachability history |
| Whether scanning is still happening, and still tracking your deployments | Scan dates versus deployment history, in your [score](/docs/scoring-methodology) |
| Repositories that have gone quiet | The **Program Operations dashboard** lists linked repos not synced in over 30 days |
| Records that have never been reviewed, or have drifted | The **Program Operations dashboard** — applications never reviewed, and applications below 100% completeness |
| Whether review is keeping up | Review freshness in the Knowledge Sharing half of the score, decaying over six months |
| Whether a scan is **overdue**, not just when it last ran | The last scan date measured against the cadence your tier requires |
| Whether the record has been reviewed inside six months | The last-reviewed date, checked against the policy's six-month floor |
| Your dependency exposure when a new advisory lands | The [Dependencies](/docs/dependencies) page, across the whole portfolio |
| Cloud posture, where a tag is linked | Tenable and Wiz tag links, plus CSV export jobs |
| Whether you're still meeting policy | The Infosec Policy Compliance tab, re-evaluated automatically as data changes |

**Where they're blind, and will have to ask you:**

- **Whether you have an IR runbook, or have ever exercised it.** Only contacts are recorded.
- **Whether the tier is still *right*.** Orbit can see when your record was last reviewed, and flag it when that slips past six months. What it can't do is second-guess the tier itself — whether the rating still matches the application is a judgement someone makes at review.
- **Whether an application is retired.** Orbit's status values are `pending_executive`, `pending_technical`, and `onboarded` — there's no retired state. A decommissioned application either lingers as "onboarded," dragging down every coverage percentage you report, or gets deleted and takes its history with it. Products can be marked Retired; applications can't. Ask AppSec to handle a decommissioned record meanwhile.

**What lives elsewhere by design.** Individual findings and their remediation status stay in **Wiz** and in your ticket tracker — Orbit correlates an application to them by tag but doesn't hold them, so don't expect a findings list, severity counts, or remediation timing here. That's a scope decision, not a gap.

---

Around this phase: **[Phase 4 — Release & Deploy](/docs/phase-release-deploy)** before it, **[Phase 6 — Improve & Govern](/docs/phase-improve-govern)** after. See **[The Lifecycle](/docs/program-lifecycle)** for all six phases.
