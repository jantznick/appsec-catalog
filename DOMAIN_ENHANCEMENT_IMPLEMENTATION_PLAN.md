# Domain Enhancement Implementation Plan

## Overview
Enhance hosted domains into first-class assets with optional metadata, derived subdomain relationships, manual DNS checks, and manual web snapshots (Puppeteer). This plan intentionally keeps `Company.domains` unchanged and scoped to email-domain auto-assignment only.

## Finalized Decisions

1. `Company.domains` is complete and out of scope for this enhancement.
2. Domain metadata fields should be optional for backward compatibility.
3. Ownership uses a single optional `owner` field (same style as `Application.owner`).
4. Domain `status` default is `"unknown"`.
5. Relationship hierarchy should be derived at read time, not stored as parent-child foreign keys.
6. Manual checks (DNS and web snapshots) are admin-only.
7. DNS checks include: `CNAME`, `A`, `AAAA`, `TXT`, and email-related records.
8. Web snapshots use Puppeteer, local file storage, and metadata persistence.
9. Web snapshot retention: keep latest 5 per domain.
10. DNS snapshots: keep all records for history and change tracking.
11. Web snapshot flow should try HTTPS first, then HTTP fallback, and record protocol/fallback metadata.
12. Apex grouping must gracefully handle a standalone deep subdomain (example: only `x.y.z.com` exists).

## Goals

- Make hosted domains manageable like applications, but lightweight and backward-compatible.
- Track and compare DNS state over time (manual checks first).
- Capture web-facing snapshots of domains for visibility and audit context.
- Support apex-based related-domain views without enforcing explicit parent records.

## Non-Goals (For This Iteration)

- No scheduler/cron-based automated checks.
- No alerting integrations (email/Slack/webhooks) yet.
- No changes to `Company.domains` behavior or naming.

## Data Model Plan

### 1) Extend `Domain`

Add fields to `Domain`:

- `description String?`
- `owner String?`
- `status String @default("unknown")`
- `apexDomain String?`
- `updatedAt DateTime @updatedAt` (recommended for auditability and UI)

Indexes:

- `@@index([companyId, apexDomain])`
- Keep existing indexes and unique constraints intact.

### 2) New Model: `DomainDnsSnapshot`

Track full DNS check result per manual run:

- `id String @id @default(cuid())`
- `domainId String`
- `domain Domain @relation(...)`
- `checkedAt DateTime @default(now())`
- `status String` (`ok`, `warning`, `error`)
- `error String?`
- `cnameRecords String?` (JSON)
- `aRecords String?` (JSON)
- `aaaaRecords String?` (JSON)
- `txtRecords String?` (JSON)
- `mxRecords String?` (JSON)
- `nsRecords String?` (JSON)
- `spfRecord String?` (derived from TXT)
- `dmarcRecord String?` (lookup `_dmarc.<domain>`)
- `dkimRecords String?` (JSON keyed by selector)
- `createdBy String?` (admin user ID who triggered check)

Indexes:

- `@@index([domainId])`
- `@@index([checkedAt])`
- `@@index([domainId, checkedAt])`

### 3) New Model: `DomainDnsChange` (Monitoring Changes)

Persist computed diffs between latest and previous DNS snapshots:

- `id String @id @default(cuid())`
- `domainId String`
- `snapshotId String` (the new snapshot that introduced this change)
- `changeType String` (for example: `record_added`, `record_removed`, `record_modified`)
- `recordType String` (`A`, `AAAA`, `CNAME`, `TXT`, `MX`, `NS`, `SPF`, `DMARC`, `DKIM`)
- `severity String` (`info`, `warning`, `high`)
- `summary String`
- `details String?` (JSON diff payload)
- `createdAt DateTime @default(now())`

Indexes:

- `@@index([domainId])`
- `@@index([snapshotId])`
- `@@index([createdAt])`

### 4) New Model: `DomainWebSnapshot`

Track manual website snapshots:

- `id String @id @default(cuid())`
- `domainId String`
- `domain Domain @relation(...)`
- `checkedAt DateTime @default(now())`
- `urlAttempted String` (usually `https://domain`)
- `usedHttpFallback Boolean @default(false)`
- `finalUrl String?`
- `statusCode Int?`
- `title String?`
- `loadTimeMs Int?`
- `screenshotPath String?` (local storage path)
- `error String?`
- `createdBy String?` (admin user ID who triggered snapshot)

Indexes:

- `@@index([domainId])`
- `@@index([checkedAt])`
- `@@index([domainId, checkedAt])`

## Relationship Strategy (Derived, Not Stored)

### Apex Derivation

- Compute and store `apexDomain` whenever a domain is created/normalized.
- Use a public suffix-aware parser (for example `tldts`) so domains like `example.co.uk` are handled correctly.

### Related Domain Fetch

For `GET /api/domains/:id`:

1. Load target domain.
2. Fetch same-company domains with matching `apexDomain`.
3. Derive hierarchy in memory:
   - parent = nearest existing suffix candidate
   - children = direct descendants
   - siblings = same parent

