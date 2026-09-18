# Remediating Findings

What happens after something is found — whoever found it, and whichever phase it turned up in.

## Why this isn't a phase

The [six phases](/docs/program-lifecycle) describe **where your code is** on its way to production. Remediation describes **what you do when something is found**, which is a different question.

Two things follow from that, and they're worth being explicit about:

- **It runs alongside the phases, not after them.** Findings arrive from the CI gate, from pre-release checks, and from production monitoring — so remediation is already under way in phases 3, 4 and 5 at the same time.
- **It mostly doesn't hold anything up.** A small number of findings block a merge or a release. Everything else travels alongside the work, tracked but not gating. That's deliberate: a process that stops on every finding gets bypassed, and a bypassed gate is worse than no gate.

An application is never "in the remediation phase." It's in Runtime & Operate, with open findings.

## Where findings come from

| Source | Phase | Typically |
|---|---|---|
| **The CI gate** — SAST, secrets, SCA, DAST | [3](/docs/phase-ci-gate) | On every pull request and default-branch build |
| **Pre-release checks** | [4](/docs/phase-release-deploy) | When a build is a release candidate |
| **Runtime scanning and cloud posture** — Wiz, Tenable, scheduled DAST | [5](/docs/phase-runtime-operate) | Continuously, and on a schedule |
| **People** — a penetration test, a report from a colleague, an incident, a researcher | Any | Unpredictably, and often the most serious |

That last row is worth planning for. Tool findings arrive pre-sorted with a severity attached; a person telling you something looks wrong arrives with none of that, usually at an inconvenient moment, and is disproportionately likely to be real.

## What happens to a finding

A finding has its own small lifecycle, independent of where the code is:

**Found → triaged → owned → fixed, excepted, or dismissed → verified closed**

<details>
<summary>What each step actually involves</summary>

**Found.** It exists somewhere — a pipeline log, a scanner console, an email. Nothing has happened yet.

**Triaged.** Someone has answered three questions: *Is it real? How bad is it here? Is it ours?* "How bad is it **here**" is the one that matters — a tool's severity is generic, and the same vulnerability class can be critical in your payment flow and irrelevant in an internal admin page nobody can reach.

**Owned.** A named person, not a team and not a backlog. An unowned finding is an unfixed finding with extra steps.

**Fixed, excepted, or dismissed.** Three legitimate outcomes, below.

**Verified closed.** The scan agrees. This is the step that gets skipped — a closed ticket is a claim that it's fixed, not evidence. Until the next scan comes back clean, treat it as open.

</details>

## Triage: three legitimate outcomes, and one that isn't

- **Fix it.** The default, and usually cheapest while someone is already in that code.
- **Ticket it.** With an owner and a date. A ticket with neither is a way of not deciding.
- **File an exception.** When you can't fix it in a reasonable window and the risk is worth carrying meanwhile. See [Exceptions](/docs/lifecycle-exceptions).
- **Dismiss it as a false positive** — legitimate, but only with a specific reason. "Not exploitable" isn't one. *"The vulnerable function is in that library's CLI, and we import only the parser"* is. If you can't write the sentence, it isn't a false positive yet.

**Not legitimate:** suppressing the rule, adding a blanket ignore path, or lowering a threshold so the build passes. Each of those silently reduces coverage for everyone who comes after you, and leaves a passing build that proves nothing. If a rule is genuinely noisy, that's a tuning conversation with Hearst's AppSec team — a welcome one, and part of [Improve & Govern](/docs/phase-improve-govern).

The difference is that the first four outcomes leave a record and the fifth doesn't.

## What blocks, and what doesn't

Most findings don't stop anything. The ones that do:

