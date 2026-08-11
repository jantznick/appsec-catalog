# Dashboard Compliance and Maturity Framework

This document records what the executive dashboard can measure today, what it intentionally leaves unscored, and the inputs needed to complete the compliance and maturity views.

## Compliance: implemented foundation

The executive dashboard now evaluates the same active, field-mapped policy controls used by the application detail compliance view. The initial aggregation is control-weighted:

- **Policy adherence:** meeting controls divided by all evaluated controls.
- **Applications with compliant policies:** applications for which every applicable policy is 100% compliant.
- **Policy exceptions:** manual policy-control overrides currently recorded.
- **Evidence completeness:** based on required catalog metadata per application and policy control. This will remain `—` until the required-field and freshness rules are formalized.

The evaluation is scoped exactly like the rest of the dashboard: administrators can filter by company or division; non-administrators are restricted to their company. If no active policy controls apply, the dashboard reports that compliance data needs configuration rather than displaying a misleading 0%.

### Compliance decisions still needed

1. The control-weighted versus policy-weighted choice is intentionally deferred for now. The current implementation uses control-weighted adherence.
2. All applications are expected to have applicable policies. The current implementation still reports the number of applications with applicable policies so gaps in policy configuration are visible.
3. Evidence is the metadata collected in the Atlas catalog and is required at both the application and policy-control level. Evidence may be hosted outside Atlas for now; Atlas should eventually store a reference, reviewer, collection date, and freshness state.
4. Approved overrides count as meeting. The dashboard counts overrides separately so compliance cannot improve without the exception volume remaining visible.

## Maturity: Atlas SAMM-aligned questionnaire

The dashboard exposes a SAMM scaffold with the five SAMM business functions:

- Governance
- Design
- Implementation
- Verification
- Operations

Atlas uses the current OWASP SAMM v2 five-function and 15-practice structure. Its versioned, Atlas-authored question bank contains one concrete question for each stream: two per practice and 30 total. Questions ask about observable processes, controls, and outcomes rather than asking users to choose a maturity level.

Each question has four factual operating states mapped internally to 0–3. Atlas averages both stream answers into a practice score, then averages all 15 practices for the company score. Results are explicitly labeled SAMM-aligned; the official OWASP SAMM Toolbox remains authoritative for formal assessment and benchmarking.

The application security score is deliberately not used as a SAMM score. It measures application posture, while SAMM measures the maturity of practices and processes.

### Confirmed maturity decisions

1. The implemented assessment is versioned as `atlas-samm-1.0` and mapped to OWASP SAMM 2.0. A future question-bank or SAMM revision should be introduced as a new framework version rather than silently changing historical assessments.
2. Assessment scope is company-level. The HTS team will track company assessments centrally, while each company owns its responses and review.
3. Assessments should be completed at least twice per year. Records need an assessment owner, HTS reviewer, assessment date, review date, and next-due date.
4. Evidence may remain external. Each answer should support an optional evidence reference and notes rather than requiring Atlas attachments initially.
5. Aggregation is a simple average. Every practice is included in the denominator, so unanswered or low-scoring practices lower the result.
6. Every completed assessment becomes a historical snapshot so quarter-over-quarter and year-over-year trends can be displayed.

## Proposed future records

When the rubric is approved, the likely data model is:

- `MaturityFramework`: model name, source, and version.
- `MaturityDomain`: one of the five functions, with display order and weight.
- `MaturityPractice`: rubric item, scoring anchors, and evidence requirements.
- `MaturityAssessment`: company, owner, HTS reviewer, dates, due date, and status.
- `MaturityAssessmentResult`: practice score, rationale, evidence reference, and review metadata.

This keeps the rubric configurable and preserves historical assessments instead of overwriting the prior quarter.

## Implemented assessment workflow

The first workflow is now available from the company workflow: open a company, select the **Maturity assessment** tab, and start or continue an assessment. The questionnaire itself uses `/samm-assessments` routes behind that flow:

- Starts a company-level draft using the SAMM v2 five-function/15-practice structure.
- Saves both stream-question answers per practice, rationale, notes, and optional external evidence references.
- Requires both questions in every practice before submission.
- Averages the two internally mapped answers into a 0–3 practice score, then calculates a simple average across all 15 practices.
- Sets the next assessment due date six months after submission.
- Keeps completed assessments immutable and preserves later assessments as history.
- Allows administrators to review completed assessments.

The base database migration is `20260811190000_add_samm_assessments`; `20260811200000_add_sammwise_answers` adds answer storage and fractional derived scores. Deploy them through the normal backend migration process.

## Current dashboard states

| Area | Current behavior | Why |
| --- | --- | --- |
| Policy adherence | Calculated from active field-mapped controls | Existing policy engine is available |
| Policy exceptions | Counts manual control overrides | Existing override records are available |
| Evidence completeness | `—` | Required metadata and freshness rules still need to be formalized |
| SAMM score | Calculated after a completed assessment | Uses a simple average across all 15 practices |
| SAMM trend | `—` until a second assessment exists | Historical snapshots are now stored |
| Maturity by division | `—` | Assessments are company-level; roll-up presentation can be added later |

## Reference links

- [OWASP SAMM project](https://owaspsamm.org/)
- [OWASP SAMM v2 release notes](https://owaspsamm.org/release-notes-v2/)
- [SAMMwise reference repository](https://github.com/owaspsamm/sammwise) — archived reference implementation
