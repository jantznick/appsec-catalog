# Information Security Policy

The Application Security and Software Development Lifecycle sections of the HTS Information Security Policy, as written — and for each requirement, exactly what Orbit does to check it.

This page is the requirements themselves. For what meeting them looks like day to day — risk tiers, what each one means in practice, and the exception process — see [Meeting the Policy](/docs/program-policy-baseline). For the work that produces the evidence, see [The Lifecycle](/docs/program-lifecycle).

## How to read the verification column

| | What it means |
|---|---|
| **Measured** | Orbit checks this automatically, from your catalog record or read from your source-control provider |
| **Measured (proxy)** | Checked automatically, but the check is a weaker signal than the requirement — noted per row, because a pass here means less than a pass elsewhere |
| **Verification required** | The automated checks cover part of the requirement. They pass, and a person confirms the rest — it counts as neither meeting nor not meeting until they do |
| **Attested** | No field could prove it. The application owner asserts it, records what backs the claim, and re-attests before it expires |
| **In Wiz** | Deliberately outside Orbit — Wiz is the system of record for vulnerability findings |
| **Not yet** | No check today, and the reason why |

Three behaviours to know before reading your own results:

- **A control with nothing mapped to it reads as not meeting**, rather than as unknown or skipped. You can tell these apart: the evidence line reads `No field mappings defined for this control`. A low compliance figure with a lot of those means Orbit can't check those requirements yet — not that you're failing them.
- **Verification required is not compliance.** It's excluded from the compliance percentage, which stays *meeting ÷ total*, so a requirement sitting in verification never inflates your figure. An administrator's override is what promotes it to meeting, which is where the human judgement gets recorded rather than applied silently.
- **There's no *not applicable* state yet**, so a requirement scoped to something that doesn't describe your application still counts against you.

## Application Security (4.6)

