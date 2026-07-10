# R0 — Shared fixture shapes for the six viz components (REL-13)

Status: DESIGN — awaiting approval before implementation.

One shared contract for the fake-data fixtures that R1–R6 build against. Every shape is
derived from what the real pipeline produces, so the D3 real-data swap is a pass-through:

- **Neon tables** written by `tools/unitbench_publish` (`models.py`, `schema.py`,
  `dr_dspy_v1.py`): `published_predictions`, `published_prediction_details`,
  `published_experiments` — the authoritative field inventory.
- **whetstone-ai scoring records** (`src/dr_dspy/records/models.py`,
  `humaneval/{scoring,task,compression,code_parsing,parsed_code,metric_models}.py`) —
  the payloads that land in `summary_json` / `metrics_json` / `validation_json` /
  `response_json`.
- **Existing app conventions**: snake_case keys matching Neon columns
  (`src/lib/prediction-detail.ts`), measure names `n | avg_score | stddev_score |
  pass_rate | avg_cost` (`src/lib/aggregate-config.ts`, `aggregate-data.ts:130-136`),
  canonical model collapsing (`src/lib/canonical-model.ts`), heatmap cell/pivot idioms
  (`src/lib/heatmap-order.ts`).

Field naming rule: **fixture keys are the Neon column / JSONB payload keys, verbatim,
in snake_case.** A component built against a fixture row must render a SQL result row
with zero mapping.

---

## Shared primitives (`src/fixtures/primitives.ts`)

Closed value sets copied exactly from the pipeline enums:

```ts
export const EXPERIMENT_KINDS = ['humaneval_direct', 'humaneval_encdec'] as const
export type ExperimentKind = (typeof EXPERIMENT_KINDS)[number]

export const RESULT_STATES = ['passed', 'failed', 'pending', 'error'] as const
export type ResultState = (typeof RESULT_STATES)[number]

export const GRAPH_LAYOUTS = ['direct', 'encdec'] as const
export type GraphLayout = (typeof GRAPH_LAYOUTS)[number]

// eval_failures/types.py FailureClass — rate-limit errors are failure_class === 'rate_limited'
export const FAILURE_CLASSES = [
  'permanent', 'transient', 'rate_limited', 'resource_exhaustion', 'unknown',
] as const
export type FailureClass = (typeof FAILURE_CLASSES)[number]

// scoring.py GeneratedCodeOutcome
export const GENERATED_CODE_OUTCOMES = [
  'passed', 'tests_failed', 'evaluation_incomplete',
  'empty_generation', 'extraction_failed', 'no_top_level_functions',
] as const
export type GeneratedCodeOutcome = (typeof GENERATED_CODE_OUTCOMES)[number]

// task.py EvaluationCaseStatus
export const EVALUATION_CASE_STATUSES = ['passed', 'failed', 'error', 'timeout'] as const
export type EvaluationCaseStatus = (typeof EVALUATION_CASE_STATUSES)[number]

// parsed_tests.py HumanEvalTestCaseKind
export const TEST_CASE_KINDS = ['input_result', 'input_oracle', 'input_expression'] as const
export type TestCaseKind = (typeof TEST_CASE_KINDS)[number]

// code_parsing.py ExtractionMethod
export const EXTRACTION_METHODS = [
  'dspy_code_field', 'json_code_field', 'json_string',
  'fenced_code', 'cleaned_candidate', 'bare_python', 'field_marker',
] as const
export type ExtractionMethod = (typeof EXTRACTION_METHODS)[number]

// compression.py CompressionMethod
export const COMPRESSION_METHODS = ['raw', 'zlib', 'gzip', 'bz2', 'lzma', 'zstd'] as const
export type CompressionMethod = (typeof COMPRESSION_METHODS)[number]
```

The one canonical identity, reused by every per-sample shape. Keys are
`published_predictions` columns:

```ts
/** Identity of one prediction (= one task × model × repetition sample). */
export type SampleIdentity = {
  prediction_id: string        // published_predictions.prediction_id
  experiment_id: string        // "dr-dspy-v1/{layout}/{experiment_name}"
  experiment_kind: ExperimentKind
  task_id: string              // "HumanEval/12"
  model: string                // canonical label per src/lib/canonical-model.ts
  sample_index: number         // repetition ordinal (summary_json.repetition_seed)
}
```

