# Policy Coverage Audit

Every clause of the HTS Information Security Policy's **App Sec** and **SDLC** sections, checked
against the lifecycle documentation as currently written.

## The standard being applied

The first pass of this audit was too literal: it searched for the policy's own wording and counted
its absence as a gap. That's the wrong test for an implementation guide sitting underneath a
normative policy. The docs' job is to *cause the required outcome*, not to restate the policy.

So each clause is sorted into one of three buckets:

| | Meaning |
|---|---|
| ✅ **Met** | Following the docs produces the outcome the policy requires |
| 🏷️ **Met, not labelled** | The docs produce the outcome, but never connect it to the clause. Cheap to fix, and worth fixing for evidencing — an auditor shouldn't have to infer the chain |
| ❌ **Gap** | Following the docs would *not* produce the outcome |

**Revised result: 22 met, 6 met-but-unlabelled, 7 gaps** — of which two were the docs contradicting
the policy, and three were one-line prohibitions with no natural home.

> **Status: all of it is now closed**, across two commits. The contradictions and labelling fixes
> went in first; the [Secure Coding Standard](/docs/lifecycle-secure-coding) page and the two
> substantive gaps followed. The only item still open is the **findings SLA** (App Sec 15), which is
> blocked on the intervals being set rather than on documentation. The tables below are kept as the
> record of what was assessed and why — see the closing section for what changed.

---

## The two contradictions — fix regardless

| | Policy | Docs today |
|---|---|---|
| **SBOM per production release** (App Sec 6) | *"SBOM records, generated for every production release"* | Work item 3.9 marked **(recommended)**; baseline lists it under **Recommended (SHOULD)** as *"not yet mandatory everywhere"* |
| **IaC / container scanning** (App Sec 14) | *"shall be scanned prior to deploying as a workload"* | Work item 3.8 marked **(recommended)**; same SHOULD listing |

A team following the docs in good faith concludes both are optional. Promote both to MUST in
`program-policy-baseline.md`, drop the *(recommended)* labels in `phase-ci-gate.md`, and add
IaC/container to phase 4's release checks — the policy's *"prior to deploying as a workload"* makes
it a deploy gate as well as a CI check.

---

## App Sec

| # | Clause | | Notes |
|---|---|---|---|
| 1 | SDLC-managed development | ✅ | The six phases are the SDLC process |
| 2 | Continuous testing of source, secure practices before release | ✅ | Phase 3 on every PR and default branch; phase 4 evidence |
| 3 | Segregation of duties for production deployment | 🏷️ | **The mechanism is already there and wasn't credited.** Phase 2's repository settings require: default branch protected with no direct pushes, PRs require at least one review, security checks required before merge, force-push disabled. Code cannot reach the default branch without a second person. What's missing is naming it, and closing the deploy path — see below |
| 4 | Dev/test/prod separated, logical and/or physical | ❌ | The docs *presume* separation and check aspects of it — staging resembles production, prod credentials distinct from staging and local, prod data not copied down, deploy identity can't reach other environments — but never require the environments to be separate. Closest to a real gap of the non-prohibition items |
| 5 | Software composition best practices for open source | ✅ | Phase 2 (2.6), phase 3 (3.3), Dependencies page |
| 6 | Application metadata maintained | ✅ | 1.1, 2.7, 5.7 — sub-items below |
| 6a | — Architecture documentation, complete and current | 🏷️ | Substantively there: the threat model (scope, actors, data types), product ingress points and data flows (protocol, classification, direction), the API schema, and recorded interfaces between applications. All held in Orbit, so "kept current" is structurally supported. Never called architecture documentation |
| 6b | — Risk level reviewed at least every 6 months | 🏷️ | Docs say "periodic, plus on material change". Your point stands — the policy sets the floor and is normative — but stating "at least every six months" in the baseline's risk-tier control costs four words and removes the ambiguity |
| 6c | — SBOM per production release | ❌ | Contradiction. See above |
| 6d | — Release artifacts attached to scan evidence | ✅ | Phase 4 (4.1) and the release evidence template |
| 6e | — Exceptions: justification, compensating control, owner, expiry, resolved before next release | ✅ | [Exceptions](/docs/lifecycle-exceptions) — all four attributes, plus the before-next-release rule |
| 7 | PR security-impact checklist, findings documented | ✅ | Phase 2 (2.2, 2.3); "a yes needs a follow-up answer, not just a tick" |
| 8 | DAST and/or SAST on all PRs and default branches | ✅ | Phase 3 (3.1, 3.4); gate checklist requires both explicitly |
| 9 | Secrets scan on PRs | ✅ | Phase 3 (3.2), with the hard-block rule and exposure runbook |
| 10 | Internet-facing apps get scheduled re-scans | ✅ | Phase 5 (5.1) and the re-scan schedule template |
| 11 | Threat modeling for internet-facing and high-risk features | ✅ | Phase 1 (1.5, 1.6) |
| 12 | Secure coding guidelines per NIST or OWASP | 🏷️ | Docs require secure coding guidelines; the policy's frameworks are examples ("such as"). Citing NIST SSDF and OWASP by name is a one-line improvement, not a gap |
| 13 | SCA for known vulnerabilities **and license risks** | ❌ | Vulnerabilities fully covered; **license risk appears nowhere** outside the glossary. Most SCA tools do both by default, so teams probably get it by accident — but nothing asks for it, and nothing would notice its absence |
| 14 | IaC / container scanned before deploying as a workload | ❌ | Contradiction. See above |
| 15 | Findings reviewed, plan of action, tracked to closure against SLA | ✅ | Review, plan of action and tracking to closure are covered by [Remediating Findings](/docs/lifecycle-remediation). SLA intervals are deferred by decision, not missing by oversight — the template is ready for them |

