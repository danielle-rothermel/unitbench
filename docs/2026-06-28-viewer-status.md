# Unitbench Viewer — Status

Status of the Neon-backed viewer on the `webdev` branch: what is implemented and
what remains. See `2026-06-28-initial-viewer-goal.md` for the original goal and
`2026-06-28-dr-dspy-publish.md` for the publish pipeline.

## Architecture (as built)

```
Local Postgres (raw dr-dspy experiments)
  → unitbench-publish CLI (curates + upserts)
    → Neon (published_experiments / _predictions / _prediction_details)
      → Next.js app, server-side reads
        → Vercel
```

The app reads Neon directly from server components (no API route). Browse tables and
the prediction-detail page fetch on the server and hand data to a `'use client'`
TanStack table that drives sorting/filtering/pagination through URL search params, so
the server re-queries on each change. No client-side data fetching, no React Query.

## Done

- **Publish pipeline** (`tools/unitbench_publish`): dr-dspy direct + encoder-decoder
  HumanEval tables curated into Neon; idempotent upserts; `init-db`, `dry-run-dr-dspy`,
  `publish-dr-dspy`, `verify` commands.
- **Browse tables**: `published_experiments`, `published_predictions`,
  `published_prediction_details` rendered via a config-driven `GenericTable` with
  server-side pagination and Neon reads.
- **Filtering & sorting**: facet dropdowns (from `SELECT DISTINCT`) and text/ILIKE
  inputs (`TableFilters`); clickable sortable headers; all state in URL params via a
  shared `table-params` module. SQL built with the existing
  `validateSqlIdentifier`/`quoteIdentifier` safety layer; filter values parameterized.
- **Prediction detail page** (parity with dr-llm's sample detail): catch-all route
  `/predictions/[...predictionId]` (prediction ids contain slashes), a joined
  `getPredictionDetail()` over predictions + details, and `PredictionDetailPage`
  composing header / `ResultBadge` / stat strip / provenance `IdChip`s / input-output
  `TextPanel`s / prompt-code-raw `CodePane`s / JSON panes (empty payloads omitted).
- **Repo fix**: `.gitignore`'s Python `lib/` rule was matching `src/lib/`, so the entire
  frontend data layer was never committed; added `!src/lib/` so it is tracked.

### Verification
- `pnpm test` (24 tests), `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` all
  pass. Tests cover URL-state round-trips, the SQL query builders, the table's
  sort/link navigation, and the detail page for direct + encoder-decoder fixtures.
- **Not yet run**: live Neon smoke test (needs `DATABASE_URL` + published rows).

## Left to do

- **Live smoke test**: with `DATABASE_URL` set, browse `/tables/published-predictions`
  (filter/sort/paginate) and open a prediction; confirm encoder-decoder rows
  (model shown as `encoder -> decoder`) and an `error`-state row render correctly.
- **Deploy**: ship to a Vercel preview and confirm it reads Neon without the local
  machine online (original milestone).
- **Experiment detail page**: currently `experiment_id` links to a filtered experiments
  table; a dedicated experiment page could follow the same pattern.
- **Table UX**: page-size control (size is fixed at 25; up to 100 is supported in the
  query layer), multi-column sort, and debounced text filters.
- **Detail richness**: if encoder-decoder details look sparse, surface more fields
  (e.g. language, failure category) from `summary_json`/publish.

## Deferred (unchanged from the goal doc)

Cloudflare Tunnel, a hosted FastAPI backend, live reads from local Postgres,
dual-source fallback, full DBOS workflow browsing, and custom `unitbench.ai` DNS.
