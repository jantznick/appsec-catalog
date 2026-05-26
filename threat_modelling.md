# Threat model — catalog

**Use this version** when storing threat models in an **application inventory / catalog** or building a **simple web form**. No Threat Dragon, no Mermaid, no large tables.

- **Machine schema for developers:** [`threat-model-catalog-schema.yaml`](threat-model-catalog-schema.yaml)

**Policy:** Satisfies control **B2** / evidence `threat_model_document` when `status` is **approved** and STRIDE sections are complete. See [policy baseline](../framework/appsec-policy-baseline.md).

**When required:** `internet_facing == true` OR `risk_tier` is `medium` or `high` (or per org rubric).

---

## How to use in a catalog

1. Create one record per **feature, release, or major change** (not necessarily one per app forever).
2. Map each section below to a **form field** or **JSON property** (see schema).
3. Store the submitted JSON (or rendered PDF export) as the catalog attachment.
4. Set registry/catalog `threat_model_document` link to the record URL or ID.

---

## 1. Record header

| Field | Value | Required |
|-------|--------|----------|
| `app_id` | | Yes |
| `app_name` | | No |
| `scope_title` | Short title (e.g. "Checkout v2 API") | Yes |
| `scope_summary` | 2–3 sentences: what changes, who uses it | Yes |
| `risk_tier` | `low` / `medium` / `high` | Yes |
| `internet_facing` | `true` / `false` | Yes |
| `data_classification` | `public` / `internal` / `confidential` / `regulated` | Yes |
| `author` | | Yes |
| `status` | `draft` / `in_review` / `approved` / `superseded` | Yes |
| `version_date` | YYYY-MM-DD | Yes |
| `ticket_url` | Link to epic/PR/release | No |
| `diagram_url` | Link to optional diagram (image, Confluence, etc.) | **No** |

---

## 2. Scope (short)

**In scope (one short paragraph or bullet list, max ~300 characters):**

**Out of scope (optional, max ~300 characters):**

---

## 3. Actors and data (checkboxes in UI)

**Who interacts with this scope?** (select all that apply)

- [ ] End user (customer)
- [ ] Privileged user (admin, support)
- [ ] API client (machine)
- [ ] Partner / external integration
- [ ] Internal service
- [ ] Platform administrator

**Sensitive data handled in this scope?** (select all that apply)

- [ ] None / internal-only non-sensitive
- [ ] Credentials / secrets
- [ ] PII (names, email, profile, etc.)
- [ ] Payment / financial
- [ ] Health / regulated
- [ ] Other regulated (specify in scope_summary)

---

## 4. Trust boundaries (1–5 rows)

List where trust **changes** (keep names short). Add rows in the form as needed.

| # | Boundary name | Type | Notes (optional) |
|---|---------------|------|------------------|
| 1 | e.g. User browser → API | `user_to_system` | |
| 2 | e.g. API → database | `system_to_datastore` | |
| 3 | | `system_to_third_party` | |

**Boundary types for dropdowns:** `user_to_system` · `system_to_datastore` · `system_to_third_party` · `internal_service_to_service` · `other`

---

## 5. STRIDE lite (six questions)

For each category: **Does it apply?** If yes, one sentence each for concern and mitigation (or ticket link).

| Category | Applies? | What could go wrong? | Mitigation or ticket |
|----------|----------|----------------------|----------------------|
| **S**poofing | Yes / No | | |
| **T**ampering | Yes / No | | |
| **R**epudiation | Yes / No | | |
| **I**nformation disclosure | Yes / No | | |
| **D**enial of service | Yes / No | | |
| **E**levation of privilege | Yes / No | | |

If **Accepted** for any row, link an [exception request](exception-request-form.md) — do not use "Accepted" without approval.

---

## 6. Top risks (optional, max 5)

Only the **highest** items not fully captured above.

| Summary | Likelihood | Impact | Mitigation | Status | Ticket |
|---------|------------|--------|------------|--------|--------|
| | L/M/H | L/M/H | | open / mitigated / accepted | |

---

## 7. Third parties (0–5 rows)

| Name | Purpose | Shares data? | Security reviewed? |
|------|---------|--------------|-------------------|
| | | Yes / No | Yes / No |

---

## 8. Security requirements (0–8 bullets)

Short implementation reminders (not a full ASVS review).

| # | Requirement | How verified |
|---|-------------|--------------|
| 1 | e.g. Validate all input server-side | manual_review / unit_test / sast / dast |
| 2 | | |

---

## 9. Approval

| Field | Value |
|-------|--------|
| Engineering lead | |
| AppSec reviewer (if required) | |
| Approved date | |
| Outcome | `approved` / `changes_required` |
| Conditions (optional) | |

---

## Example JSON (catalog storage)

```json
{
  "app_id": "APP-1234",
  "scope_title": "Customer profile API v2",
  "scope_summary": "New REST endpoints for profile read/update. Used by web and mobile clients.",
  "risk_tier": "medium",
  "internet_facing": true,
  "data_classification": "confidential",
  "author": "jane.doe@example.com",
  "status": "approved",
  "version_date": "2026-05-15",
  "ticket_url": "https://jira.example/PROJ-100",
  "actors": ["end_user", "api_client"],
  "data_types_handled": ["pii", "credentials"],
  "trust_boundaries": [
    { "name": "Mobile app to API", "boundary_type": "user_to_system", "notes": "OAuth bearer" },
    { "name": "API to Postgres", "boundary_type": "system_to_datastore", "notes": "" }
  ],
  "stride": {
    "spoofing": { "applies": true, "concern": "Stolen tokens", "mitigation": "Short-lived JWT + rotation", "ticket_url": "" },
    "tampering": { "applies": true, "concern": "IDOR on profile id", "mitigation": "AuthZ check on every request", "ticket_url": "https://jira.example/PROJ-101" },
    "repudiation": { "applies": false },
    "information_disclosure": { "applies": true, "concern": "Verbose errors", "mitigation": "Generic error responses", "ticket_url": "" },
    "denial_of_service": { "applies": true, "concern": "Bulk read", "mitigation": "Rate limiting", "ticket_url": "" },
    "elevation_of_privilege": { "applies": true, "concern": "Role misconfiguration", "mitigation": "RBAC tests in CI", "ticket_url": "" }
  },
  "approval": {
    "engineering_lead": "lead@example.com",
    "appsec_reviewer": "appsec@example.com",
    "approved_date": "2026-05-16",
    "outcome": "approved"
  }
}
```