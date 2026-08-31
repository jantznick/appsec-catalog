# SAMM & Maturity

## What OWASP SAMM is

**OWASP SAMM** (Software Assurance Maturity Model) is an open, vendor-neutral maturity model for application security, published by OWASP. It measures how mature an organization's security *practices* are — not how secure the code is — things like threat modeling, up-front security requirements, and defect tracking.

The program uses SAMM because it's a shared, independent yardstick: every Hearst company is scored against the same practices, so maturity is comparable across companies rather than a subjective call. It also shows each company where it's strong, where the gaps are, and what to work on next.

## The five business functions

SAMM organizes application security into **five business functions**, each with **three practices** (15 total).

| Function | Practice | What it covers |
|---|---|---|
| **Governance** — how security is directed, measured, and supported | Strategy & Metrics | A security strategy with goals and metrics |
| | Policy & Compliance | Documented policies/standards; tracked compliance and exceptions |
| | Education & Guidance | Security training and a champions network |
| **Design** — how security is considered during design and architecture | Threat Assessment | Threat modeling before/during build |
| | Security Requirements | Requirements defined by risk and use case, not implicit |
| | Security Architecture | Reusable secure architecture patterns, reviewed |
| **Implementation** — how security is built, deployed, and defects are managed | Secure Build | Secure build process and dependency management |
| | Secure Deployment | Hardened deployments; consistent config and secrets |
| | Defect Management | Security defects tracked, prioritized, remediated |
| **Verification** — how software security is assessed and tested | Architecture Assessment | Architecture reviewed against its requirements |
| | Requirements-driven Testing | Testing verifies the defined requirements |
| | Security Testing | Active testing — SAST, DAST, pen testing |
| **Operations** — how security is managed in production and over the application lifecycle | Incident Management | Detect, respond to, and learn from incidents |
| | Environment Management | Infrastructure kept secure — patching, config drift |
| | Operational Management | Lifecycle management — inventory, EOL, data handling |

## What maturity levels 0-3 mean

Each practice is scored **0-3**. Levels describe increasing rigor and consistency, not a pass/fail line:

| Level | What it means in practice |
|---|---|
| **0** | Not performed, or not on the org's radar |
| **1** | Ad hoc — happens, but inconsistently |
| **2** | Structured — defined process, followed org-wide |
| **3** | Optimized — institutionalized, measured, improved |

Going 0→1 is about starting; 2→3 is about proving consistency — which is why higher levels take longer.

## Using the coverage checklist to plan improvement

SAMM drives an ongoing improvement cycle, not a one-time score:

1. **Baseline.** Score each of the 15 practices at its current level, from real evidence — not intention.
2. **Target.** Set a target level per practice based on the system's risk, not one blanket target for everything.
3. **Prioritize gaps.** Close the highest-impact gaps first, each with a clear owner and a way to tell it's done.
4. **Revisit quarterly.** Re-score, check progress, adjust priorities.

The goal is real risk reduction, not a higher number.

---

See [Policies & Compliance](/docs/policies-and-samm) for how to complete a SAMM self-assessment in Orbit.