Notes anchored to the Neon schema:

- `model` for enc-dec rows is `"encoder -> decoder"`, collapsed to the bare model when
  encoder === decoder (`canonical-model.ts` / `dr_dspy_v1.display_model`). Fixtures
  emit the already-canonical label.
- `published_predictions.sample_index` is currently NULL for dr-dspy-v1 rows; the
  repetition lives in `summary_json.repetition_seed`. Fixtures treat `sample_index` as
  a required number; the D3 real-data query projects
  `COALESCE(sample_index, (summary_json->>'repetition_seed')::int)`. Flagged as the
  one intentional deviation from a raw column.

---

## Shape 1 — Sweep metrics (R1, `src/fixtures/sweep.ts`)

One row per group in a grouped aggregate over `published_predictions` — the same row
shape `aggregate-data.ts` already produces, extended with error/rate-limit counts and
latency. Group keys are nullable: a per-model row has `task_id: null`, and vice versa.

```ts
export type SweepMetricsRow = {
  // group keys — null when not part of the grouping
  model: string | null
  task_id: string | null
  experiment_kind: ExperimentKind | null

  // measures — names match aggregate-config SORT_MEASURES where they exist
  n: number                      // count(*)
  pass_count: number             // result_state = 'passed'
  fail_count: number
  pending_count: number
  error_count: number            // result_state = 'error'
  rate_limit_count: number       // failures with failure_class = 'rate_limited'
  pass_rate: number | null       // pass_count / nullif(n, 0)
  avg_score: number | null       // avg(score); score is binary 0/1 (scoring.py:167)
  stddev_score: number | null
  avg_cost: number | null        // avg(provider_cost) USD
  total_cost: number | null      // sum(provider_cost)
  avg_latency_ms: number | null  // generation started→completed
  p95_latency_ms: number | null
}
```

Real sources: counts/score/cost are direct SQL over existing columns. `rate_limit_count`
and latency exist upstream (`NodeAttemptRecord.started_at/completed_at`,
`FailureMetadataPayload.failure_class`) but are not yet projected into
`published_predictions`; D3 wiring surfaces them as two additive `summary_json` keys
(`latency_ms`, `failure_class`) in the publisher. The fixture bakes them in now so R1
renders them from day one.

Example row (per-model grouping):

```ts
{
  model: 'openai/gpt-5.5-codex',
  task_id: null,
  experiment_kind: 'humaneval_encdec',
  n: 984, pass_count: 611, fail_count: 293, pending_count: 12, error_count: 68,
  rate_limit_count: 41,
  pass_rate: 0.621, avg_score: 0.621, stddev_score: 0.485,
  avg_cost: 0.0042, total_cost: 4.13,
  avg_latency_ms: 8410, p95_latency_ms: 22750,
}
```

---

## Shape 2 — Extraction flow (R2, `src/fixtures/extraction.ts`)

One sample's journey: raw generation → extraction → parsed functions → entry-point
selection → per-test results. Mirrors `validation_json.extracted_code`
(`ExtractedCodePayload` + `CodeExtractionResult`), `EvaluationTaskSummary`, and
`ScoreAttemptRecord.per_test_results` (`PerTestResultPayload`).

```ts
/** One top-level function found in the extracted code (parsed_code.py). */
export type ParsedFunction = {
  function_name: string
  arity: number                // len(function_args)
  signature_str: string        // "def rolling_max(numbers: list[int]) -> list[int]"
  is_selected: boolean         // === best_function_name
}

/** Persisted per-test element — PerTestResultPayload (records/models.py). */
export type PerTestResult = {
  test_id: string              // "case-3"
  function_name: string
  status: EvaluationCaseStatus
  message: string              // '' when passed
  test_type: TestCaseKind
  input_repr: string
  expected_output_repr: string
  actual_output_repr: string
}

export type ExtractionFlowSample = {
  identity: SampleIdentity
  prompt_text: string                    // details.prompt_text
  entry_point: string                    // request_json.entry_point
  raw_generation: string | null          // details.raw_generation
  extracted_code: string | null          // details.code_text
  extraction_method: ExtractionMethod | null
  compile_ok: boolean
  compile_error: string | null
  parsed_functions: ParsedFunction[]     // from function_names + signatures
  best_function_name: string | null      // EvaluationTaskSummary.best_function_name:
                                         // max passed cases, tie-broken by name === entry_point
  generated_code_outcome: GeneratedCodeOutcome | null
  per_test_results: PerTestResult[]
  status_counts: Partial<Record<EvaluationCaseStatus, number>>
}
```

