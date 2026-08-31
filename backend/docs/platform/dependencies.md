# Dependencies

Orbit builds a software bill of materials (SBOM) across every application — yours, or your company's if you're a non-admin — that has a linked source-control repository, with no manual entry required. Link a repo on an application's [Integrations tab](/docs/application-data#integrations) and its dependencies show up here automatically.

This is the fastest way to answer "which of our applications actually uses this vulnerable package" across the whole portfolio, rather than checking application by application.

## What you'll see

A searchable, filterable view of every dependency across the portfolio — package, version, ecosystem, and the application it came from — with summary tiles for total dependencies, unique packages, applications represented, and detected frameworks.

<details>
<summary>Table columns and controls</summary>

- Summary tiles: total dependency rows, unique packages, applications represented, detected frameworks
- A table of each dependency's package name, version (or range), ecosystem, the application/repo it came from, and — for admins — the company
- Search by package, application, or repo name
- Filter by ecosystem or company, or restrict to frameworks only
- Sort and page through results

</details>

## Where the data comes from

Dependencies are parsed from each repo's manifest files, then checked where possible against [OSV.dev](https://osv.dev) for known advisories. This check is **informational only**; treat Wiz as the authoritative source for actual vulnerability findings.

<details>
<summary>Manifest files scanned</summary>

`package.json` · `requirements.txt` · `pyproject.toml` · `go.mod` · `pom.xml` · `build.gradle` · `composer.json` · `Gemfile`

</details>
