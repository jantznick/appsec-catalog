# Secure Coding Standard

Properties your application has to hold at all times, rather than work you do at a particular point.

## Why this is separate from the phases

The [six phases](/docs/program-lifecycle) describe activities — threat model here, scan there, sign off before release. Most of the policy maps onto them cleanly.

Some of it doesn't, because it isn't an activity. *"Applications shall not be coded to have back doors"* isn't something you do in phase 2 and finish; it's true of your code or it isn't, continuously. Same for not shipping a compiler to production, not storing passwords reversibly, and validating data integrity.

So those live here. Nothing on this page is scheduled — it's the standard your code is held to whichever phase you're in, and the reference the [pull request checklist](/docs/phase-build-commit) and [static analysis](/docs/phase-ci-gate) are checking against.

## The reference frameworks

Secure coding guidance comes from two published sources rather than being invented here:

| | Use it for |
|---|---|
| **[OWASP Top 10](https://owasp.org/www-project-top-ten/)** | The basis for web application security controls. If you read one thing, read this |
| **[NIST SSDF](https://csrc.nist.gov/projects/ssdf)** (SP 800-218) | Secure software development practices across the lifecycle |

Where your language or framework publishes its own secure coding guidance — the Django security docs, the Spring Security reference, the Rails security guide — follow that too. It'll be more specific than anything general-purpose, and more likely to be right about your actual stack.

## The standard

### Access control

- **No back doors.** No mechanism that bypasses the authorization model — no hardcoded override account, no debug header that skips the auth check, no "if username == admin" shortcut, no support endpoint that trusts a shared secret. If an emergency access path is genuinely needed, it goes through the normal identity provider with elevated permissions, time-bound and logged.
- **Authorization decisions happen on the server**, on every request, and default to deny for anything new.
- **Ownership is checked, not assumed.** Being authenticated is not being authorized — see [Logins & Other People's Data](/docs/secure-build-data) for the version of this written for non-specialists.

### Credentials and secrets

- **No password, key, token or connection string in source code**, in configuration committed to the repository, or in front-end code the browser downloads. Enforced by [secrets detection](/docs/phase-ci-gate) in CI, and by a pre-commit hook locally.
- **No password stored or transmitted in clear text, or in any reversible form.** Where you can avoid handling passwords at all — by using a hosted identity provider — do that instead; it's the only approach that removes the risk rather than managing it.
- **Where passwords must be stored**, use a current password-hashing function with a per-password salt. Never encryption, which is reversible by definition, and never a plain hash.

### Data integrity and validation

- **Validate input on the server**, even where the browser already validated it. Allow-lists rather than block-lists.
- **Use parameterized queries.** Never assemble a query by joining strings.
- **Encode output for its destination** — HTML, attribute, JavaScript, URL, SQL are all different contexts.
- **Detect corrupted data, not just malicious data.** The policy asks for validation that catches corruption *"through processing errors or deliberate acts"*, and those need different controls. Deliberate acts are covered by the input validation above; processing errors need integrity checks — see below.

<details>
<summary>What integrity checking looks like in practice</summary>

Input validation catches bad data arriving. Integrity checking catches good data going wrong afterwards — a partial write, a failed batch job, a truncated transfer, a race condition, a bug in a migration.

Proportionate measures, roughly in order of how often they're worth it:

- **Database constraints.** Foreign keys, `NOT NULL`, `CHECK`, and uniqueness constraints are integrity validation, and they're the cheapest form of it. An application that enforces these only in code will eventually write a row that violates them.
- **Transactions around multi-step changes**, so a failure halfway leaves no partial state.
- **Reconciliation for anything that must balance** — totals against line items, a ledger against its entries, a count against what it counts. Run it on a schedule and alert when it disagrees.
- **Checksums or hashes for data in transit or at rest** where corruption would be silent — file transfers, exports, backups, anything crossing a system boundary.
- **Idempotency keys** on operations that must not happen twice, so a retry doesn't double-charge or double-send.

How much of this you need scales with what going wrong would cost. A ledger needs reconciliation; a preferences table needs constraints and not much else.

</details>

### Cryptography

- **Use your platform's crypto library.** Never implement an algorithm, a construction, or a protocol yourself.
- **Encrypt Confidential data at rest and in transit** wherever it's possible to do so. HTTPS everywhere, with plain HTTP redirected.
- **Data classification drives this** — see the security requirements template in [Plan & Design](/docs/phase-plan-design).

### What ships to production

- **No compilers, assemblers, debuggers, or other object-code utilities in production images.** They're not needed to run the application, and they turn a limited foothold into a much better one. For containers, a multi-stage build gets this for free: compile in the build stage, copy only the artifact into a minimal runtime image.
- **No development or debugging endpoints**, no verbose error pages, no stack traces to users.
- **No vendor-supplied default accounts**, and no custom application accounts, user IDs or passwords created for development. Removed or disabled before the first production release.
- **No production secrets in the image.** Injected at runtime from a managed store.

### Test data

- **Never live production data containing Confidential information in development or test.** Not in a shared dev database, not in a local copy, not in a bug reproduction.
- **Test data is chosen deliberately** — synthetic, or production data that's been anonymized or masked well enough that re-identification isn't realistic. Removing the name column is not anonymization.
- **Test data is protected and controlled like the environment it lives in.** A test database full of masked customer records is still a database worth attacking, and it usually has weaker controls than production.
- **Test accounts and fixtures don't travel to production** — see above.

## How this gets verified

Most of this page can't be measured from catalog data, and that shapes how it's checked.

Some of it a scanner does catch — [static analysis](/docs/phase-ci-gate) finds injection, encoding and crypto misuse, and [secrets detection](/docs/phase-ci-gate) finds hardcoded credentials. Encryption **in transit** is externally observable, so HTTPS enforcement, certificate validity and HSTS can be confirmed from outside for anything internet-facing.

The rest — that there's no back door, that no compiler ships in your image, that test data isn't real customer data — has no field that could ever prove it. No amount of catalog metadata demonstrates the absence of something.

So these are handled by **attestation**: the application owner asserts that their application meets the standard, records what backs that up, and re-attests on a schedule so the claim doesn't silently go stale. Attested compliance is reported **separately from measured compliance**, deliberately — "how much of our compliance is self-reported?" is the first question an auditor asks, and it should have a straight answer.

Attesting isn't a formality. You're making a claim you may be asked to defend, so treat it as a real review rather than a checkbox, and use the conformance check below to do it properly.

<details>
<summary>What backs up an attestation</summary>

| Area | Evidence to have ready |
|---|---|
| **Secure coding guidelines** | Your team's own guidelines, and which published framework they follow. Email them to **VTM@hearst.com** — that's what gets this on record |
| **Developer training** | Completion records. Where your company uses **KnowBe4**, those records are the supporting signal |
| **Test data** | How your non-production data is generated or masked, and who can reach it |
| **Default accounts** | How removal is confirmed before a release — ideally a pipeline step rather than someone remembering |
| **No back doors, no dev utilities in production** | Code review practice, and your production image build — a multi-stage build is itself the evidence for the second one |
| **Encryption at rest** | Which store, which mechanism, who holds the keys |

Proof gets requested at audit rather than at attestation time. Having it ready is the difference between a short conversation and a long one.

</details>

## Using this as a checklist

Most of this should be enforced by tooling rather than memory: [static analysis](/docs/phase-ci-gate) catches injection, encoding and crypto misuse; secrets detection catches credentials; the [pull request checklist](/docs/phase-build-commit) catches the judgment calls a scanner can't make.

What tooling generally won't catch is the *absence* of something — a missing ownership check, a missing integrity check, a back door that looks like a feature. Those are what review is for.

<details>
<summary>Standard conformance check — worth running once per application, then on major change</summary>

```markdown
## Secure Coding Standard — <application name>          <YYYY-MM-DD>

### Access control
- [ ] No hardcoded override accounts, debug bypasses, or auth-skipping flags
- [ ] Authorization decided server-side on every request; new endpoints deny by default
- [ ] Ownership checked on every record access, not inferred from the ID

### Credentials
- [ ] No secrets in source, committed config, or front-end code
- [ ] No password stored or transmitted in clear text or reversibly
- [ ] Passwords (if we store any) use a current hashing function with per-password salts
- [ ] Better: we use a hosted identity provider and store none

### Integrity and validation
- [ ] Server-side validation on all input, allow-list based
- [ ] Parameterized queries throughout
- [ ] Output encoded for its context
- [ ] Database constraints enforce what the code assumes
- [ ] Multi-step changes are transactional
- [ ] Anything that must balance is reconciled on a schedule

### Cryptography
- [ ] Platform crypto libraries only — nothing hand-rolled
- [ ] Confidential data encrypted at rest and in transit
- [ ] HTTPS enforced, HTTP redirected

### Production image
- [ ] No compilers, assemblers, debuggers or build tooling
- [ ] No debug endpoints, verbose errors, or stack traces to users
- [ ] Vendor default and development accounts removed
- [ ] Secrets injected at runtime, not baked in

### Test data
- [ ] No live Confidential production data outside production
- [ ] Test data synthetic, or anonymized beyond realistic re-identification
- [ ] Non-production environments protected in line with what they hold

### Frameworks
- [ ] Controls reviewed against the OWASP Top 10
- [ ] Language/framework-specific secure coding guidance followed
```

</details>

## Where this maps

| Policy clause | Covered by |
|---|---|
| App Sec 12, SDLC 2 | The reference frameworks above |
| SDLC 7 | OWASP Top 10 as the basis for web application controls |
| SDLC 1.1 | Secure coding techniques throughout |
| SDLC 1.2 | Validation and integrity checking |
| SDLC 1.3, SDLC 5 | Test data |
| SDLC 3, SDLC 9 | Credentials and secrets |
| SDLC 6 | Vendor default and development accounts |
| SDLC 8 | No back doors |
| SDLC 10 | What ships to production |
| SDLC 13 | Cryptography |

---

**Related:** [Remediating Findings](/docs/lifecycle-remediation) · [Exceptions](/docs/lifecycle-exceptions) · [Policy Baseline](/docs/program-policy-baseline) · [The Lifecycle](/docs/program-lifecycle)