Note on "arity-based selection": in the real pipeline the entry-point choice is
outcome-based (`task.py:147-169` picks the candidate function maximizing passed cases,
tie-broken by matching `entry_point`), with arity visible via each function's
signature. The fixture exposes both the per-function arity and the selection result so
R2 can render the selection story faithfully.

Example row:

```ts
{
  identity: {
    prediction_id: 'dr-dspy-v1/encdec/prediction/pred-01HZX4',
    experiment_id: 'dr-dspy-v1/encdec/coarse-budget-01',
    experiment_kind: 'humaneval_encdec',
    task_id: 'HumanEval/12', model: 'openai/gpt-5.5-codex', sample_index: 1,
  },
  prompt_text: 'def longest(strings: List[str]) -> Optional[str]:\n    """Return the longest string..."""',
  entry_point: 'longest',
  raw_generation: '```python\ndef longest(strings):\n    ...\n```',
  extracted_code: 'def longest(strings):\n    if not strings:\n        return None\n    return max(strings, key=len)',
  extraction_method: 'fenced_code',
  compile_ok: true, compile_error: null,
  parsed_functions: [
    { function_name: 'longest', arity: 1, signature_str: 'def longest(strings)', is_selected: true },
    { function_name: 'helper', arity: 2, signature_str: 'def helper(a, b)', is_selected: false },
  ],
  best_function_name: 'longest',
  generated_code_outcome: 'tests_failed',
  per_test_results: [
    { test_id: 'case-0', function_name: 'longest', status: 'passed', message: '',
      test_type: 'input_result', input_repr: "(['a', 'bb', 'ccc'],)",
      expected_output_repr: "'ccc'", actual_output_repr: "'ccc'" },
    { test_id: 'case-1', function_name: 'longest', status: 'failed',
      message: "expected None, got ''", test_type: 'input_result',
      input_repr: '([],)', expected_output_repr: 'None', actual_output_repr: "''" },
  ],
  status_counts: { passed: 1, failed: 1 },
}
```

---

## Shape 3 — Compression results (R3, `src/fixtures/compression.ts`)

Target vs achieved ratio plus IR/char counts for one sample. Sources:
`dimensions.compression_target` (legacy alias `budget_ratio`, read by
`heatmap-config.BUDGET_DIMENSION_SQL`), `metrics_json.realized_compression_ratio`
(= `compression.<method>.ratio_to_ground_truth`, `frames.py`),
`HumanEvalScoreResult.best_compression_ratio`, `TextMetricsPayload.character_count`
per stage, and `CompressionMetric` per lossless method.

```ts
/** compression.py CompressionMetric — byte-based, one per method, all methods present. */
export type CompressionMetric = {
  method: CompressionMethod
  ground_truth_bytes: number
  representation_bytes: number   // IR / encoded-description bytes
  compressed_bytes: number       // after the method; 'raw' = representation_bytes
  ratio_to_ground_truth: number | null        // compressed / ground_truth; lower = better
  percent_reduction_vs_ground_truth: number | null
}

export type CompressionResultRow = {
  identity: SampleIdentity
  target_compression_ratio: number | null   // the knob; null for direct runs
  encoder_char_budget: number | null        // max(50, round(target * gt_chars))
  achieved_compression_ratio: number | null // metrics_json.realized_compression_ratio
  best_compression_ratio: number | null     // min ratio across methods
  ground_truth_char_count: number           // TextMetrics.character_count (chars, not bytes)
  encoded_char_count: number | null         // encoder-output IR char count
  generated_char_count: number | null       // decoded/generated code char count
  compression_metrics: CompressionMetric[]  // one per COMPRESSION_METHODS entry
  result_state: ResultState
  score: number | null
}
```

