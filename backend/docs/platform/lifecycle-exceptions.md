# Exceptions

When you can't meet a requirement right now, an exception is how you say so on the record instead of quietly not meeting it.

Like [remediation](/docs/lifecycle-remediation), this isn't a phase — exceptions get filed during [Plan & Design](/docs/phase-plan-design) when you know at the outset you can't meet a control, during [CI Gate](/docs/phase-ci-gate) when a finding can't be fixed in a reasonable window, and they're checked again at every [release](/docs/phase-release-deploy).

## Filing one is the good outcome

Worth saying plainly, because the instinct runs the other way: an exception is not an admission of failure and it isn't a black mark. It's a decision made deliberately, by someone with the authority to make it, with the risk written down and a date attached.

The alternative isn't a more secure application — it's the same application with the same gap, and nobody tracking it. Every program has exceptions. The ones in trouble are the ones that don't know what theirs are.

## What makes one acceptable

Four things, and the [Information Security Policy](/docs/program-infosec-policy) requires all of them:

| | Why |
|---|---|
| **A business justification** | In terms someone outside your team can evaluate. "It's difficult" isn't one; "the vendor doesn't support it until their Q3 release" is |
| **A compensating control** | What reduces the risk meanwhile — extra monitoring, manual review, a network restriction, a smaller blast radius. "We'll be careful" is not a compensating control |
| **A named owner** | A person, not a team. Teams don't renew exceptions; people do |
| **An expiry date** | **"Indefinite" isn't valid.** An exception without a date is a decision nobody will revisit |

<details>
<summary>Exception request template</summary>

```markdown
## Exception Request — <application name>

Requirement:          <the policy requirement you can't meet, e.g. 4.6.14>
Risk tier:            <High | Medium | Low>
Requested by:         <name>            Date: <YYYY-MM-DD>
Owner (a person):     <name>
Requested expiry:     <YYYY-MM-DD — "indefinite" is not valid>

### Why we can't meet it now
<Business justification, in terms someone outside the team can evaluate.>

### Risk this accepts
<What could go wrong, and how bad it would be. Write this as though the
 thing you're worried about has already happened.>

### Compensating control
<What reduces the risk meanwhile: extra monitoring, manual review, a
 network restriction, a reduced blast radius.>

### Plan to close it
<What has to happen to remove the exception, and by when. If the answer
 is "nothing planned", say so — a permanent gap is a different
 conversation, and an honest one is better than a renewal treadmill.>
```

File it with Hearst's AppSec team.

</details>

## What happens to it

**Requested → approved → active → expiring → renewed, remediated, or removed**

The end of that sequence is where exceptions go wrong. An expired exception isn't a formality — the baseline treats it as blocking:

> Expired exceptions must be re-approved, remediated, or removed before the next release.

So the practical rule at [release time](/docs/phase-release-deploy) is that an expired exception stops the release the same way an above-threshold finding does, regardless of risk tier. Check expiry dates as part of your release checks, not after.

Renewal is legitimate, but a renewal should say what changed. An exception renewed three times with the same justification isn't an exception any more — it's an undocumented permanent decision, and it should either become one properly or get fixed.

## What an exception isn't

- **Not a way to skip a control permanently.** If a requirement genuinely doesn't apply to your application, that's a scoping conversation with AppSec, not an exception renewed forever.
- **Not a substitute for the fix.** It documents accepted risk; the underlying gap is still there.
- **Not a way past a verified live secret.** That blocks a merge on every application, every tier, with no exception route. Revoke and rotate.
- **Not something you grant yourself.** Exceptions are approved by Hearst's AppSec team.

## Exceptions and Orbit's overrides are different things

Easy to conflate, and worth keeping straight because they solve different problems.

| | **Exception** | **Policy control override** |
|---|---|---|
| What it means | We can't meet this requirement right now, and here's the risk we're accepting | Orbit can't evaluate this control from catalog data, so an administrator has recorded the answer |
| Set by | Hearst's AppSec team, on request | An Orbit administrator |
| Carries an expiry | Yes — required | No |
| Carries an owner and compensating control | Yes — required | No, just an optional note |
| Where it lives | Filed with the AppSec team | The application's Infosec Policy Compliance tab |

An override says *"this control passes, and here's why Orbit couldn't tell."* An exception says *"this control does not pass, and we've accepted that for now."* Recording an exception as an override would make a real gap look like a pass, which is the one outcome worth actively avoiding.

Overrides need periodic review of their own — an override set eighteen months ago for a reason nobody remembers is a compliance percentage resting on trust rather than data. That review is part of [Improve & Govern](/docs/phase-improve-govern), which has a log template covering both.

## Reviewing them

Quarterly, alongside the rest of phase 6. Three questions per exception:

1. **Is it still needed?** Circumstances change; some exceptions outlive their reason quietly.
2. **Is the compensating control actually in place?** Compensating controls decay — the extra monitoring gets turned off, the manual review stops happening.
3. **Has it expired, or is it about to?** Anything expired needs resolving before that application's next release.

A growing exception count isn't automatically bad — it can mean the program started measuring things it previously ignored. A growing count of *expired* exceptions is always bad.

---

**Related:** [Remediating Findings](/docs/lifecycle-remediation) · [Meeting the Policy](/docs/program-policy-baseline) · [Phase 6 — Improve & Govern](/docs/phase-improve-govern) · [The Lifecycle](/docs/program-lifecycle)