| What | Blocks | Set by |
|---|---|---|
| A **verified live secret** | The merge, always — no tier exemption | The [policy](/docs/program-infosec-policy) |
| Findings **above your severity threshold** | The merge | Your [risk tier](/docs/phase-plan-design#12-determine-your-risk-tier) — High strictest, Medium blocks Critical and High, Low blocks Critical |
| An **expired exception** | The release | The baseline — expired means re-approve, remediate, or remove |
| Everything else | Nothing. Tracked, owned, scheduled | Your team |

Getting this wrong in either direction causes problems. Block on everything and people route around the gate. Block on nothing and the serious findings queue behind trivia.

Fix-by timelines by severity and risk tier are being defined by Hearst's AppSec team. Until they're published, the firm expectation is the baseline's: **blocker and high findings get a ticket within a couple of business days.** For the rest, set your own targets using the template below and ask AppSec where a specific finding should land.

## Verifying closure

A finding is closed when the check that found it stops finding it.

- **From the CI gate** — the next clean build on the default branch is your evidence.
- **From a scheduled scan** — the next scan. Don't wait for it if the fix matters; trigger one.
- **From a person** — go back to whoever reported it. They know what they did; a scanner doesn't.

If a finding reopens, treat it as new rather than reopening the old one. A finding that comes back is usually telling you the fix addressed a symptom.

## When the same thing keeps coming back

If a class of finding recurs across releases or across repositories, remediation isn't the problem. Faster triage on the same recurring issue is effort spent on the symptom.

Recurring findings are a signal about an earlier phase:

| Keeps recurring | Usually points at |
|---|---|
| The same injection or encoding class | [Phase 1](/docs/phase-plan-design) requirements, or [Phase 2](/docs/phase-build-commit) secure coding practice |
| Secrets in commits | Phase 2 — no pre-commit hook, or one nobody installed |
| Vulnerable dependencies piling up | Phase 2 — no owner for update pull requests |
| The same misconfiguration each release | [Phase 4](/docs/phase-release-deploy) — the environment checklist isn't being run |
| Findings in one area of the application | Phase 1 — that component may need its own threat model |

Bring those to the quarterly review in [Improve & Govern](/docs/phase-improve-govern), where the fix is a changed practice rather than another ticket. That's the loop the sixth phase exists to close.

## What your company defines

Severity-to-timeline mapping, who can accept risk, and escalation are yours to set — they vary by company and by team. Write them down once rather than deciding per finding.

<details>
<summary>Remediation standard — fill this in for your team</summary>

```markdown
## Remediation Standard — <team or company>

### Fix-by targets
Confirm these with Hearst's AppSec team; they vary by risk tier.

| Severity | Ticket opened within | Fixed or excepted within |
|---|---|---|
| Critical | <e.g. same day> | <> |
| High     | <2 business days — per the baseline> | <> |
| Medium   | <> | <> |
| Low      | <> | <> |

### Who decides
| Decision | Who |
|---|---|
| Whether a finding is real | <role> |
| Whether it's a false positive | <role — ideally not the same person who wrote the code> |
| Who it's assigned to | <role> |
| Whether to file an exception | <role> |
| Accepting risk on a Critical or High | <named person — this one shouldn't be delegated> |

### Escalation
- Past its fix-by date: <what happens, and who hears about it>
- Above threshold and blocking a release: <who decides>
- Suspected active exploitation: <who to call, including out of hours>

### Where we track it
- Findings: <Wiz / scanner console>
- Work: <ticket tracker and project>
- Exceptions: filed with Hearst's AppSec team

### Standing exceptions
Reviewed each quarter — see [Exceptions](/docs/lifecycle-exceptions).
```

</details>

## Where this lives

Findings and their remediation status live in **Wiz** — the system of record — and in your ticket tracker for the work itself. Orbit doesn't hold individual findings and isn't going to; it tracks whether the checks that produce them are configured and running.

So what your security team can see in Orbit is whether your **scanning is in place and keeping pace** — tools configured, integration depth, scan dates measured against your deployment history. What they see in Wiz is what those scans actually found, and what's been done about it. Linking your Wiz or Tenable tag to the application on its [Integrations tab](/docs/application-data) is what connects the two.

---

**Related:** [Exceptions](/docs/lifecycle-exceptions) · [Phase 3 — CI Gate](/docs/phase-ci-gate) · [Phase 5 — Runtime & Operate](/docs/phase-runtime-operate) · [The Lifecycle](/docs/program-lifecycle)
