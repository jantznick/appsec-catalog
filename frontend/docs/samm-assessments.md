# SAMM Assessments

Atlas provides a company-level OWASP SAMM 2.0 questionnaire from the **Maturity assessment** tab on each company page. Starting an assessment there automatically uses that company; there is no separate company-selection screen.

## Questionnaire

The assessment uses the OWASP SAMM 2.0 structure with an Atlas-authored question bank. It contains:

- Five business functions: Governance, Design, Implementation, Verification, and Operations.
- Three security practices per function, for 15 practices total.
- Two concrete questions per practice, one for each SAMM stream.
- Thirty questions total, presented as 15 practice sections.
- Four factual operating states per question; maturity values remain internal.

Atlas averages the two internally mapped stream answers to produce each practice’s 0–3 score. A company’s assessment score is the simple average of all 15 completed practice scores. The assessment is labeled SAMM-aligned and does not claim to replace the official OWASP SAMM Toolbox.

This is a streamlined SAMM-aligned self-assessment. The official SAMM Toolbox remains the appropriate option when a detailed quality-criteria assessment or benchmark-compatible result is required.

## Workflow

1. Open a company and select **Maturity assessment**.
2. Start an assessment or resume the company’s existing draft.
3. Answer the two concrete questions for each practice. Atlas saves each response automatically.
4. Optionally record rationale and an external evidence reference for a practice.
5. Submit after all 15 practice sections are complete.

Submitted assessments are immutable historical snapshots. Atlas sets the next assessment due date six months after submission, and administrators can record an HTS review.

The versioned question bank is stored in `backend/data/atlasSammQuestionBank.js`. Answers are stored as JSON per practice, while the derived practice score is stored as a number for reporting. The migration `20260811200000_add_sammwise_answers` adds these fields to existing SAMM assessment installations.
