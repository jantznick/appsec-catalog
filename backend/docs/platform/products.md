# Products

## What a Product is

A **Product** groups one or more [Applications](/docs/applications) into the system a team actually ships to users — things like "Customer Portal" or "Mobile Banking Platform," typically made up of a frontend, one or more backend APIs, a data store, and background workers.

Use a Product to see how those applications compose into one system, document how they connect, and get a single rolled-up security posture instead of averaging application scores yourself. An application can belong to more than one product.

## Creating a product

Create a product with a name and a handful of classification fields — company, owner, facing, status, criticality, and so on.

<details>
<summary>Fields</summary>

| Field | Notes |
|---|---|
| **Company** (required) | The company the product belongs to. If you're not an admin, this is set to your own company automatically. |
| **Name** (required) | |
| **Description** | |
| **Owner** | Who's accountable for the product. |
| **Facing** | Internal, External, or Both. |
| **Status** | Active, Planned, or Retired. |
| **Lifecycle Stage** | A free-text stage such as Build, Launch, or Operate. |
| **Business Criticality** | A 1–5 rating. |
| **Data Sensitivity** | e.g. Public, Internal, Confidential. |
| **Compliance Notes** | Free-text notes. |

</details>

The products list can be searched by name, description, or company, and (for admins) filtered by company.

## Mapping applications into a product

A product is only useful once applications are mapped into it. Each mapping can be tagged with a **component type** — the application's role in the system, such as Frontend, Backend API, Gateway, Worker, or Data Store. Component types are defined per company, or you can enter a custom label.

Only applications belonging to the product's company can be mapped in, and each one only once per product — though the same application can be reused across multiple products.

## Ingress points and data flows

Once a product has two or more applications mapped in, you can describe how they fit together architecturally: **ingress points** mark where external traffic enters the product, and **data flows** describe how data moves between the applications behind that entry point.

Together, they document the product's attack surface — the same information a threat model needs — in one place instead of scattered across each application's own notes.

<details>
<summary>What you can record</summary>

- **Ingress points** mark which mapped application is where external traffic enters the product — for example, the public frontend or an API gateway. Marking an application as an ingress point can optionally record:
  - A **channel** (a label for the entry path)
  - Whether that entry point **requires an API key**
- **Data flows** are the connections between two mapped applications — an edge from a **source** application to a **target** application. Each flow can record:
  - A name
  - The **protocol** used
  - The **data classification** of what's carried (e.g. Public, Internal, Confidential)
  - The **direction** (unidirectional or bidirectional)
  - Whether it **requires an API key**
  - Free-text notes

A data flow can be added alongside a new application mapping, or independently at any time.

</details>

## Product scoring

Each product shows a **Product Security Score** and an **Average policy compliance** figure, both rolled up from the applications currently mapped into it — so adding, removing, or improving an application moves the product's numbers the next time they're calculated. No score is shown until applications are mapped in.
