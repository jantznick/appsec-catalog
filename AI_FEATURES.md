# AI Features

Shared infrastructure for AI-backed features, plus the first feature built on
it: the **threat-model co-pilot**. The design goal is a single choke-point so
that no model call happens without being gated (per company) and recorded (token
usage + cost, attributed to a company / application / user / feature).

- **Backend:** Express + Prisma/Postgres. All model calls go through
  [`services/ai/runAi.js`](backend/services/ai/runAi.js).
- **Model SDKs:** [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript)
  and [`openai`](https://github.com/openai/openai-node). Both providers are
  implemented — see [Provider support](#provider-support).
- **Frontend:** an admin **AI settings** page (`/settings/ai`) and a
  "Draft with AI" action on the application threat-model tab.

---

## Concepts

| Thing | What it is |
|-------|------------|
| **Feature** | A named AI capability (e.g. `threat_model_generate`). Declared in [`services/ai/features.js`](backend/services/ai/features.js). Every call names its feature so usage/cost can be grouped and gated per-feature. |
| **AiConfig** | Singleton row: the global on/off switch, default provider/model, and an org-wide default monthly budget. |
| **AiModelPricing** | Effective-dated price book (per 1,000,000 tokens). Editing a price closes the old row and inserts a new one — rows are never mutated. |
| **AiAccessRule** | Per-company AI settings: gate (`enabled`), optional provider/model override, and optional monthly cost/token caps. `userId` is reserved for future per-user RBAC. |
| **AiRequest** | One row per model call: token usage, the **snapshotted** price it was charged at, computed cost, status (`success`/`error`/`blocked`), and attribution. This is the durable audit + billing ledger. |

### The choke-point

Every feature calls `runAi(...)`, which in order:

1. **Gates** the call — global switch → company rule → monthly budget
   ([`services/ai/access.js`](backend/services/ai/access.js)). A blocked call is
   recorded as an `AiRequest` with status `blocked` and then rejected.
2. **Calls** the model ([`services/ai/client.js`](backend/services/ai/client.js)).
3. **Snapshots** the active price, computes cost, and writes the `AiRequest`
   ([`services/ai/pricing.js`](backend/services/ai/pricing.js)).

Because the price is copied onto each `AiRequest`, changing the price book later
never rewrites historical cost.

---

## Configuration: admin dashboard vs. environment

The split is deliberate: **secrets and hard limits** live in the environment
(operators, deploy-time); **policy and pricing** live in the admin UI (runtime,
no redeploy).

### Environment variables (backend)

Only credentials and fallback floors live here. Everything else is in the admin
UI. Set in the backend environment (see [`.env.example`](.env.example)); changing
these requires a backend restart.

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | For Anthropic | Anthropic credential. **Only** place a key is stored. If the selected provider's key is unset, AI fails closed regardless of admin settings. |
| `OPENAI_API_KEY` | For OpenAI | OpenAI credential. |
| `ANTHROPIC_BASE_URL` | No | Override Anthropic API base URL (enterprise/proxy). Blank = default. |
| `OPENAI_BASE_URL` | No | Override OpenAI API base URL. Blank = default. |
| `AI_DEFAULT_MODEL` | No | Fallback default model id, used **only if** `AiConfig.defaultModel` is unset. |
| `AI_MAX_OUTPUT_TOKENS` | No | Fallback output-token ceiling, used **only if** the admin `defaultMaxOutputTokens` is unset. Default `4096`. |

Why env, not UI: API keys are secrets and must not be readable/editable from a
web dashboard. The model and token ceiling are managed in the admin UI (below);
the env vars are just the floor used before an admin sets them.

### Admin dashboard (`/settings/ai`, admin only)

Runtime configuration, no redeploy. Backed by DB tables and the
[`routes/ai.js`](backend/routes/ai.js) API.

| Tab | What you control | Stored in |
|-----|------------------|-----------|
| **Configuration** | Global AI on/off master switch; default provider (Anthropic/OpenAI); default model; **max output tokens** ceiling; org-wide default monthly cost cap per company. | `AiConfig` |
| **Model pricing** | Per-model input/output (and optional cache read/write) price per 1M tokens. New price = new effective-dated row. | `AiModelPricing` |
| **Company access** | Enable/disable AI per company; per-company provider/model override (blank = inherit global default); optional monthly cost cap per company. | `AiAccessRule` |
| **Usage & cost** | Read-only rollups (total cost, tokens, requests) by company / feature / model, plus a recent-requests table. | `AiRequest` (read) |

### Quick reference

| Setting | Where | Why |
|---------|-------|-----|
| API key / credential (per provider) | **Env** | Secret; never web-editable |
| API base URL (per provider) | **Env** | Deploy-time endpoint choice |
| Global AI on/off | **Admin** | Runtime policy |
| Default provider | **Admin** | Runtime choice (Anthropic/OpenAI) |
| Default model | **Admin** (env fallback) | Runtime choice; env is the floor |
| Max output tokens | **Admin** (env fallback) | Runtime ceiling; env is the floor |
| Model prices | **Admin** | Changes without redeploy; must be historically stable |
| Per-company enablement | **Admin** | Runtime policy (gating) |
| Per-company budget caps | **Admin** | Runtime policy |

---

## Enabling AI (operator checklist)

1. Set `ANTHROPIC_API_KEY` in the backend env and restart. The
   **Configuration** tab shows a warning until a key is present.
2. **Model pricing** tab → add a row for the model id you will use (this is how
   the Usage tab can show cost). Prices are per **1,000,000 tokens**.
3. **Configuration** tab → set the default model to that id and toggle
   **AI features enabled globally** on.
4. **Company access** tab → enable AI for the companies that should have it, and
   optionally set a monthly spend cap.

AI is **off by default at every level** (global switch off, no company rules) —
enabling is explicit opt-in.

---

## Feature: threat-model co-pilot

Drafts STRIDE threats and components for an application's threat model.

- **Backend:** [`services/threatModelAi.js`](backend/services/threatModelAi.js) →
  `POST /api/applications/:id/threat-model/ai-draft`.
- **Frontend:** "✨ Draft with AI" button on the threat-model tab, and a review
  modal ([`AiDraftReviewModal.jsx`](frontend/src/components/threat-model/AiDraftReviewModal.jsx)).

### How it works

1. The button appears only when `GET /api/ai/availability` says AI is enabled for
   that application's company.
2. The draft endpoint builds a prompt from the application record (description,
   data types, criticality, exposure, framework, interfaces, existing security
   testing, …) plus the current threat model, and constrains the model to the
   **same controlled vocabularies** the manual editor uses — STRIDE keys, actor /
   data-type / archetype keys. Output comes back as a forced tool call
   (structured JSON), and every field is re-validated through the existing
   `normalize*` helpers; unknown keys are dropped.
3. The endpoint **persists nothing** — it returns suggestions.
4. The review modal lets the user accept/reject each suggestion. Accepted items
   are written through the **normal** threat-model endpoints (`saveThreatModel`,
   `addThreatModelComponent`), so they are validated a second time server-side.

### Security properties

- **Human-in-the-loop:** the model only proposes JSON a person approves; it never
  writes to the model or takes actions.
- **Prompt injection:** application-supplied text is wrapped in delimited data
  blocks and the system prompt instructs the model to treat it as data, not
  instructions. Because output is enum-validated and human-approved, injected
  content cannot alter records.
- **Provenance:** the durable record that content was AI-assisted lives in the
  `AiRequest` ledger (linked by `applicationId` + `feature` + timestamp).
  Accepted threats become normal threats after human approval.

---

## Provider support

Both **Anthropic** and **OpenAI** are implemented. All provider differences are
isolated in [`services/ai/client.js`](backend/services/ai/client.js); feature
code (like the threat-model co-pilot) is vendor-neutral — it describes *what* it
wants (a system prompt, messages, a tool schema) and the client decides *how* to
call the selected provider. Gating, budgets, the price book, cost computation,
the usage ledger, and the admin UI are all provider-agnostic.

### Selecting a provider

Both providers can be enabled at once (set both env keys). Provider/model is
chosen at two levels, resolved in this order when a call runs:

**feature override → company setting → global default → env floor**

Entirely a runtime choice in the admin UI — no code changes:

1. Set each provider's key in the backend env (`OPENAI_API_KEY` and/or
   `ANTHROPIC_API_KEY`) and restart. Both may be set simultaneously.
2. **Configuration** tab → set the **global** default provider + model + max
   output tokens. This is the fallback for any company without an override.
3. **Company access** tab → optionally give a company its own **provider +
   model** (set together; blank inherits the global default). This is how one
   company runs on OpenAI while another runs on Anthropic.
4. **Model pricing** tab → add price rows for every provider/model in use, so
   cost is tracked for each.

Resolution lives in [`runAi`](backend/services/ai/runAi.js): it reads the
company's `AiAccessRule` (returned by the same access check that gates the call)
and prefers its provider/model over the global config. `availability` and the
"fail closed if no key" check both use the *company's resolved* provider, so a
company set to OpenAI is unavailable if `OPENAI_API_KEY` is missing even when
Anthropic is configured. Per-feature overrides remain possible — `runAi()`
accepts an explicit `provider`/`model` that wins over both.

### How the client normalizes each provider

`callModel()` dispatches on `provider` and returns one shape:
`{ text, toolUse: { name, input }, usage: { inputTokens, outputTokens,
cacheReadTokens, cacheWriteTokens }, model, stopReason, latencyMs }`. Tools are
passed in Anthropic's `{ name, description, input_schema }` shape (plain JSON
Schema); the OpenAI branch translates them. The mappings handled internally:

