# Initial Unitbench Viewer Goal

## Goal

Build the first version of Unitbench as a hosted experiment-results viewer that
can be deployed to Vercel early and tested from a public preview URL.

The first version should avoid live reads from local-only databases. Instead, a
local publish script will summarize selected local experiment tables and push a
viewer-friendly copy to Neon. The Vercel-hosted Next.js app will read only from
Neon, giving the product one data source and one deployment path while the UI
shape is still being discovered.

## First Data Sources

The initial viewer should focus on:

- `code_comp_t1` results.
- `dr-dspy` HumanEval direct-eval tables.
- `dr-dspy` HumanEval encoder-decoder tables.

The `dr-dspy` data currently has two main experiment families:

- Direct decoder eval-only HumanEval sweeps, backed by
  `dr_dspy_eval_experiments` and `dr_dspy_eval_predictions`.
- Encoder-decoder HumanEval sweeps, backed by
  `dr_dspy_encdec_eval_experiments` and
  `dr_dspy_encdec_eval_predictions`.

The DBOS system tables are useful for local durability and debugging, but they
should not be the primary viewer contract.

## Architecture

The first deployable architecture should be:

1. Local Postgres contains raw experiment and workflow tables.
2. A local publish script reads selected local tables.
3. The script writes curated published tables to Neon.
4. The Unitbench Next.js app reads Neon from server-side code.
5. Vercel deploys the viewer with a Vercel preview domain first.

This deliberately avoids the initial complexity of Cloudflare Tunnel, a hosted
FastAPI backend, and dual local/hosted data-source fallback behavior.

## Published Table Shape

Do not copy large raw local tables directly into Neon unless there is a clear
need. Prefer curated tables that are designed for browsing:

- `published_experiments`: experiment metadata, row counts, status counts, pass
  rates, cost summaries, and timestamps.
- `published_predictions`: compact list-row data for filtering and pagination.
- `published_prediction_details`: selected wide fields for detail pages,
  including prompts, code, outputs, validation/scoring diagnostics, usage,
  provider cost, and metrics JSON.

The first implementation can use separate direct and encoder-decoder published
tables if that keeps the schemas clearer. A normalized cross-experiment shape
can come later if the UI needs it.

## Initial UI Surfaces

The first UI should reuse the successful viewer pattern from `dr-llm`:

- An experiment overview page.
- A prediction browser with filters, pagination, and dense table rows.
- A prediction detail page with provenance, metrics, prompts, code panes,
  outputs, scoring diagnostics, and raw JSON panels where useful.

The existing `dr-llm` frontend primitives are a good starting point: app shell,
tokens, `CodePane`, `TextPanel`, `ResultBadge`, `StatCell`, `BudgetStat`, and
`IdChip`.

## Deferred

Defer these until the Neon-backed viewer proves the first useful data shape:

- Cloudflare Tunnel to a local FastAPI service.
- A public FastAPI backend.
- Live reads from local Postgres.
- Dual-source fallback behavior in the UI.
- Full DBOS workflow metadata browsing.
- Custom `unitbench.ai` DNS setup.

## Success Criteria

The first milestone is complete when:

- A local command can publish selected experiment data to Neon.
- The Next.js app can list experiments from Neon.
- The app can browse and open prediction details for at least one `code_comp_t1`
  or `dr-dspy` experiment.
- The app can be deployed to Vercel and used from a Vercel preview URL without
  depending on the local machine being online.
