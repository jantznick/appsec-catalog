# Domains

## What the Domains inventory is for

Domains lists every hosting domain tied to your company's applications, tracked separately from the applications themselves because the relationship isn't one-to-one — a domain can serve several applications, and an application can live at more than one domain.

It also doubles as lightweight attack-surface monitoring. Orbit periodically snapshots each domain's DNS configuration and public-facing web content, comparing every new snapshot to the last so it can flag exactly what changed — an unexpected DNS record, a site that suddenly looks different — the kind of signal that might otherwise go unnoticed until something breaks or an incident is already underway.

Each domain carries a DNS security score, an owner, a status, and the apex domain it's grouped under, and you can register new domains yourself.

## The domain detail page

Each domain has its own page: a security score summary plus a breakdown across five areas — metadata, related domains, DNS history, web snapshot history, and linked applications. This is where you dig into one domain's posture and history, not just its current state.

The score splits into two halves: how complete the domain's metadata is (owner, status, description — the things a responder needs during triage), and how solid its DNS security configuration is (SPF, DMARC, DKIM, CAA, DNSSEC). Each individual check explains what it's testing, why it matters, and how to fix it when it's failing.

<details><summary>Tab-by-tab breakdown</summary>

**Metadata** — name, owner, status, apex domain group, description, and when the record was last updated.

**Related Domains** — how this domain relates to others under the same apex domain, including whether it *is* the apex domain, plus a table of sibling domains with their applications, owner, and status.

**DNS Info** — the DNS change-tracking history: when the last check ran, the ten most recent snapshots with record counts (A, AAAA, CNAME, TXT, MX, NS, SPF, DMARC, DKIM), and — for any snapshot where something changed — a before/after comparison with a plain-language summary. This is where you'd catch an unauthorized DNS change, a takeover attempt, or a misconfiguration: an A record suddenly pointing somewhere unexpected, a repointed CNAME, an SPF/DMARC record disappearing.

**Web Snapshots** — the visual/content change-tracking history: point-in-time captures showing whether HTTPS was used, the status code and load time, the page title and final URL, and a screenshot. Useful for catching defacement, an unexpected redirect, or a site going down.

**Applications** — every application currently linked to this domain. **[Read more about Applications →](/docs/applications)**

</details>

## Who can trigger checks vs. who can just view

Any user can open a domain and review its full history at any time. Running a fresh, on-demand DNS or web snapshot check, and editing a domain's metadata, are admin-only — though any user can register a new domain in the inventory.
