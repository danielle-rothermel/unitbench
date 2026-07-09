# Projection Consumer Sketch

Design commit for workbench stage 5. This is unitbench's statement of
what it needs from the platform library's rebuildable-projections
feature — written from the consumer side, before the producer exists.
The read layer in `src/lib/read-layer.ts` is the isolation seam: today
it joins `published_*` tables; when v1 projections land it is the only
module that changes.

## Why the current shape hurts

`published_predictions` carries identity + outcome; every analytical
measure beyond `score`/`provider_cost` (compression ratios, evaluation
counts, encoder/decoder split costs) lives inside `metrics_json` /
`summary_json` blobs on `published_prediction_details`. Any chart that
plots a metric per sample pays a two-table join plus JSONB extraction,
and the set of "promoted" columns is decided by each query instead of
once. Replay needs a third shape entirely (per-node attempts), which
the published tables do not carry at all.

## Projection 1 — flat analytical projection (`analytics_predictions`)

One row per prediction; every column a chart might put on an axis is a
real typed column. Rebuildable from the event log at any time.

| column | type | source today |
|--------|------|--------------|
| prediction_id, experiment_id, source, experiment_kind, task_id, sample_index | text/int | published_predictions |
| model, encoder_model, decoder_model | text | predictions + summary_json |
| result_state, generation_status, scoring_status | text | published_predictions |
| score | float | published_predictions |
| provider_cost, encoder_cost, decoder_cost | float | predictions + response_json |
| budget_ratio, encoder_char_budget, temperature, repetition_seed | float/int | summary_json |
| raw_compression_ratio, best_compression_ratio, best_compression_percent_reduction | float | details.metrics_json |
| evaluation_total_cases, evaluation_failure_count | int | details.metrics_json |
| generated_at, scored_at, created_at, updated_at | timestamptz | predictions + summary_json |
| graph_digest, generation_run_id | text | not published today — needed for replay cross-links |

Consumer contract: dashboard scatters/violins/heatmaps read only this
table; no JSONB on the hot path; `prediction_id` remains the
click-through key into the detail surface.

## Projection 2 — replay projection (`replay_runs` + `replay_node_attempts`)

Step-through needs the execution trace, keyed so sibling runs are
comparable.

- `replay_runs`: one row per generation run — `generation_run_id`,
  `prediction_id`, `graph_digest`, `graph_snapshot` (the GraphSpec
  JSON at execution time), `status`, `started_at`, `finished_at`.
- `replay_node_attempts`: one row per node attempt —
  `generation_run_id`, `node_id`, `attempt_index`, `status`,
  `input_bindings_resolved` (jsonb), `output` (jsonb), `error`
  (jsonb), `started_at`, `finished_at`, per-attempt cost/usage.

Consumer contract: the replay viewer walks
`replay_node_attempts` ordered by (`generation_run_id`,
`attempt_index`); the graph viewer renders `graph_snapshot`;
side-by-side compare selects two predictions sharing a
`graph_digest`. JSONB is fine here — replay reads one run at a time.

## Read-layer swap plan

`src/lib/read-layer.ts` exposes intent-named functions
(`fetchCorrectnessCompressionPoints`, …) returning typed rows. Pages
never see table names or JSONB paths. When projections exist, each
function body swaps its SQL from the published-table join to the
projection table — signatures and consumers unchanged.
