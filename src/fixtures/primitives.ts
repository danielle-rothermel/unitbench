/**
 * Shared identity + closed value sets for the fake-data fixtures (REL-13).
 *
 * Field names are the Neon column / JSONB payload keys, verbatim, so the D3
 * real-data swap is a pass-through. Enum strings are copied exactly from the
 * whetstone-ai pipeline (dr_dspy StrEnums) and tools/unitbench_publish.
 * Design doc: docs/planning/viz-components/v0/plan.md.
 */

export const EXPERIMENT_KINDS = ['humaneval_direct', 'humaneval_encdec'] as const
export type ExperimentKind = (typeof EXPERIMENT_KINDS)[number]

export const RESULT_STATES = ['passed', 'failed', 'pending', 'error'] as const
export type ResultState = (typeof RESULT_STATES)[number]

export const GRAPH_LAYOUTS = ['direct', 'encdec'] as const
export type GraphLayout = (typeof GRAPH_LAYOUTS)[number]

// eval_failures/types.py FailureClass; rate-limit errors are 'rate_limited'
export const FAILURE_CLASSES = [
  'permanent',
  'transient',
  'rate_limited',
  'resource_exhaustion',
  'unknown',
] as const
export type FailureClass = (typeof FAILURE_CLASSES)[number]

// humaneval/scoring.py GeneratedCodeOutcome
export const GENERATED_CODE_OUTCOMES = [
  'passed',
  'tests_failed',
  'evaluation_incomplete',
  'empty_generation',
  'extraction_failed',
  'no_top_level_functions',
] as const
export type GeneratedCodeOutcome = (typeof GENERATED_CODE_OUTCOMES)[number]

// humaneval/task.py EvaluationCaseStatus
export const EVALUATION_CASE_STATUSES = [
  'passed',
  'failed',
  'error',
  'timeout',
] as const
export type EvaluationCaseStatus = (typeof EVALUATION_CASE_STATUSES)[number]

// humaneval/parsed_tests.py HumanEvalTestCaseKind
export const TEST_CASE_KINDS = [
  'input_result',
  'input_oracle',
  'input_expression',
] as const
export type TestCaseKind = (typeof TEST_CASE_KINDS)[number]

// humaneval/code_parsing.py ExtractionMethod
export const EXTRACTION_METHODS = [
  'dspy_code_field',
  'json_code_field',
  'json_string',
  'fenced_code',
  'cleaned_candidate',
  'bare_python',
  'field_marker',
] as const
export type ExtractionMethod = (typeof EXTRACTION_METHODS)[number]

// humaneval/compression.py CompressionMethod
export const COMPRESSION_METHODS = ['raw', 'zlib', 'gzip', 'bz2', 'lzma', 'zstd'] as const
export type CompressionMethod = (typeof COMPRESSION_METHODS)[number]

/** Identity of one prediction (= one task × model × repetition sample). */
export type SampleIdentity = {
  prediction_id: string
  experiment_id: string
  experiment_kind: ExperimentKind
  task_id: string
  /** Canonical label per src/lib/canonical-model.ts. */
  model: string
  /** Repetition ordinal; real rows project summary_json.repetition_seed. */
  sample_index: number
}

// ID formats mirror tools/unitbench_publish/dr_dspy_v1.py
const V1_EXPERIMENT_PREFIX = 'dr-dspy-v1'

export function fixtureExperimentId(layout: GraphLayout, experimentName: string): string {
  return `${V1_EXPERIMENT_PREFIX}/${layout}/${experimentName}`
}

export function fixturePredictionId(layout: GraphLayout, sourceId: string): string {
  return `${V1_EXPERIMENT_PREFIX}/${layout}/prediction/${sourceId}`
}

export function experimentKindForLayout(layout: GraphLayout): ExperimentKind {
  return layout === 'direct' ? 'humaneval_direct' : 'humaneval_encdec'
}

/** Default catalogs shared by the generators; override via each maker's options. */
export const FIXTURE_MODELS = [
  'openai/gpt-5.5-codex',
  'anthropic/claude-sonnet-5',
  'anthropic/claude-haiku-4-5',
  'google/gemini-3-flash',
] as const

/** Matches heatmap-config BUDGET_VALUE_ORDER (minus the direct-run '(none)'). */
export const FIXTURE_TARGET_RATIOS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0] as const

export const FIXTURE_EXPERIMENT_NAME = 'coarse-budget-01'

export function fixtureTaskIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `HumanEval/${index}`)
}

export function makeSampleIdentity(input: {
  layout: GraphLayout
  experimentName?: string
  task_id: string
  model: string
  sample_index: number
}): SampleIdentity {
  const experimentName = input.experimentName ?? FIXTURE_EXPERIMENT_NAME
  const taskSlug = input.task_id.replace('/', '-').toLowerCase()
  const sourceId = `pred-${taskSlug}-s${input.sample_index}`
  return {
    prediction_id: fixturePredictionId(input.layout, sourceId),
    experiment_id: fixtureExperimentId(input.layout, experimentName),
    experiment_kind: experimentKindForLayout(input.layout),
    task_id: input.task_id,
    model: input.model,
    sample_index: input.sample_index,
  }
}