Example row (abbreviated to two methods; fixtures emit all six):

```ts
{
  identity: { /* as above, task_id: 'HumanEval/12', sample_index: 1 */ },
  target_compression_ratio: 0.5,
  encoder_char_budget: 96,
  achieved_compression_ratio: 0.44,
  best_compression_ratio: 0.41,
  ground_truth_char_count: 192,
  encoded_char_count: 89,
  generated_char_count: 205,
  compression_metrics: [
    { method: 'raw', ground_truth_bytes: 192, representation_bytes: 89,
      compressed_bytes: 89, ratio_to_ground_truth: 0.464,
      percent_reduction_vs_ground_truth: 53.6 },
    { method: 'zstd', ground_truth_bytes: 192, representation_bytes: 89,
      compressed_bytes: 79, ratio_to_ground_truth: 0.411,
      percent_reduction_vs_ground_truth: 58.9 },
  ],
  result_state: 'passed',
  score: 1.0,
}
```

---

## Shape 4 — Pipeline trace (R4, `src/fixtures/pipeline.ts`)

Per-stage trace of encode → lossless compress → decompress → decode → run tests.
LLM stages map to `NodeAttemptRecord`s (`node_id`: `encoder`, `decoder`, or `direct`);
the lossless compress/decompress stages are measurement steps derived from
`CompressionMetric`; the test stage summarizes `per_test_results`.

```ts
export const PIPELINE_STAGE_NAMES = [
  'encode',      // encoder node attempt (encdec only)
  'compress',    // lossless channel measurement (CompressionMetric)
  'decompress',
  'decode',      // decoder node attempt (encdec) — or:
  'generate',    // single 'direct' node attempt (direct layout only)
  'run_tests',   // score attempt
] as const
export type PipelineStageName = (typeof PIPELINE_STAGE_NAMES)[number]

export type StageFailure = {   // FailureMetadataPayload, trimmed to render needs
  failure_class: FailureClass | null
  error_type: string
  message: string
}

export type PipelineStage = {
  stage: PipelineStageName
  node_id: string | null           // 'encoder' | 'decoder' | 'direct'; null for non-LLM stages
  status: 'success' | 'error' | 'skipped'  // NodeAttemptStatus + 'skipped' for stages
                                           // never reached after an upstream error
  attempt_index: number            // retries; NodeAttemptRecord.attempt_index
  started_at: string | null        // ISO timestamp; null for measurement stages
  completed_at: string | null
  duration_ms: number | null
  input_char_count: number | null
  output_char_count: number | null
  output_excerpt: string | null    // stage output text (IR, code, test summary line)
  model: string | null             // ProviderConfigRef.model for LLM stages
  provider_cost: number | null     // usage_cost.provider_cost
  failure: StageFailure | null
}

export type PipelineTrace = {
  identity: SampleIdentity
  graph_layout: GraphLayout
  stages: PipelineStage[]          // encdec: encode…run_tests; direct: generate, run_tests
  result_state: ResultState
  total_provider_cost: number | null   // published_predictions.provider_cost
  total_duration_ms: number | null
}
```

Example row (encdec, decoder rate-limited then recovered):

