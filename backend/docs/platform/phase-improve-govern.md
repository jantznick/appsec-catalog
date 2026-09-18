# Phase 6 — Improve & Govern

The sixth phase of [the lifecycle](/docs/program-lifecycle). Measuring how well the other five are actually working, and fixing the program itself when they aren't.

**A note on audience.** The other five phases are executed by development teams. This one mostly isn't — it's run by whoever owns application security for your company, together with Hearst's AppSec team, on a quarterly and monthly rhythm rather than per-change. If you're a developer, the parts that involve you are 6.5 (tool tuning — tell someone when a gate is noisy) and 6.7 (the champions cadence).

## Why this phase exists

The other five phases can all be running and still be producing nothing. A gate everyone bypasses. A threat model written once and never revisited. Controls that pass because the field they check is easy to fill in. Metadata reviewed by ticking a box. Each of those looks like compliance and delivers no risk reduction.

This phase is the correction mechanism. It asks whether the work is real, whether the requirements still match the threats, and where the process is too hard to follow — because a control nobody can meet isn't a discipline problem, it's a design problem with the control.

It's also the only phase that closes the loop. Everything learned here should change something in phases 1 through 5: a threshold, a template, a requirement, a page like this one.

## What triggers it

Cadence, not code:

- **Quarterly** — SAMM re-scoring, portfolio posture review, exception cleanup, the [ASCOE](/docs/program-center-of-excellence) session
- **Monthly** — the [Security Champions](/docs/program-security-champions) meeting
- **Continuous** — metrics, and tool tuning as noise surfaces
- **Event-driven** — a baseline revision, or an incident worth changing the program over

## Who does the work

| | Who |
|---|---|
| Runs the assessment, sets targets, owns the improvement plan | **Your company's AppSec or engineering lead** |
| Reviews the portfolio, cleans up exceptions, revises the baseline | **Hearst's AppSec team**, with you |
| Reads the metrics and makes resourcing decisions | **Your leadership** |
| Hosts the monthly champions meeting | **Your champions lead** |
| Reports gate noise worth tuning | **Your developers** |

## The work

| # | Work item | Output |
|---|---|---|
| 6.1 | **Complete a SAMM self-assessment** | 15 practices scored 0–3 from real evidence, submitted and locked |
| 6.2 | **Set target maturity and prioritize the gaps** | A target level per practice, and an improvement plan with an owner and a done-condition per gap |
| 6.3 | **Review portfolio posture** | A read-out from the dashboards, with decisions recorded |
| 6.4 | **Review compliance and clean up exceptions** | Overrides re-justified or removed, expired exceptions closed, control mappings corrected. See [Exceptions](/docs/lifecycle-exceptions) |
| 6.5 | **Tune the tooling** | Ruleset changes and baselines, so the gate stays trusted rather than routinely bypassed |
| 6.6 | **Report program metrics** | Coverage, compliance, average score, and maturity trend from Orbit; remediation metrics from Wiz |
| 6.7 | **Run the champions cadence** | A monthly meeting run from the supplied package |
| 6.8 | **Attend and contribute to ASCOE** | Lessons shared across companies, session materials distributed |
| 6.9 | **Revise the baseline** | Updated controls with a changelog; recommended controls promoted to required as adoption matures |
| 6.10 | **Feed the changes back into phases 1–5** | Updated phase pages, templates, thresholds, and requirement checklists |

### 6.1 and 6.2 — Assessment, then a plan

Orbit runs the assessment itself: five business functions, three practices each, two maturity questions per practice, autosaving as you go. One assessment in progress per company at a time; submitting locks it for review. See [Policies & Compliance](/docs/policies-and-samm).

The discipline is in *how* you score. Score from evidence, not intention — the question is what actually happens across your repositories, not what your standards document says should. A practice where one team does it well and four don't is level 1, not level 2.

Orbit captures where you are. It doesn't yet capture where you're going, so the plan lives in a document.

<details>
<summary>SAMM improvement plan — the step after the assessment</summary>

```markdown
## SAMM Improvement Plan — <company>, <quarter>

Assessment completed: <YYYY-MM-DD>     Average maturity: <x.x>

### Targets
Set a target per practice based on the risk of the systems it covers,
not one blanket target for everything.

| Function | Practice | Current | Target | By when |
|---|---|---|---|---|
| Governance | Strategy & Metrics | | | |
| | Policy & Compliance | | | |
| | Education & Guidance | | | |
| Design | Threat Assessment | | | |
| | Security Requirements | | | |
| | Security Architecture | | | |
| Implementation | Secure Build | | | |
| | Secure Deployment | | | |
| | Defect Management | | | |
| Verification | Architecture Assessment | | | |
| | Requirements-driven Testing | | | |
| | Security Testing | | | |
| Operations | Incident Management | | | |
| | Environment Management | | | |
| | Operational Management | | | |

### The gaps we're actually working this quarter
Pick three. A plan that improves fifteen practices at once improves none.

| # | Practice | What we'll do | Owner | Done when | Due |
|---|---|---|---|---|---|
| 1 | | | | <observable condition, not "improved"> | |
| 2 | | | | | |
| 3 | | | | | |

### Deliberately not working on
| Practice | Why not this quarter |
|---|---|
| | <e.g. "level 1 is proportionate for our risk profile"> |

That table matters as much as the first one — an untouched practice with
a stated reason is a decision; an untouched practice with no reason is
something nobody noticed.

### Last quarter
| Gap | Target | Actual | What we learned |
|---|---|---|---|
| | | | |
```

