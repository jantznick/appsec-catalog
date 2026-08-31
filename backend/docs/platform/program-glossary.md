# Glossary

Plain-language definitions for the security terms and practices you'll run into across the AppSec program — testing types, risk and compliance concepts, and program artifacts. For Orbit's own data-model terms (Company, Application, Product, Domain, Division, Policy/Policy Control, Score), see [Overview & Core Concepts](/docs/overview).

| Term | Definition |
| --- | --- |
| **AppSec (Application Security)** | The practices used to reduce risk in how software is designed, built, tested, released, and operated. |
| **ASVS (OWASP Application Security Verification Standard)** | A checklist of security requirements published by OWASP, used to define what "secure enough" looks like for a given type or tier of application. |
| **CI gate** | An automated check — such as static analysis, secrets scanning, dependency scanning, or dynamic testing — that must pass before code can be merged or released. |
| **Compensating control** | An alternative safeguard, like extra manual review, monitoring, or network restrictions, used to reduce risk when a primary security control has been waived or can't be applied. |
| **DAST (Dynamic Application Security Testing)** | Security testing performed against a running application from the outside, the way an attacker would probe it over HTTP or an API, to find issues that only show up at runtime. |
| **Data classification** | A label describing how sensitive the data an application handles is, such as public, internal, confidential, or regulated. |
| **Evidence** | Proof that a security control actually ran and met its pass criteria — CI job results, tickets, completed threat models — as opposed to a written policy that says it should. |
| **Exception / risk acceptance** | A time-bound, approved decision to bypass a required control or severity threshold — with a named owner, justification, compensating controls, and expiration date — that documents accepted risk without replacing the underlying fix. |
| **Golden repo** | A centrally maintained internal repository of approved security runbooks, workflows, and templates that teams copy from, instead of building their own from scratch or pulling ad hoc from public sources. |
| **High-impact change** | A change that touches authentication, authorization, sensitive data flows, trust boundaries, or public-facing exposure, and therefore triggers stronger design review and security requirements. |
| **Internet-facing** | Describes an application or API reachable from untrusted networks like the public internet, which typically drives requirements like dynamic testing and threat modeling. |
| **Layer 1 / Layer 2** | A way of separating policy from proof: Layer 1 is the normative policy itself (what must be done); Layer 2 is the evidence that shows it was actually done (artifacts, pass criteria, registry data). |
| **Metadata registry / application catalog** | The system of record that stores per-application fields like risk tier, data classification, repository URL, and CI provider, used to scope which controls apply and to correlate evidence. |
| **OWASP SAMM (Software Assurance Maturity Model)** | A framework for assessing and improving an organization's application security practices over time — used to measure maturity, rather than for day-to-day implementation. |
| **Policy and process alignment** | The mapping that ties specific policy requirements to the program's operational phases, so it's clear which process step satisfies which requirement. |
| **PR security checklist** | A short set of prompts included on pull requests that ask whether the change has security implications, for things like authentication, sensitive data, dependencies, or secrets. |
| **Production release** | A change that has been promoted to the environment actual end users use, which carries its own set of expected security evidence. |
| **Risk tier** | A criticality label — low, medium, or high — assigned to an application that determines how strict its scanning requirements, SLAs, and design-review depth need to be. |
| **SAST (Static Application Security Testing)** | Analyzing an application's source code or compiled bytecode for security issues without running it, using tools like Semgrep or Snyk Code. |
| **SBOM (Software Bill of Materials)** | A machine-readable inventory of everything in a build — libraries, packages, versions, typically in SPDX or CycloneDX format — used for supply-chain security and incident response. |
| **SCA (Software Composition Analysis)** | Scanning an application's dependencies for known vulnerabilities and license issues, using tools like Trivy or Snyk Open Source. |
| **Secrets scanning** | Detecting credentials, API keys, and tokens accidentally committed to code or its history; distinct from SAST, and a live, verified secret is typically a hard block on merging. |
| **Severity** | A normalized rating of how serious a security finding is — critical, high, medium, low, or informational — used to drive gating decisions and fix-by timelines. |
| **SSDF (NIST Secure Software Development Framework)** | A set of practices from NIST for building software securely, often referenced alongside ASVS. |
| **STRIDE** | A mnemonic used in threat modeling to prompt for six categories of threat: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, and Elevation of privilege. |
| **Threat modeling** | A structured look at an application's assets, trust boundaries, and potential threats, done before or during development — typically required for internet-facing or higher-tier applications. |
| **Trust boundary** | A point where the level of trust changes, such as a browser talking to an API or an API talking to a database — the focal points of threat modeling. |