| # | Requirement | How Orbit verifies it |
|---|---|---|
| **4.6.1** | Software development shall be managed using software/application development or system development lifecycle processes (SDLC). | **Measured (proxy)** — a linked repository. A repository is not evidence of a process; treat a pass here as weak. |
| **4.6.2** | There shall be processes and solutions to ensure continuous security testing of source code and secure practices prior to releasing code into production. | **Measured** — a static analysis tool recorded, at integration level 1 or above. |
| **4.6.3** | Segregation of Duties Principle shall be employed to ensure secure deployment of code into production. | **Measured** — your repository's branch protection, read from your provider: required approving reviews, stale-review dismissal, whether administrators are exempt. Covers the code-review half. The deploy half — that production is reachable only through the pipeline — is **attested** until Orbit models environments. |
| **4.6.4** | Development, test, and production operational environments shall be separated via logical and/or physical methods, to reduce the risk of unauthorized access (for example: web application firewalls) or changes to the application and its components. | **Attested**, for now. Orbit records a single primary environment per application and doesn't model the separation between them. This becomes measured once environments are modelled — that work sits outside the policy-control programme, so it's the one requirement whose verification depends on something on a different track. |
| **4.6.5** | Best practices shall be adopted to effectively manage software composition to ensure secure use of open-source components and software. | **Measured** — an SCA tool recorded, or static analysis recorded as covering dependency scanning. |
| **4.6.6** | Application metadata shall be maintained throughout the application's lifecycle, storing the five records below. | **Verification required** — the five are checked unevenly, so this reports as needing confirmation rather than as a pass. |
| 4.6.6 a | Architecture documentation for the software/application, kept complete and up-to-date. | **Verification required** — Orbit can see that your threat model, product data flows and API schema exist. Whether they are complete and current is a judgement someone makes at review. |
| 4.6.6 b | The application's assigned risk level (low, medium, high), reviewed at least every six (6) months or upon business need. | **Measured** — business criticality recorded, and the record reviewed inside six months. |
| 4.6.6 c | Software Bill of Materials (SBOM) records, generated for every production release. | **Not yet** — the dependency inventory is rebuilt from your manifests on every repository sync and keeps no history, so it describes your repository now rather than what shipped in a given build. Needs dependencies snapshotted against a deployment. |
| 4.6.6 d | Release artifacts, attached to their corresponding security scan evidence in the release record. | **Not yet** — scan dates sit on the application rather than on a build, so nothing ties evidence to the version that shipped. |
| 4.6.6 e | Approved policy exceptions, documented with at minimum the business justification, compensating controls, owner, and expiration date, and approved or remediated before the application's next release. | **Not yet** — exceptions are filed with Hearst's AppSec team. Orbit's administrator-set control override is a different object and carries no expiry. See [Exceptions](/docs/lifecycle-exceptions). |
| **4.6.7** | All "pull requests" shall include a security-impact review checklist and document the findings/responses. | **Measured**, then **verification required** — the pull-request template is read from your repository. Its presence proves the checklist exists, not that anyone completes it, so the second half is confirmed by a person. |
| **4.6.8** | DAST and/or SAST shall be performed for all application testing and shall be included for all "pull requests" and default branches. | **Measured** — a static or dynamic analysis tool recorded at integration level 1 or above. That the scans run on pull requests *and* the default branch is not yet confirmable; Orbit records coverage, not where the job is wired. |
| **4.6.9** | Secrets scan shall be employed for "pull requests". | **Measured** — tool, integration level and last scan date. For GitHub-linked repositories, secret scanning and push protection are read through the API rather than self-reported. |
| **4.6.10** | Internet-facing applications shall have scheduled security re-scans. | **Measured** — for internet-facing applications, the last scan date against the cadence your risk tier requires, so an overdue scan is flagged rather than merely dated. |
| **4.6.11** | Threat modeling to find and address security risks on internet facing and "high risk" application features shall be performed. | **Measured** — whether a threat model exists, its status, and when it was last reviewed. |
| **4.6.12** | Application Development teams shall follow secure coding guidelines as detailed in the best practice coding frameworks such as NIST or the OWASP Foundation. | **Attested** — backed by your own guidelines, emailed to **VTM@hearst.com**, and by training completion records. See [Secure Coding Standard](/docs/lifecycle-secure-coding). |
| **4.6.13** | An SCA tool shall be used to scan third-party open-source libraries to uncover known vulnerabilities and license risks prior to release into production. | **Measured** — an SCA tool recorded, covering vulnerabilities **and** licence risk. Licence checking often ships disabled, so confirm it's switched on. |
| **4.6.14** | IaC / Container shall be scanned prior to deploying as a workload. | **Measured**, then **verification required** — the tool and integration level are recorded. That the scan *passed before that particular workload deployed* needs the scan tied to a deployment, which Orbit can't do yet, so coverage alone doesn't satisfy this. |
| **4.6.15** | Any security finding found shall be reviewed to determine the plan of action and tracked to closure to resolve SLA. | **In Wiz** — findings and their remediation status live there by design; Orbit confirms the checks producing them are configured and running. Fix-by intervals by severity and tier are being defined. See [Remediating Findings](/docs/lifecycle-remediation). |

## Software Development Lifecycle (6.43)