### Closing App Sec 3 properly

Per your suggestion, the PR point is where this belongs. Two additions:

1. **Name it in phase 2.** Frame the review-plus-branch-protection combination as segregation of duties — a change reaching the default branch has been seen by someone who didn't write it.
2. **Close the deploy path in phase 4.** PR review only segregates duties if production actually deploys *from* the protected branch through the pipeline. If a developer holds credentials that let them push to production from a laptop, the review is decorative. One work item, one sign-off line.

That second half is the part that isn't already implied, and it's why this isn't a pure labelling fix.

---

## SDLC

| # | Clause | | Notes |
|---|---|---|---|
| 1.1 | Secure coding techniques | ✅ | Phase 2 |
| 1.2 | Validation checks to detect corruption of information | ❌ | Input validation is well covered — that's the "deliberate acts" half. **"Processing errors" is integrity checking** — checksums, transaction integrity, reconciliation — and none of that appears. A different control from input validation |
| 1.3 | Test data selected carefully, protected, controlled | ❌ | Zero mentions of test data. Narrow, and largely follows from 5 below, but the selection-and-control half isn't addressed |
| 2 | Developed using secure coding guidelines | ✅ | As 1.1 |
| 3 | Passwords not hard coded | ✅ | Phase 3 secrets detection, agent rules, deploying step 2 — strongly covered |
| 4 | Automated code review tools | ✅ | Phase 3 SAST |
| 5 | Live production Confidential data not used for dev testing | ✅ | **Directly stated** in the phase 4 environment checklist: "Production data is not copied into non-production environments." Thin, but it's the control |
| 6 | Default and custom accounts removed before go-live | ✅ | Phase 4 checklist and pre-launch checklist. Minor: say "vendor-supplied default accounts" explicitly — those are the ones people forget |
| 7 | Web app controls based on OWASP Top 10 | 🏷️ | The requirements template covers most Top 10 categories — auth, authorization, injection via validation, crypto, logging. The Top 10 is never cited as the basis, and this clause names it specifically rather than as an example |
| 8 | No back doors circumventing access control | ❌ | Nothing. A prohibition with no home |
| 9 | Passwords not stored or sent in clear text or reversibly | 🏷️ | Substantively achieved: the docs say use a hosted identity provider and never write your own password hashing — follow that and you store no passwords at all. The explicit prohibition still isn't stated |
| 10 | No compilers, assemblers or object-code utilities in production | ❌ | Nothing. A prohibition with no home |
| 11 | Comply with vulnerability management requirements | ✅ | Remediating Findings, phase 5 |
| 12 | Review custom code before release | ✅ | PR review (2.3), CI gate, release evidence (4.1) |
| 13 | Encryption for Confidential data at rest and in transit | ✅ | Captured as a requirement the team fills in ("Encrypted at rest / in transit") plus HTTPS in the checklists. The policy's own wording is "where and when possible" |

---

## What's actually left

Seven items, and they fall into three kinds:

**Two contradictions** — SBOM and IaC/container marked recommended when the policy says shall.
Straightforward edits to two files.

**Two substantive gaps** — environment separation (App Sec 4) and SCA license risk (App Sec 13).
Both are a work item or a clause, not a workstream.

**Three prohibitions with no home** — no back doors (SDLC 8), no compilers in production
(SDLC 10), integrity validation (SDLC 1.2), plus test data handling (SDLC 1.3). These are the ones
that resisted placement in the first audit, and the reason is structural.