Going 0→1 on a practice is about starting. 2→3 is about proving consistency, which takes far longer — so a plan with three 2→3 moves in one quarter is not a plan.

</details>

### 6.3 and 6.6 — Portfolio review and metrics

Orbit's dashboards are built for this: **Executive** for the program-level read, **Program Operations** for coverage gaps and data quality, **Application Owner** and **Developer** for the teams. See [Dashboards](/docs/dashboards).

<details>
<summary>Quarterly program review — agenda and record</summary>

```markdown
## Quarterly AppSec Review — <company>, <quarter>

Attending: <names>        Date: <YYYY-MM-DD>

### 1. Coverage (Executive + Program Operations dashboards)
| Metric | Last quarter | This quarter | Moving? |
|---|---|---|---|
| Applications onboarded | | | |
| With any testing tool configured | | | |
| SAST coverage % | | | |
| SCA coverage % | | | |
| Average security score | | | |
| Lowest-scoring application | | | |

### 2. Compliance
| Metric | Last quarter | This quarter |
|---|---|---|
| Policy compliance % | | |
| Controls met / evaluated | | |
| Control overrides in force | | |
| Expired exceptions | | |

### 3. Data quality — the honesty check
| Metric | Count | Trend |
|---|---|---|
| Applications never reviewed | | |
| Applications below 100% completeness | | |
| Repos not synced in 30+ days | | |
| Applications with no repo or tool link at all | | |

If this section is getting worse while section 1 improves, the numbers
in section 1 are describing a shrinking, better-maintained subset of
reality rather than actual progress. Check this one first.

### 4. Maturity
Current average: <x.x>    Target: <x.x>
Gaps worked this quarter: <from the improvement plan>
Movement: <practice: from → to>

### 5. What's actually blocking teams
The most useful item on this agenda. Ask directly:
- Which control do teams most often fail, and is the control wrong?
- Which gate is noisiest? Is anyone bypassing it?
- What are we asking for that nobody can produce?

### Decisions
| Decision | Owner | Due |
|---|---|---|
| | | |
```

</details>

### 6.4 — Compliance and exception cleanup

Two distinct things that both need periodic attention.

**Manual overrides** are Orbit's mechanism for a control that can't be evaluated from catalog data — an administrator marks it compliant or not, with a justifying note. They're useful and they quietly accumulate. An override set eighteen months ago for a reason nobody remembers is a compliance percentage built on trust rather than data.

**Exceptions** are the program-level version: a control deliberately waived, with a compensating control and an expiry. These live with Hearst's AppSec team and must not outlive their expiry date. [Exceptions](/docs/lifecycle-exceptions) covers the difference between the two in full — recording an exception as an override would make a real gap look like a pass.

<details>
<summary>Exception and override review log — run quarterly</summary>

```markdown
## Exception & Override Review — <company>, <quarter>

### Policy control overrides in force
From each application's Infosec Policy Compliance tab.

| App | Control | Set by | Set when | Still valid? | Action |
|---|---|---|---|---|---|
| | | | | | <keep / remove / make automatable> |

For each one, ask: is this still true, and could the control be
field-mapped now instead? An override that could be replaced by a real
field check should be.

### Exceptions
| App | Control | Owner | Expiry | Status | Action |
|---|---|---|---|---|---|
| | | | | <active / EXPIRED> | <renew / remediate / remove> |

Every EXPIRED row must be resolved before that application's next
release. There is no third option.

### Controls failing across many applications
| Control | Apps failing | Is the control wrong? |
|---|---|---|
| | | <e.g. "requires a field we don't collect" — fix the control> |

A control most applications fail is usually a signal about the control,
not about the teams.
```

</details>

### 6.5 — Tool tuning

The one work item here developers should push on. A gate that reports 200 findings nobody has triaged will be bypassed, and then it produces passing builds that mean nothing.

Tuning happens outside Orbit — in your scanners' rulesets — but it belongs on this phase's agenda because it's the difference between a gate that works and a gate that's theatre. When a developer reports a noisy rule, that's the system functioning correctly.

