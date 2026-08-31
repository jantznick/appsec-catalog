# Scoring Methodology

The security score is out of 100 points, split between two components: **Knowledge Sharing** (how complete and current an application's metadata is) and **Tool Usage** (how well it's covered by security tooling).

Each component starts at 50 points, but the split shifts with the application's importance — more critical, external-facing, high-risk applications lean harder on Tool Usage; lower-stakes ones lean on Knowledge Sharing. Importance is derived from business criticality, deployment frequency, number of interfaces, external/internal facing, and sensitive data types; anything left blank is assumed to be the higher-importance answer, so leaving fields empty never buys an easier weighting.

| Importance | Knowledge Sharing | Tool Usage |
|---|---|---|
| Low | 60 pts | 40 pts |
| Medium | 50 pts | 50 pts |
| High (default when data is missing) | 40 pts | 60 pts |

<details>
<summary>Knowledge Sharing breakdown</summary>

Out of 50 raw points, before importance weighting is applied:

**Metadata completeness — 40 points**

Based on 8 fields: Description, Development Team Contact, Repository URL, Language, Framework, Server Environment, Authentication Profiles, and Data Types. Points scale with how many are filled in. A field explicitly set to "NA" is dropped from the denominator entirely rather than counted as missing.

**Review freshness — 10 points**

Full credit the day metadata is reviewed by the AppSec team, decreasing on a straight line to zero at 6 months since the last review. Never reviewed means zero points here.

</details>

<details>
<summary>Tool Usage breakdown</summary>

Out of 50 raw points, before importance weighting is applied, split evenly across five categories: SAST, DAST, SCA, Application Firewall, and API Security (10 points each). A category marked Not Applicable is dropped from scoring, and its points are redistributed across the categories that do apply. SCA is scored separately unless SAST is marked as already covering it, in which case SCA mirrors SAST's tool, integration level, and scan date.

Each category's 10-point ceiling is scaled up for risk before it's earned — external-facing applications get a 1.5x multiplier, and handling PII, PCI, or PHI data adds 1.2x, 1.5x, or 1.3x respectively (the highest applicable multiplier wins). Missing facing or data-type information defaults to the highest-risk assumption, so it can't be used to lower the bar. That scaled ceiling is then earned by multiplying:

- **Integration level** (0–4): none, tool implemented with no data shared, data shared via API, dashboard/config access shared, or full-service partner — worth 0%, 25%, 50%, 75%, and 100% of the ceiling respectively.
- **Tool quality**: fully managed tools (e.g. Snyk, Tenable WAS, Fastly NGWAF) earn full credit, approved-but-unmanaged tools (e.g. Dependabot, GitHub Advanced Security) earn slightly less, and anything else defaults to 80%.
- **Scan freshness** (SAST/DAST/SCA only): full credit if the last scan falls within a day of the most recent deployment either way; credit tapers off the further the scan drifts from that window, and a missing scan date drops to 30%.

API Security doesn't use integration level or scan freshness — it's full credit once an API schema is on file, otherwise zero.

</details>

Scores show up on each application's record. **[Read more about Applications →](/docs/applications)**