```ts
{
  identity: { /* HumanEval/12, sample 1 */ },
  graph_layout: 'encdec',
  stages: [
    { stage: 'encode', node_id: 'encoder', status: 'success', attempt_index: 0,
      started_at: '2026-07-06T21:14:03Z', completed_at: '2026-07-06T21:14:09Z',
      duration_ms: 6180, input_char_count: 192, output_char_count: 89,
      output_excerpt: 'fn longest: pick max-len str, None if empty',
      model: 'openai/gpt-5.5-codex', provider_cost: 0.0011, failure: null },
    { stage: 'compress', node_id: null, status: 'success', attempt_index: 0,
      started_at: null, completed_at: null, duration_ms: null,
      input_char_count: 89, output_char_count: 79, output_excerpt: null,
      model: null, provider_cost: null, failure: null },
    { stage: 'decompress', node_id: null, status: 'success', attempt_index: 0,
      started_at: null, completed_at: null, duration_ms: null,
      input_char_count: 79, output_char_count: 89, output_excerpt: null,
      model: null, provider_cost: null, failure: null },
    { stage: 'decode', node_id: 'decoder', status: 'success', attempt_index: 1,
      started_at: '2026-07-06T21:14:31Z', completed_at: '2026-07-06T21:14:40Z',
      duration_ms: 9020, input_char_count: 89, output_char_count: 205,
      output_excerpt: 'def longest(strings):\n    ...',
      model: 'openai/gpt-5.5-codex', provider_cost: 0.0019,
      failure: { failure_class: 'rate_limited', error_type: 'RateLimitError',
                 message: '429 from provider; retried' } },
    { stage: 'run_tests', node_id: null, status: 'success', attempt_index: 0,
      started_at: '2026-07-06T21:14:41Z', completed_at: '2026-07-06T21:14:43Z',
      duration_ms: 1650, input_char_count: 205, output_char_count: null,
      output_excerpt: '7/8 cases passed', model: null, provider_cost: null,
      failure: null },
  ],
  result_state: 'failed',
  total_provider_cost: 0.0030,
  total_duration_ms: 40200,
}
```

(A stage row keeps its last failure even when a retry succeeded — `attempt_index: 1` +
`failure` renders the retry story; `status` reflects the final attempt.)

---

## Shape 5 — Bootstrap samples (R5, `src/fixtures/bootstrap.ts`)

**Decision: raw per-sample rows; bootstrapping runs client-side.** The fixture is
literally the projection of `published_predictions` that a bootstrap needs:

```ts
/** One scored prediction — the resampling unit. */
export type BootstrapSampleRow = {
  experiment_id: string
  experiment_kind: ExperimentKind
  model: string
  task_id: string
  sample_index: number
  passed: boolean            // result_state === 'passed'
  score: number | null       // binary today; kept for fractional-score futures
}

/** Output contract of the shared bootstrap helper (computed, not stored). */
export type BootstrapCiSummary = {
  model: string | null       // null = aggregated across models
  task_id: string | null     // null = aggregated across tasks
  n_samples: number          // N actually used in this resample config
  observed_pass_rate: number
  ci_low: number
  ci_high: number
  confidence_level: number   // e.g. 0.95
  n_resamples: number        // e.g. 2000
  seed: number               // deterministic reruns
}
```

Example rows:

```ts
{ experiment_id: 'dr-dspy-v1/encdec/coarse-budget-01', experiment_kind: 'humaneval_encdec',
  model: 'openai/gpt-5.5-codex', task_id: 'HumanEval/12', sample_index: 2,
  passed: true, score: 1.0 }

// computed:
{ model: 'openai/gpt-5.5-codex', task_id: null, n_samples: 3,
  observed_pass_rate: 0.62, ci_low: 0.55, ci_high: 0.69,
  confidence_level: 0.95, n_resamples: 2000, seed: 17 }
```

---

## Shape 6 — Binned headroom heatmap (R6, `src/fixtures/heatmap.ts`)

**Decision: raw per-task points in the fixture; binning runs client-side.** One point
per task × model (× target budget): X value = mean achieved compression ratio across
the N samples, Y value = per-task average pass rate across the same N.

```ts
/** One task×model×target group — the unit that gets binned. */
export type HeadroomPoint = {
  model: string                          // facet key (canonical label)
  task_id: string
  experiment_kind: ExperimentKind
  target_compression_ratio: number | null  // knob; null for direct baseline points
  achieved_compression_ratio: number     // X: mean realized ratio across samples
  mean_pass_rate: number                 // Y: mean pass/fail across N samples
  n_samples: number
}

export type HeadroomBinConfig = {
  x_bin_count: number                    // e.g. 10
  y_bin_count: number
  x_domain?: [number, number]            // default: data extent
  y_domain?: [number, number]            // default: [0, 1]
}

/** Render contract — produced by the shared binning helper, consumed by the component. */
export type HeadroomHeatmapCell = {
  facet_key: string                      // model, or 'all' when unfaceted
  x_bin_index: number
  x_min: number
  x_max: number
  y_bin_index: number
  y_min: number
  y_max: number
  count: number                          // task count in the cell (color)
}
```