| Concern | Anthropic | OpenAI |
|---------|-----------|--------|
| System prompt | top-level `system` param | prepended `role: "system"` message |
| Structured output | forced **tool_use** with `input_schema` | **function tool** (`parameters` = the same JSON Schema) with `tool_choice` |
| Result payload | `content[].tool_use.input` (object) | `tool_calls[].function.arguments` (JSON string, parsed) |
| Usage field names | `input_tokens` / `output_tokens` | `prompt_tokens` / `completion_tokens` |
| Cached tokens | `cache_read_input_tokens` / `cache_creation_input_tokens` | `prompt_tokens_details.cached_tokens` (no write bucket) |

One subtlety in cost accounting: OpenAI's `prompt_tokens` **includes** cached
tokens, whereas Anthropic's `input_tokens` **excludes** them. The client
subtracts cached tokens from the OpenAI input count so the price book's separate
input vs. cache-read pricing computes cost consistently across both providers.

### Notes / limitations

- The client sends `max_tokens`, which works for mainstream OpenAI chat models
  (gpt-4o, gpt-4.1, gpt-4o-mini). Some newer reasoning models require
  `max_completion_tokens`; add that mapping in the OpenAI branch if you adopt one.
- Provider is chosen globally via `AiConfig.defaultProvider`. Per-feature
  provider overrides would be a small addition — `runAi()` already accepts a
  `provider` argument; just thread a feature-level choice into it.