### Standalone Deep Subdomain UX

If only `x.y.z.com` exists in the apex group:

- show it as a standalone discovered domain
- no implied missing-parent error state
- render parent/children as empty with informative text

## Backend Implementation Plan

### Phase 1: Schema + Utilities

1. Update Prisma schema with fields/models above.
2. Generate migration and Prisma client.
3. Add utility module for:
   - domain normalization
   - apex extraction
   - in-memory relationship derivation
4. Backfill `apexDomain` for existing domains in migration script.

### Phase 2: Domain Metadata API

Update `backend/routes/domains.js`:

- extend existing list/detail responses with new metadata fields
- add metadata update endpoint:
  - `PUT /api/domains/:id` (admin only)
  - allowed: `description`, `owner`, `status`
- preserve existing access control rules

### Phase 3: Manual DNS Check API

Add service (for example `backend/services/domainDns.js`):

- run lookups for `CNAME`, `A`, `AAAA`, `TXT`, `MX`, `NS`
- derive:
  - SPF from TXT
  - DMARC from `_dmarc.<domain>` TXT
  - DKIM from default selectors
- persist `DomainDnsSnapshot`
- diff against previous snapshot and write `DomainDnsChange` rows

Add routes (admin-only for POST):

- `POST /api/domains/:id/check-dns`
- `GET /api/domains/:id/dns-snapshots`
- `GET /api/domains/:id/dns-changes`
- optional: `GET /api/domains/:id/dns-latest`

### Phase 4: Manual Web Snapshot API (Puppeteer)

Add service (for example `backend/services/domainSnapshot.js`):

- attempt `https://<domain>`
- if HTTPS fails, retry `http://<domain>`
- capture screenshot and metadata
- store image locally (for example `backend/storage/domain-snapshots/<domainId>/...png`)
- persist `DomainWebSnapshot`
- enforce retention: delete older snapshots/files beyond latest 5 per domain

Add routes:

- `POST /api/domains/:id/snapshot` (admin-only)
- `GET /api/domains/:id/snapshots`

## Frontend Implementation Plan

### Pages/Components

1. Update `frontend/src/lib/api.js` with new domain endpoints.
2. Update `frontend/src/pages/Domains.jsx`:
   - add columns for `status`, `owner`, optional apex indicator.
3. Update `frontend/src/pages/DomainDetail.jsx`:
   - metadata card (`description`, `owner`, status badge)
   - related domains section (derived hierarchy output)
   - DNS checks card:
     - manual run button (admin only)
     - latest snapshot summary
     - DNS change history table
   - web snapshots card:
     - manual snapshot button (admin only)
     - latest screenshot preview + metadata
     - snapshot history table (latest 5 retained)

### Styling/UX Guidance

- Reuse existing `Card`, `Table`, `Button`, `LoadingPage`, and toast patterns.
- Follow existing spacing, heading, and badge styles from sibling pages.
- Keep empty states informative and concise.

## Security and Reliability Notes

### Admin-Only Manual Actions

- Enforce `requireAuth` + admin role checks for:
  - DNS check trigger endpoint
  - web snapshot trigger endpoint

### SSRF Protections for Puppeteer

- Block localhost/private/link-local destinations.
- Limit redirects and navigation timeout.
- Run checks with conservative timeout and resource constraints.

### DNS Check Robustness

- Normalize/sort record values before diffing to reduce false positives.
- Capture lookup errors explicitly in snapshot metadata.
- Continue persisting snapshot on partial failures (status `warning`/`error`).

## Proposed Endpoint Contract (Draft)

- `GET /api/domains` -> list including metadata and counts
- `GET /api/domains/:id` -> domain + related domains + derived relationship info + applications
- `PUT /api/domains/:id` -> update metadata (admin only)
- `POST /api/domains/:id/check-dns` -> run manual DNS check (admin only)
- `GET /api/domains/:id/dns-snapshots` -> DNS check history
- `GET /api/domains/:id/dns-changes` -> computed change history
- `POST /api/domains/:id/snapshot` -> run manual Puppeteer snapshot (admin only)
- `GET /api/domains/:id/snapshots` -> web snapshot history

## Phased Delivery Order

1. Schema + migrations + apex backfill
2. Domain metadata API + UI basics
3. DNS snapshot/check flow + change detection + UI history
4. Puppeteer snapshot flow + retention + UI
5. polish and edge-case handling for standalone deep subdomains

## Open Questions To Confirm During Build

1. Status vocabulary:
   - keep freeform string, or enforce enum-like values in API validation?
2. Default DKIM selectors:
   - start with `default`, `selector1`, `selector2`, `google`, `k1`?
3. DNS check timeout/retry policy:
   - single pass vs retry-once for transient failures?

## Definition of Done

- Domain metadata is editable and visible.
- Apex grouping works and deep-subdomain-only cases render cleanly.
- Admin can run manual DNS checks and view record snapshots and diffs.
- Admin can run manual web snapshots, see fallback metadata, and view retained screenshots.
- Web snapshot retention enforces latest 5 per domain.
- Existing domain/app association behavior remains intact.
