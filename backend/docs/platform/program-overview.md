# Program Overview

## Why this exists

Application security shouldn't depend on which team you're on or which tools someone installed last year. The AppSec Program is a shared way of operating — the same lifecycle, checkpoints, and definition of "done," applied consistently across every Hearst company. It's a program, not a product: the goal is consistent practice, not a specific scanner or vendor.

The AppSec Program is run by Hearst's AppSec team, part of the broader **Exposure Management** team — which also covers vulnerability management, penetration testing, data security, and domain security monitoring. Signing up for Exposure Management is what gives a Hearst company access to Orbit and everything in it.

## The lifecycle

Security work runs continuously across the software development lifecycle, broken into **six phases** that connect end to end — the last one feeding improvements back into the other five.

| # | Phase | What happens here |
|---|-------|--------------------|
| 1 | **Plan & Design** | Requirements, threat modeling, and architecture review happen before anything is built. |
| 2 | **Build & Commit** | Developers write code with fast, in-workflow feedback — secure coding practices plus early checks on pull requests. |
| 3 | **CI Gate** | Automated scans run in the pipeline, with clear severity thresholds and documented exceptions before code merges or ships. |
| 4 | **Release & Deploy** | Artifacts, images, and infrastructure are validated before release, with a clear sign-off step. |
| 5 | **Runtime & Operate** | Running applications are monitored for exposure, rescanned on a schedule, and covered by incident response. |
| 6 | **Improve & Govern** | Metrics, tuning, training, and periodic review close the loop — and feed changes back into the other five phases. |

Phases 1–5 follow the order code moves through delivery; phase 6 runs on its own cadence and feeds what's learned back into all five. Each phase will get its own in-depth page over time.

## SAMM & Maturity

The six phases describe **how** teams operate day to day. [OWASP SAMM](https://owaspsamm.org/) layers on top of that, describing **maturity** — how consistently those practices actually happen at scale. The program uses SAMM rather than inventing its own model, since it's a widely-adopted, vendor-neutral framework built specifically for application security.

See [SAMM & Maturity](/docs/program-samm) for how the model works and how it's assessed.

## Orbit's role

Orbit is the platform Hearst companies use to track and evidence progress through this program.