### Why the prohibitions have nowhere to go

The policy contains two kinds of requirement. **Process** requirements — do this activity, produce
this artifact — map cleanly onto phases, and every one of them is now met or merely unlabelled.
**Product** requirements — the application shall not contain a back door, shall not ship a compiler,
shall validate integrity — aren't activities and don't belong to a phase. They're properties the
software holds at all times.

There's no page for that, which is why these four specifically wouldn't land anywhere.

A **Secure Coding Standard** page under "Across Every Phase" is the fit — alongside
[Remediating Findings](/docs/lifecycle-remediation) and [Exceptions](/docs/lifecycle-exceptions),
both of which are cross-cutting for the same reason. It's smaller than the first audit implied,
since most of what I'd assigned to it turned out to be already covered:

- SDLC 8 — no back doors or access-control bypasses
- SDLC 10 — no compilers, assemblers or object-code utilities in production images
- SDLC 1.2 — integrity validation alongside input validation
- SDLC 1.3 — test data selection, protection and control
- Framework citations for App Sec 12 / SDLC 2 / SDLC 7 — NIST SSDF and the OWASP Top 10
- Restating SDLC 3, 9 and 13 as standards, since they're currently implied by "use a provider"

One page, and it gives the [agent rules file](/docs/secure-build-agent) a canonical source to
mirror — several of these are precisely what an AI assistant should be told never to do.

### Everything else

| Item | Edit |
|---|---|
| SBOM → MUST | `program-policy-baseline.md`, `phase-ci-gate.md` |
| IaC/container → MUST, and at deploy | Same two files, plus phase 4 release checks |
| Segregation of duties | Name it in phase 2 (2.3/2.4); add the deploy-path work item and sign-off line in phase 4 |
| Environment separation | Work item in phase 4, or a section on the standard page |
| SCA license risk | Clause in phase 3 (3.3), the baseline's SCA control, and the dependency decision record |
| Architecture documentation | One line in phase 1 naming what already constitutes it |
| 6-month tier review | Four words in the baseline's risk-tier control |
| Vendor-supplied default accounts | Wording in two checklists |
| Findings SLA | Blocked on the intervals; template is ready |

---

## What this still doesn't tell you

1. **Does the documented process meet the policy?** This audit. Answer: close, with the list above.
2. **Do teams follow it?** Not knowable from documentation.
3. **Can Orbit prove it?** Largely not yet — risk tier, secrets coverage, gate results, release
   evidence and SBOMs have no home in the catalog. Each phase page's "What your security team sees"
   section says which. Closing the documentation gaps above doesn't close this one, and it's the
   one that matters for evidencing compliance rather than claiming it.

---

## What was done

**Commit 1 — contradictions and labelling**

- SBOM per production release and container/IaC scanning promoted from SHOULD to required controls
  in the baseline; *(recommended)* labels dropped in phase 3. The SHOULD tier is now empty and has
  been removed — every control in the baseline is required.
- Container/IaC added to phase 4, since *"prior to deploying as a workload"* makes it a release gate
  and not only a CI check.
- Segregation of duties named in phase 2 where the control already lived (protected branch,
  required review, required checks, no force-push), with the missing deploy-path half added to
  phase 4 as work item 4.8 plus a sign-off line.
- Environment separation added as phase 4 work item 4.9, with its own checklist.
- Licence risk added to the SCA control and the phase 3 gate checklist.
- Six-month floor stated on the baseline's risk-tier control.
- Vendor-supplied default accounts named explicitly in two checklists.
- Phase 1 now states that the threat model, data flows and API schema together constitute the
  architecture documentation the policy requires.

**Commit 2 — the Secure Coding Standard**

A new page under "Across Every Phase", carrying the product-level requirements that don't belong to
any phase: no back doors, no cleartext or reversibly-stored passwords, no compilers or build tooling
in production images, integrity validation distinct from input validation, test data selection and
protection, and the OWASP Top 10 and NIST SSDF named as the reference frameworks. It ends with a
clause-to-section map so the policy can be traced through it, and a conformance checklist.

Phase 1's requirements section now points at it — requirements are what's specific to *this*
application, and the universal properties don't need restating per application.

## Still open

| Item | Blocked on |
|---|---|
| **Findings SLA** (App Sec 15) | Fix-by intervals by severity and tier being published. The template in [Remediating Findings](/docs/lifecycle-remediation) is ready for them |
| **Orbit evidencing** | Unchanged by any of this. Risk tier, secrets coverage, gate results, release evidence, SBOMs and architecture documentation still have no home in the catalog — see each phase page's "What your security team sees" |