Example rows:

```ts
// point:
{ model: 'openai/gpt-5.5-codex', task_id: 'HumanEval/12',
  experiment_kind: 'humaneval_encdec', target_compression_ratio: 0.5,
  achieved_compression_ratio: 0.44, mean_pass_rate: 0.667, n_samples: 3 }

// cell (after binning with x_bin_count: 10, y_bin_count: 10, x_domain [0, 2]):
{ facet_key: 'openai/gpt-5.5-codex',
  x_bin_index: 2, x_min: 0.4, x_max: 0.6,
  y_bin_index: 6, y_min: 0.6, y_max: 0.7, count: 14 }
```

---

## Decisions

1. **Bootstrap (R5): raw per-sample arrays; bootstrapping runs client-side.**
   Neon stores one row per prediction (`published_predictions.score`/`result_state`) —
   there is no CI table to pass through, so a precomputed-CI fixture would invent a
   shape with no real counterpart and bake in N, the resample count, and the
   confidence level. R5's acceptance ("compare across N") requires re-resampling at
   different N, which needs the raw samples. Cardinality is small (tasks × models × N ≈
   164 × 6 × 3), so a seeded client-side bootstrap is cheap and deterministic.
   `BootstrapCiSummary` is exported as the helper's output contract, not fixture data.

2. **Heatmap (R6): raw per-task points; binning runs client-side.**
   Bin edges and counts are view parameters — R6's spec requires URL-persisted layout
   state, matching how the existing heatmap already treats axis order
   (`heatmap-params.ts`), so pre-binned fixtures would freeze the exact knobs the user
   is meant to turn. Point cardinality (tasks × models × targets ≈ 6k) sits under the
   existing `HEATMAP_MAX_ROWS = 10_000` precedent. The D3 swap is one `GROUP BY
   task_id, model, target` over `published_predictions` joined to
   `metrics_json.realized_compression_ratio` — the same point rows. The cell type is
   still part of the contract because it is the component's render prop.

3. **Shared identity: `SampleIdentity` mirroring `published_predictions` keys.**
   `prediction_id / experiment_id / experiment_kind / task_id / model / sample_index`,
   snake_case, values shaped exactly as the publisher writes them
   (`dr_dspy_v1.experiment_id()` and `display_model()` formats; canonical model label
   per `canonical-model.ts`). One deviation, made explicit: `sample_index` is required
   in fixtures while the v1 publisher currently leaves the column NULL and stores
   `repetition_seed` in `summary_json` — D3 projects it with a COALESCE, or the
   publisher backfills the column (additive either way).

4. **Where fixtures live and how components import them.**
   `src/fixtures/` — `primitives.ts`, `sweep.ts`, `extraction.ts`, `compression.ts`,
   `pipeline.ts`, `bootstrap.ts`, `heatmap.ts`, `rng.ts` (small seeded PRNG so
   generators are deterministic without `Math.random()`), re-exported from `index.ts`.
   Components import `@/fixtures` via the existing `@/*` alias. Each module exports
   the types plus a generator (`makeSweepMetricsRows(opts)`, `makeExtractionFlowSample(opts)`,
   …) with realistic defaults and overridable knobs (model/task counts, N, error rates,
   seed). Vitest tests colocate as `src/fixtures/*.test.ts` per repo convention.

## Known gaps surfaced by this design (for D3, not blockers)

- `latency_ms` and `failure_class` are needed by R1 but not yet in
  `published_predictions`; both exist upstream at publish time (additive
  `summary_json` keys in `tools/unitbench_publish` — out of scope here).
- `sample_index` NULL in v1 rows (see decision 3).
- `metrics_json.realized_compression_ratio` reads `compression.ratio_to_ground_truth`;
  the metrics payload keys compression per-method — D3 should pin which method
  (`raw` vs best) that scalar means. The fixture exposes both
  (`achieved_compression_ratio` + `best_compression_ratio` + the per-method table).