| # | Requirement | How Orbit verifies it |
|---|---|---|
| **6.43.1** | All software implementations shall follow the SDLC process and shall address the three requirements below. | **Measured (proxy)** — a linked repository. As with 4.6.1, a weak signal. |
| 6.43.1 a | Secure coding techniques shall be employed for all software development. | **Attested** — see [Secure Coding Standard](/docs/lifecycle-secure-coding). |
| 6.43.1 b | Validation checks shall be incorporated into applications to detect any corruption of information through processing errors or deliberate acts. | **Attested** — input validation is partly caught by static analysis; integrity checking against processing errors is not externally observable. |
| 6.43.1 c | Test data shall be selected carefully, protected, and controlled. | **Attested**. |
| **6.43.2** | Applications shall be developed using secure coding guidelines. | **Attested** — as 4.6.12. |
| **6.43.3** | Passwords shall not be hard coded into the application. | **Measured** — secrets detection is the control that finds violations; tool, integration level and last scan date. |
| **6.43.4** | Automated code review tools shall be used to identify common vulnerabilities. | **Measured** — a static analysis tool recorded at integration level 1 or above. |
| **6.43.5** | Live production data that has Confidential information shall not be used for development testing. | **Attested**. |
| **6.43.6** | Vendor supplied default accounts, custom application accounts, user IDs, and passwords shall be removed before applications go live into production. | **Attested**. |
| **6.43.7** | Web application security controls shall be based on best practices and employed as detailed in the OWASP Top 10. | **Measured (proxy)** — a dynamic analysis tool recorded. A DAST tool is not evidence of Top 10 adherence; the substantive check is the attestation under 4.6.12, and a pass here should be read as "testing exists", nothing more. |
| **6.43.8** | Applications and IT systems shall not be coded to have back doors that circumvent the authorized access control mechanisms. | **Attested** — no field can demonstrate the absence of something. |
| **6.43.9** | Applications shall not store or send passwords in clear text or in any easily reversible form. | **Attested** — using a hosted identity provider, so you store no passwords at all, is the strongest thing to attest to. |
| **6.43.10** | Utilities, compilers, assemblers, or other utilities that create object code shall not be installed in production environments. | **Attested** — a multi-stage container build is the practical evidence. |
| **6.43.11** | Review and comply with vulnerability management requirements. | **In Wiz** — as 4.6.15. |
| **6.43.12** | Review custom code prior to release to production or end users to identify any potential coding vulnerability. | **Measured** — branch protection read from your provider, same signal as 4.6.3. The two requirements sit in different policy sections but are satisfied by the same evidence. |
| **6.43.13** | Where and when possible, encryption shall be used to store or to transmit Confidential information on all applications. | **Split.** In transit: **measured** — HTTPS enforcement, certificate validity and HSTS, observed from Orbit's domain monitoring for internet-facing applications. At rest: **attested**, since it isn't externally observable. |

## What this adds up to

Across the 28 requirements:

| | Count | |
|---|---|---|
| **Measured outright** | 18 | Tool coverage, branch protection, threat model currency, scan recency, transport encryption, secrets detection |
| **Measured, but only partly** | 2–3 | Reported as *verification required* rather than as a pass: **4.6.6** (two of five metadata records checked), **4.6.14** (coverage recorded, not that the scan passed for the deployed workload), and arguably **4.6.7** (the template exists; completing it isn't checked) |
| **Attested** | 8 | 4.6.12, 6.43.2, 6.43.5, 6.43.6, 6.43.8, 6.43.9, 6.43.10, and the at-rest half of 6.43.13 |

Attested isn't a weaker requirement, it's a differently evidenced one — these are properties of your code rather than activities, and no catalog field could demonstrate the absence of a back door. That's why attested compliance is reported separately from measured rather than blended into one number.

Three things stay unmeasured inside **4.6.6**, and they all need the same missing capability — something tying an artifact to a specific build or release: an SBOM per release, scan evidence per release, and exception records carrying an expiry.

And two **proxies** are flagged as such in the tables above rather than quietly counted as full coverage: 4.6.1 / 6.43.1 check that a repository is linked, and 6.43.7 checks that a dynamic testing tool exists. Both will pass or fail honestly, but neither is really measuring its requirement. Branch protection is much better evidence for the first two and they're expected to be re-mapped to it.

---

**Related:** [Meeting the Policy](/docs/program-policy-baseline) · [The Lifecycle](/docs/program-lifecycle) · [Secure Coding Standard](/docs/lifecycle-secure-coding) · [Policies & Compliance](/docs/policies-and-samm)
