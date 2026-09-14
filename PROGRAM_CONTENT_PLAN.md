# Program Content Distribution Plan

Build the "dedicated portal" that [AppSec Center of Excellence](/docs/program-center-of-excellence)
and [Security Champions](/docs/program-security-champions) already promise, so ASCOE session
materials and monthly Champions packages are housed in Orbit and distributed to member companies.

Both docs currently end with a "Getting content" section saying the portal is *being built* and to
email the AppSec team meanwhile. This plan replaces that with a real surface, and those two
paragraphs get rewritten as the last step.

## What the two programs actually need

| | ASCOE | Security Champions |
|---|---|---|
| Cadence | Quarterly | Monthly |
| Unit of content | A **session**, upcoming or past | A **package** to go run a meeting with |
| Typical materials | Vendor decks, recordings, discussion notes | News articles, lessons learned, games, challenges |
| Read **before** | Attendees reviewing the agenda | Lead prepping; champions doing pre-reads |
| Read **after** | Recording, decks as delivered, recap | Reference for whoever missed it |
| Extra needs | Date, location | Theme, facilitator notes ("how to run this") |

They're close enough to share machinery and different enough that per your call they get **separate
release models**. Layout, wording, and the detail page differ per program.

Note the asymmetry that justifies the split: ASCOE is hosted *by* Hearst's AppSec team, so it has
no facilitator to brief, while a Champions package exists precisely to be handed to someone else to
run. One model would have carried a `facilitatorNotes` column that is permanently null for half its
rows.

### A release is not a single drop

Both programs publish across their meeting date, not at one moment: an agenda goes up beforehand,
the recording and as-delivered decks land afterwards. So a release is long-lived and its asset list
grows, which has two consequences the model has to carry:

- **Assets need a section**, or a pre-read gets buried under six post-session decks and nobody can
  tell what to look at before the meeting. See `section` on `ContentAsset` below.
- **`status` stays a two-state draft/published.** An agenda-only release is just a published
  release with few assets — no third "agenda published" state, no separate publish step per
  section. Admins add assets over time to an already-published release.

## Data model

Two release tables, one shared asset table.

### `AscoeSession`

