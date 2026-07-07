import {
  FIXTURE_MODELS,
  makeSampleIdentity,
  type FailureClass,
  type GraphLayout,
  type ResultState,
  type SampleIdentity,
} from '@/fixtures/primitives'
import { chance, createRng, intBetween, round, type Rng } from '@/fixtures/rng'

export const PIPELINE_STAGE_NAMES = [
  'encode',
  'compress',
  'decompress',
  'decode',
  'generate',
  'run_tests',
] as const
export type PipelineStageName = (typeof PIPELINE_STAGE_NAMES)[number]

export const STAGE_STATUSES = ['success', 'error', 'skipped'] as const
export type StageStatus = (typeof STAGE_STATUSES)[number]

/** FailureMetadataPayload (records/models.py), trimmed to render needs. */
export type StageFailure = {
  failure_class: FailureClass | null
  error_type: string
  message: string
}

/**
 * One stage of a sample's end-to-end trace (R4). LLM stages map to
 * NodeAttemptRecords (node_id encoder/decoder/direct); compress/decompress are
 * measurement steps from CompressionMetric; run_tests summarizes the score
 * attempt. A stage keeps its last failure even when a retry succeeded, so
 * attempt_index + failure render the retry story.
 */
export type PipelineStage = {
  stage: PipelineStageName
  node_id: string | null
  status: StageStatus
  attempt_index: number
  started_at: string | null
  completed_at: string | null
  duration_ms: number | null
  input_char_count: number | null
  output_char_count: number | null
  output_excerpt: string | null
  model: string | null
  provider_cost: number | null
  failure: StageFailure | null
}

export type PipelineTrace = {
  identity: SampleIdentity
  graph_layout: GraphLayout
  /** encdec: encode…run_tests; direct: generate, run_tests. */
  stages: PipelineStage[]
  result_state: ResultState
  total_provider_cost: number | null
  total_duration_ms: number | null
}

export type PipelineFixtureOptions = {
  seed?: number
  layout?: GraphLayout
  task_id?: string
  model?: string
  sample_index?: number
  /** Fail this stage; everything after it is 'skipped'. */
  failAt?: PipelineStageName
}

const BASE_TIME_MS = Date.UTC(2026, 6, 6, 21, 14, 3)
const RATE_LIMIT_FAILURE: StageFailure = {
  failure_class: 'rate_limited',
  error_type: 'RateLimitError',
  message: '429 from provider; retried',
}

type StageSpec = {
  stage: PipelineStageName
  node_id: string | null
  llm: boolean
}

function stageSpecs(layout: GraphLayout): StageSpec[] {
  if (layout === 'direct') {
    return [
      { stage: 'generate', node_id: 'direct', llm: true },
      { stage: 'run_tests', node_id: null, llm: false },
    ]
  }
  return [
    { stage: 'encode', node_id: 'encoder', llm: true },
    { stage: 'compress', node_id: null, llm: false },
    { stage: 'decompress', node_id: null, llm: false },
    { stage: 'decode', node_id: 'decoder', llm: true },
    { stage: 'run_tests', node_id: null, llm: false },
  ]
}

function stageExcerpt(stage: PipelineStageName, passed: boolean): string | null {
  if (stage === 'encode') return 'fn rolling_max: running max over list, cumulative'
  if (stage === 'decode' || stage === 'generate') return 'def rolling_max(numbers): …'
  if (stage === 'run_tests') return passed ? '8/8 cases passed' : '6/8 cases passed'
  return null
}

function makeStage(
  rng: Rng,
  spec: StageSpec,
  input: { startMs: number; inputChars: number; model: string; failed: boolean; passed: boolean },
): PipelineStage {
  const { startMs, inputChars, model, failed, passed } = input
  const timed = spec.llm || spec.stage === 'run_tests'
  const durationMs = timed
    ? intBetween(rng, spec.llm ? 2_500 : 400, spec.llm ? 12_000 : 2_500)
    : null
  const outputChars =
    spec.stage === 'run_tests'
      ? null
      : Math.max(20, Math.round(inputChars * (spec.llm ? 0.5 + rng() : 0.9)))
  const retried = spec.llm && chance(rng, 0.2)
  return {
    stage: spec.stage,
    node_id: spec.node_id,
    status: failed ? 'error' : 'success',
    attempt_index: retried || failed ? 1 : 0,
    started_at: timed ? new Date(startMs).toISOString() : null,
    completed_at: timed && durationMs !== null ? new Date(startMs + durationMs).toISOString() : null,
    duration_ms: durationMs,
    input_char_count: inputChars,
    output_char_count: failed ? null : outputChars,
    output_excerpt: failed ? null : stageExcerpt(spec.stage, passed),
    model: spec.llm ? model : null,
    provider_cost: spec.llm ? round(0.0005 + rng() * 0.003, 6) : null,
    failure: failed || retried ? RATE_LIMIT_FAILURE : null,
  }
}

function skippedStage(spec: StageSpec): PipelineStage {
  return {
    stage: spec.stage,
    node_id: spec.node_id,
    status: 'skipped',
    attempt_index: 0,
    started_at: null,
    completed_at: null,
    duration_ms: null,
    input_char_count: null,
    output_char_count: null,
    output_excerpt: null,
    model: null,
    provider_cost: null,
    failure: null,
  }
}

export function makePipelineTrace(options: PipelineFixtureOptions = {}): PipelineTrace {
  const {
    seed = 1,
    layout = 'encdec',
    task_id = 'HumanEval/9',
    model = FIXTURE_MODELS[0],
    sample_index = 0,
    failAt,
  } = options
  const rng = createRng(seed)
  const identity = makeSampleIdentity({ layout, task_id, model, sample_index })
  const passed = failAt === undefined && chance(rng, 0.6)

  const stages: PipelineStage[] = []
  let startMs = BASE_TIME_MS
  let inputChars = intBetween(rng, 150, 600)
  let reachedFailure = false
  for (const spec of stageSpecs(layout)) {
    if (reachedFailure) {
      stages.push(skippedStage(spec))
      continue
    }
    const failed = spec.stage === failAt
    const stage = makeStage(rng, spec, { startMs, inputChars, model, failed, passed })
    stages.push(stage)
    if (failed) {
      reachedFailure = true
      continue
    }
    startMs += (stage.duration_ms ?? 0) + intBetween(rng, 100, 2_000)
    inputChars = stage.output_char_count ?? inputChars
  }

  const llmCosts = stages
    .map(stage => stage.provider_cost)
    .filter((cost): cost is number => cost !== null)
  const durations = stages
    .map(stage => stage.duration_ms)
    .filter((duration): duration is number => duration !== null)
  return {
    identity,
    graph_layout: layout,
    stages,
    result_state: failAt !== undefined ? 'error' : passed ? 'passed' : 'failed',
    total_provider_cost: llmCosts.length > 0 ? round(llmCosts.reduce((a, b) => a + b, 0), 6) : null,
    total_duration_ms: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) : null,
  }
}