### 6.7 and 6.8 — Community cadence

Both programs are supplied ready to run. [Program Content](/program-content) holds the materials: agendas and pre-reads before a session, decks, recordings, and notes afterwards.

- **[Security Champions](/docs/program-security-champions)** — a monthly package with facilitator notes, pre-reads, games and challenges. Hearst's AppSec team runs the first few sessions, then your company takes over hosting with support available afterwards.
- **[ASCOE](/docs/program-center-of-excellence)** — a quarterly cross-company gathering. The point is that a problem one company solved saves the next company the same pain, so contributing matters as much as attending.

## Where the outputs go

| Output | Where |
|---|---|
| SAMM assessment | **Orbit** — [SAMM Assessments](/docs/policies-and-samm) |
| Maturity targets and improvement plan | **Your document** — no Orbit home yet |
| Quarterly review record | **Your document** |
| Metrics | **Orbit** — coverage, compliance, scores, maturity, read from the [Dashboards](/docs/dashboards); **Wiz** for anything finding- or remediation-based |
| Override and exception review log | **Your document**; overrides themselves live in Orbit |
| Control and policy changes | **Orbit** — [Policies & Compliance](/docs/policies-and-samm) |
| Baseline revisions | **The [Meeting the Policy](/docs/program-policy-baseline) page**, announced through What's New |
| Champions and ASCOE materials | **Orbit** — [Program Content](/program-content) |

## Done when

Per cycle rather than once:

- A SAMM assessment completed within the last 12 months — quarterly re-scoring preferred
- A target level set per practice, with named owners on the gaps being worked
- The quarterly review happened, with decisions recorded
- No override or exception is in force past its review point without re-justification
- Every expired exception is renewed, remediated, or removed
- Metrics published for the period
- Champions met monthly; ASCOE attended
- Any baseline change is reflected in the affected phase pages

## How this maps to policy and maturity

### Baseline controls satisfied here

This phase doesn't satisfy individual controls so much as keep the rest of them honest. Most directly it carries the **exceptions** process from [Meeting the Policy](/docs/program-policy-baseline) — the requirement that exceptions have an owner and an expiry, and that expired ones are re-approved, remediated, or removed — and it's where recommended controls get promoted to required as adoption matures.

### SAMM practices this is evidence for

The whole **Governance** function from [SAMM](/docs/program-samm):

- **Strategy & Metrics** — a security strategy with goals and measurements (6.2, 6.3, 6.6)
- **Policy & Compliance** — documented policies with tracked compliance and exceptions (6.4, 6.9)
- **Education & Guidance** — training and a champions network (6.7, 6.8)

Plus **Architecture Assessment** under Verification, through the periodic review of whether designs still match their requirements.

## What your security team sees

This phase inverts the usual framing: your security team isn't observing here, they're participating. What *Orbit* gives them to work from:

| They see | Where |
|---|---|
| Maturity across all 15 practices, per company | Completed SAMM assessments; the **Executive dashboard** rolls up the most recent ones and the average score |
| Program-level coverage, risk, and compliance | The **Executive dashboard** — onboarding and tool coverage, testing coverage by type, highest and lowest scorers, compliance rollup |
| Coverage gaps and data-quality problems | The **Program Operations dashboard** — never-reviewed applications, stale integrations, missing metadata, exceptions recorded |
| Which companies are participating at all | Company participation on the Executive dashboard, for platform administrators |
| Whether program content is being picked up | Program Content records who downloaded which material, per company — the platform's only real adoption measurement |
| What changed in the platform | The What's New feed |

**Where they're blind, and will have to ask you:**

- **Where you're trying to get to.** Orbit captures your current maturity and nothing about your targets, so "are we improving" needs the improvement plan document. [SAMM & Maturity](/docs/program-samm) describes a four-step cycle — baseline, target, prioritize, revisit — and Orbit currently implements step one.
- **Whether maturity is trending.** Assessments are stored per company but there's no comparison view across them, so quarter-over-quarter movement has to be assembled by hand.
- **Which exceptions need attention.** Overrides carry no expiry, so nothing surfaces for review — the log above is manual by necessity.

**What lives elsewhere by design:**

- **Remediation metrics.** Mean-time-to-remediate and anything else derived from individual findings comes from **Wiz**, the system of record for vulnerability findings. Orbit measures whether the checks are configured and running; it isn't going to hold findings, so pull this half of the metrics report from Wiz and read it alongside Orbit's coverage and compliance numbers.
- **Tool tuning.** Lives in your scanners' rulesets, and will stay there.

---

This phase feeds back into all five others. Around it: **[Phase 5 — Runtime & Operate](/docs/phase-runtime-operate)** is the last of the delivery phases. See **[The Lifecycle](/docs/program-lifecycle)** for all six.