| Field | Notes |
|---|---|
| `id`, `createdAt`, `updatedAt` | cuid + timestamps |
| `slug` | unique, URL key — `q3-2026` |
| `title` | `Q3 2026 — Threat Modeling at Scale` |
| `periodLabel` | `Q3 2026` |
| `sessionDate` | nullable — drives ordering and "upcoming vs past" |
| `location` | nullable — `Virtual (Teams)`, `NYC — 300 W 57th` |
| `summary` | **member-facing** blurb |
| `body` | member-facing agenda/recap |
| `publicSummary` | marketing blurb for the public catalog |
| `isPubliclyListed` | default `false`; independent of `audienceScope` |
| `status` | `draft` \| `published` |
| `publishedAt` | set on first publish, **never cleared** — see [Retiring content](#retiring-content) |
| `audienceScope` | `all` \| `companies` |
| `createdBy` → `User` | `onDelete: SetNull`, same as `ProductUpdate` |

### `ChampionsPackage`

Same spine, with these differences instead of `sessionDate`/`location`:

| Field | Notes |
|---|---|
| `slug` | `2026-09` |
| `periodLabel` | `September 2026` |
| `periodStart` | first of the month — ordering + "current package" callout |
| `theme` | nullable — `Phishing & Social Engineering` |
| `facilitatorNotes` | the "how to run this meeting" half ASCOE has no use for |

### Text rendering

All four long-text fields (`summary`, `body`, `publicSummary`, `facilitatorNotes`) are **plain
text**, not Markdown, following the one existing precedent for admin-authored prose in this app:
`ProductUpdate.body`, rendered by `renderBody` in
[WhatsNew.jsx:16](frontend/src/pages/WhatsNew.jsx:16), which splits on blank lines into `<p>`
elements as React children.

`marked` exists in the codebase but is used *only* by `Docs.jsx`, for `.md` files committed to the
repo — a different thing from rows an admin typed into a form. Reusing `renderBody` here means no
HTML pipeline, no `dangerouslySetInnerHTML`, no sanitizer dependency, and no stored-XSS surface on
a feature that also serves public traffic. If lists turn out to be genuinely needed later,
extending `renderBody` to handle `- ` bullets is a much smaller step than adopting Markdown.

### `AscoeSessionCompany` / `ChampionsPackageCompany`

Join tables, composite PK `[releaseId, companyId]`, cascade on both sides. Only consulted when
`audienceScope = 'companies'`.

#### Why a scope column instead of "list every company"

The audience *is* just a list of companies, and "all companies" could be expressed by inserting a
row per company. Adding the enum later would also be a trivial migration — I overstated that cost
earlier. The reason to keep it is not migration cost, it's that a materialized list means
**"every company that exists right now"**, and that goes stale:

- Onboard a company next month and it silently sees *none* of the back catalog. Every prior
  release would need backfilling, forever, on every onboarding.
- `audienceScope = 'all'` means "everyone, ongoing" — a new company gets the archive automatically,
  which is what you'd want for a Champions program whose whole pitch is ready-made content.

The same reasoning argues against the other shortcut, *empty list = everyone*: that makes an
access-control check **fail open**, so a bug that drops the company list silently widens the
audience. With an explicit column defaulting to `'companies'`, the same bug fails closed — nobody
sees it, someone notices, nothing leaked.

**Confirmed:** a newly onboarded company should automatically get the back catalog, so the column
stays and `audienceScope = 'all'` is the default for anything not deliberately targeted.

### `ContentAsset` — one table, two nullable parent FKs

| Field | Notes |
|---|---|
| `ascoeSessionId`, `championsPackageId` | both nullable, exactly one set; `onDelete: Cascade` |
| `kind` | `slide_deck` \| `recording` \| `document` \| `article` \| `game` \| `challenge` \| `link` — drives the badge/icon |
| `section` | display grouping; see below |
| `title`, `description`, `displayOrder` | `displayOrder` sorts *within* a section |
| `externalUrl` | SharePoint/OneDrive link — "go get it at the source" |
| `embedUrl` | SharePoint `Embed.aspx` URL, for inline video playback |
| `storagePath` | server-generated relative path; **never** client input |
| `fileName` | original name, used only for `Content-Disposition` |
| `mimeType`, `sizeBytes`, `checksumSha256` | |
| `uploadedBy` → `User` | |

`externalUrl` and the uploaded-file columns are **independent** — set either, or both. Both set is
the normal case you asked for: the asset card shows *Download* and *Open in SharePoint* side by
side, pointing at the same material.

#### `section` — what to look at, and when

One shared enum, rendered as headings on the detail page. Each program shows only the sections it
uses, in its own order, and empty sections don't render at all:

| `section` | ASCOE heading | Champions heading |
|---|---|---|
| `agenda` | Before the session | — |
| `pre_read` | Come prepared | For champions to review beforehand |
| `facilitator` | — | Running the meeting |
| `materials` | From the session | In the meeting |
| `activity` | — | Games & challenges |
| `recording` | Watch the session | Watch the session |

**Confirmed:** this is a display grouping, not a permission. Facilitator content is grouped under
its own heading, visible to anyone who can see the release. A champion seeing the facilitator guide
is harmless; a champion who *can't* find their pre-read is the actual failure mode.

That decision keeps the whole feature inside the existing `isAdmin` + `companyId` permission model —
no champion-lead role anywhere in this plan. Assets need no `audience` column.

`facilitatorNotes` on the package stays a prose field rather than becoming a `facilitator`-section
asset: it's the "how to run this" narrative, not a file to hand out.

### `ContentAssetDownload`

`assetId`, `userId`, denormalized `companyId`, `createdAt`. One row per download. Gives you
"which companies actually picked up the September package" — adoption data the program has no way
to get today.

> **Stated assumption, worth a look.** You asked for separate models per program, and the two
> release tables are separate. I kept **one** `ContentAsset` table rather than
> `AscoeSessionAsset` + `ChampionsPackageAsset`, because every hard part of assets — multipart
> upload, the MIME allowlist, path safety, the streaming download route, the embed-host allowlist,
> the download log — would otherwise exist twice, and a bug fixed in one copy would live on in the
> other. The programs still differ everywhere they meaningfully differ. Splitting it later is a
> mechanical migration; say the word if you'd rather have it split now.

## Access control

Two genuinely separate surfaces, not one surface with two permission levels.

### 1. The public catalog — marketing

A page advertising what the programs produce. Per release: `title`, `periodLabel`, the date or
theme, the `publicSummary` blurb, and a count/breakdown of what's attached ("3 decks, 1
recording"). Then a **Log in to get content** button.

Gated on `status = 'published' AND isPubliclyListed = true` — and *nothing else*. Audience
targeting is irrelevant here: this page is a shop window for the programs, not a view of anyone's
entitlements. It carries no company names because company names have no business on a marketing
page, not because of any inference risk.

### 2. The content delivery surface — members

Behind login. A verified member sees published releases their company is entitled to, with full
`summary`/`body`, asset titles, download buttons, and video embeds.

"Open to anyone who wants to attend" in the ASCOE doc means anyone in the **AppSec program**, not
anyone on the internet — so the broad default here is *all member companies*, which is still a
login-gated audience.

**Admin** sees everything including drafts. Deletes stay admin-only, matching `682998f`.

One helper in `backend/services/programContent.js` builds the member `where` clause for both
programs. **The download route re-derives entitlement from the asset's parent release** rather
than trusting the asset id — otherwise a guessed or shared asset id bypasses company scoping.

> **Correction.** An earlier draft of this plan coupled the two surfaces, claiming a publicly
> listed release couldn't also be company-restricted. That was wrong, and it would have broken the
> actual use case: a Champions package targeted at enrolled companies still needs to be advertised
> on the catalog page. The two flags are independent.

## API

```
# public, no auth
GET    /api/program-content/public                      # marketing catalog: title, blurb, asset counts

# requireAuth + requireVerified
GET    /api/program-content/ascoe                       # visible sessions
GET    /api/program-content/ascoe/:slug                 # detail + assets
GET    /api/program-content/champions
GET    /api/program-content/champions/:slug
GET    /api/program-content/assets/:id/download         # streams file, logs, re-checks visibility

# requireAdmin
GET    /api/program-content/admin/ascoe
POST   /api/program-content/admin/ascoe
PUT    /api/program-content/admin/ascoe/:id
DELETE /api/program-content/admin/ascoe/:id
        ...same five for /admin/champions
POST   /api/program-content/admin/assets                # multipart, one file
PUT    /api/program-content/admin/assets/:id
DELETE /api/program-content/admin/assets/:id
PUT    /api/program-content/admin/assets/reorder
```

Mounted as `app.use('/api/program-content', programContentRoutes)` in `server.js`.

**Two fields, two jobs.** `status` is mutable state answering "is this visible right now."
`publishedAt` is history answering "when did this first go out" — a fact, and facts don't stop
being true when a state changes. So it's set on first publish and never cleared, and the member
query filters on `status: 'published'` alone, with no redundant `publishedAt: { not: null }` clause.
One field per question means there's nothing to keep in sync.

## Retiring content

Nothing expires automatically. Three levers, in increasing severity — the first is the one to
reach for:

**Unpublish** (`status` → `draft`). Drops out of both member and public views immediately, keeps
every row and file, fully reversible, preserves `publishedAt` and the download history. This *is*
the archive mechanism; there's no separate `archivedAt` flag, because unpublish already means
exactly "retired but kept."

**Un-list** (`isPubliclyListed` → `false`). Comes off the marketing catalog, stays available to
members. For when a session is still useful internally but no longer something to advertise.

**Delete.** Admin-only, per `682998f`, and genuinely destructive: `onDelete: Cascade` takes the
assets *and* their `ContentAssetDownload` rows, so you lose the record of who picked that content
up. Reserve it for mistakes and test data, not for retiring real content.

> **Implementation note.** Cascade deletes remove DB rows but **not** uploaded files from disk.
> Deleting an asset or a release must explicitly unlink its files, or the `backend_storage` volume
> accumulates orphans nothing references. The delete handler does the file cleanup first, then the
> row, and tolerates an already-missing file.

The confirm step uses the app's `Modal`, never `window.confirm`, and names what's about to go —
including the download-record loss, since that's the part that isn't obvious.

## File storage

Uploads land at `backend/storage/program-content/<program>/<releaseId>/<cuid>.<ext>`, inside the
existing `backend_storage` Docker volume, so persistence is already handled.

**This requires narrowing an existing public mount.** [server.js:117](backend/server.js:117) is:

```js
app.use('/storage', express.static(path.resolve(__dirname, 'storage')));
```

That serves the *entire* storage tree with no auth. Dropping program content under it would make
every uploaded deck world-readable to anyone who can reach the host. Since domain snapshots are
the only current consumer and they're all addressed as `/storage/domain-snapshots/...`
([domainSnapshot.js:124](backend/services/domainSnapshot.js:124)), the mount can be narrowed to
exactly that subtree with **no URL changes and no frontend changes**:

```js
app.use('/storage/domain-snapshots', express.static(path.resolve(__dirname, 'storage', 'domain-snapshots')));
```

Program content is then served *only* through the authenticated download route.

### Upload hardening

There's no upload code in the repo today, so this is all new surface. `multer` gets added to
`backend/package.json` with:

- `limits: { fileSize: 50MB, files: 1 }`
- extension **and** MIME allowlist: pdf, pptx/ppt, docx/doc, xlsx/csv, png/jpg/gif, zip, md, txt
- explicit reject on `.html` / `.htm` / `.svg` — these become stored XSS if ever served inline
- on-disk names generated server-side; the client filename is stored in the DB for
  `Content-Disposition` only, sanitized and quoted on the way out
- path-traversal guard: resolve the absolute path and assert the storage-root prefix, reusing the
  pattern already in `storagePathToAbsolute`
- download response sets `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`
- admin-only on every write path

## Inline video — yes, with one catch

You asked whether recordings could be inlined rather than just linked. They can. There's **no CSP
anywhere** in the stack right now (no `helmet`, nothing in the Caddyfile or nginx.conf), so an
`<iframe>` won't be blocked. If a CSP is added later it needs a `frame-src` entry for the tenant.

The catch is which URL gets pasted in. A normal SharePoint *share* link refuses to frame; only the
**Embed** URL (`.../Embed.aspx?UniqueId=...`, from SharePoint's own "Embed" menu) is meant to be
iframed. So:

- `embedUrl` is a separate column from `externalUrl`, with a **host allowlist** validated
  server-side — it goes straight into an `iframe src`, which makes it the single most
  attacker-useful field in the feature if left open.
- the admin form's helper text says *"paste the Embed code URL, not the Share link"*, and rejects
  a non-embed SharePoint URL with a message explaining the difference.
- the player falls back to a plain "Watch in SharePoint" link when `embedUrl` is absent.

Viewers still need their own SharePoint access — the iframe authenticates as them. Anonymous
visitors and non-tenant users see a sign-in frame, which is the correct outcome: the recording
stays gated by SharePoint, and Orbit never proxies the video bytes.

## Frontend

| File | Route | Purpose |
|---|---|---|
| `pages/ProgramContent.jsx` | `/program-content` | Hub. Two program cards. **Upcoming** gets top billing — next ASCOE session with its agenda, this month's package — with past releases below. Logged out: the marketing catalog plus a *Log in to get content* CTA. Signed in: the member list, linking through to assets. |
| `pages/AscoeSessionDetail.jsx` | `/program-content/ascoe/:slug` | Date, location, recap, sectioned asset list. Leads with the agenda before `sessionDate`, with the recording after. |
| `pages/ChampionsPackageDetail.jsx` | `/program-content/champions/:slug` | Theme, facilitator notes, sectioned asset list |
| `components/program-content/AssetSection.jsx` | — | One `section` heading plus its assets; renders nothing when empty |
| `components/program-content/AssetList.jsx` | — | Per-asset card: kind badge, description, *Download* and/or *Open in SharePoint* |
| `components/program-content/VideoEmbed.jsx` | — | Iframe for `embedUrl`, link fallback |
| `pages/ProgramContentAdmin.jsx` | `/settings/program-content` | Authoring, modeled on `ProductUpdatesAdmin.jsx` |

Nav: a **Program Content** link in `Layout.jsx` beside Documentation (visible logged-out, since the
hub has a public mode), plus a *Program content* item in the admin dropdown. Modals use the app's
`Modal` component, never `window.confirm`.

Prose fields use `renderProse` in `frontend/src/utils/prose.jsx` — the `renderBody` approach from
`WhatsNew.jsx` lifted into a shared helper (see **Text rendering** above). No new rendering
dependency. `WhatsNew.jsx` still has its own copy; converting it was left out to keep this change
off an unrelated feature.

## Phasing

**Phase 1 — model, authoring, and delivery. DONE.** Schema + migration, the visibility helper,
member and admin APIs, admin authoring UI, member browse with sectioned asset lists and the
upcoming-vs-past split. Assets are `externalUrl`/`embedUrl` only. The `/storage` mount is narrowed.
A curated, access-scoped, agenda-capable index of everything already in SharePoint.

**Phase 3 — the public front door. DONE, pulled forward.** The public catalog endpoint and the
logged-out hub mode with its *Log in to get content* CTA, plus the rewritten "Getting content"
section in both program docs. Pulled into Phase 1 because the hub needed a logged-out state
regardless, which made the catalog endpoint nearly free — and leaving the docs pointing at a
"portal being built" while the portal existed would have been the odd outcome.

**Phase 2 — uploads and gated downloads. NOT STARTED.** `multer` + hardening, the streaming
download route, `ContentAssetDownload` writes, admin upload UI, and file cleanup on delete. The
schema columns and the download table already exist, so this needs no migration. Inline video
already works via `embedUrl`; what's missing is Orbit hosting a copy of anything.

**Phase 4 — polish.** `ChangeHistory` integration for the new entity types, announce-on-publish
(What's New entry or email to member companies), search/tag filtering across releases.

Migrations use `prisma migrate deploy` — `migrate dev` fails against the shadow DB in this project.
The Phase 1 migration SQL is hand-written at
`backend/prisma/migrations/20260914120000_add_program_content/`.

## Decisions

Settled, so the reasoning survives into review:

| Question | Decision |
|---|---|
| Separate models per program? | **Yes** — `AscoeSession` + `ChampionsPackage`, sharing one `ContentAsset` table |
| File hosting | **Both** — upload into Orbit *and* a SharePoint link on the same asset; recordings stay in SharePoint, embedded inline |
| Audience | Per-release company list, plus `audienceScope = 'all'` so **a newly onboarded company automatically gets the back catalog** |
| Public surface | A marketing catalog (title, blurb, asset counts) with a *Log in to get content* CTA; assets always gated |
| Facilitator content | **Grouped, not hidden** — no champion-lead role needed |
| Expiry | **Nothing automatic.** Unpublish is the archive gesture; delete is for mistakes. See [Retiring content](#retiring-content) |
| Authoring | **Admins only** |

Two consequences worth noting, since they simplify the build: no new user role anywhere, and
therefore no `audience` column on assets and no permission work beyond the existing
`requireAuth` / `requireVerified` / `requireAdmin` middleware.

## Ready to build

Nothing is blocking Phase 1. The only thing I'd still want your eye on is the
[shared `ContentAsset` table](#contentasset--one-table-two-nullable-parent-fks) — it's the one
place I deviated from "separate models per program," and it's easier to split now than after
there's data in it.
