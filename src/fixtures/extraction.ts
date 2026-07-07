import {
  FIXTURE_MODELS,
  makeSampleIdentity,
  type EvaluationCaseStatus,
  type ExtractionMethod,
  type GeneratedCodeOutcome,
  type SampleIdentity,
  type TestCaseKind,
} from '@/fixtures/primitives'
import { chance, createRng, intBetween, pick } from '@/fixtures/rng'

/** One top-level function found in the extracted code (parsed_code.py). */
export type ParsedFunction = {
  function_name: string
  /** len(function_args) */
  arity: number
  signature_str: string
  /** === best_function_name */
  is_selected: boolean
}

/** Persisted per-test element — PerTestResultPayload (records/models.py). */
export type PerTestResult = {
  test_id: string
  function_name: string
  status: EvaluationCaseStatus
  /** '' when passed */
  message: string
  test_type: TestCaseKind
  input_repr: string
  expected_output_repr: string
  actual_output_repr: string
}

/**
 * One sample's code → extraction → tests journey (R2). Sources:
 * details.prompt_text / raw_generation / code_text, request_json.entry_point,
 * validation_json.extracted_code, metrics_json.per_test_results, and
 * EvaluationTaskSummary (best_function_name = candidate maximizing passed
 * cases, tie-broken by name === entry_point).
 */
export type ExtractionFlowSample = {
  identity: SampleIdentity
  prompt_text: string
  entry_point: string
  raw_generation: string | null
  extracted_code: string | null
  extraction_method: ExtractionMethod | null
  compile_ok: boolean
  compile_error: string | null
  parsed_functions: ParsedFunction[]
  best_function_name: string | null
  generated_code_outcome: GeneratedCodeOutcome | null
  per_test_results: PerTestResult[]
  status_counts: Partial<Record<EvaluationCaseStatus, number>>
}

export type ExtractionFixtureOptions = {
  seed?: number
  task_id?: string
  model?: string
  sample_index?: number
  caseCount?: number
  /** Force the outcome instead of sampling one. */
  outcome?: GeneratedCodeOutcome
}

const ENTRY_POINT = 'rolling_max'
const PROMPT_TEXT = [
  'from typing import List',
  '',
  'def rolling_max(numbers: List[int]) -> List[int]:',
  '    """ From a given list of integers, generate a list of rolling',
  '    maximum element found until given moment in the sequence."""',
].join('\n')
const EXTRACTED_CODE = [
  'def rolling_max(numbers):',
  '    result = []',
  '    current = None',
  '    for value in numbers:',
  '        current = value if current is None else max(current, value)',
  '        result.append(current)',
  '    return result',
].join('\n')

function makePerTestResults(
  rng: ReturnType<typeof createRng>,
  caseCount: number,
  allPass: boolean,
): PerTestResult[] {
  return Array.from({ length: caseCount }, (_, index) => {
    const passed = allPass || chance(rng, 0.75)
    const status: EvaluationCaseStatus = passed
      ? 'passed'
      : pick(rng, ['failed', 'failed', 'error', 'timeout'] as const)
    const expected = `[${index + 1}, ${index + 3}, ${index + 3}]`
    return {
      test_id: `case-${index}`,
      function_name: ENTRY_POINT,
      status,
      message: status === 'passed' ? '' : `expected ${expected}, got []`,
      test_type: 'input_result' as const,
      input_repr: `([${index + 1}, ${index + 3}, ${index + 2}],)`,
      expected_output_repr: expected,
      actual_output_repr: status === 'passed' ? expected : '[]',
    }
  })
}

function countStatuses(
  results: PerTestResult[],
): Partial<Record<EvaluationCaseStatus, number>> {
  const counts: Partial<Record<EvaluationCaseStatus, number>> = {}
  for (const result of results) {
    counts[result.status] = (counts[result.status] ?? 0) + 1
  }
  return counts
}

export function makeExtractionFlowSample(
  options: ExtractionFixtureOptions = {},
): ExtractionFlowSample {
  const {
    seed = 1,
    task_id = 'HumanEval/9',
    model = FIXTURE_MODELS[0],
    sample_index = 0,
  } = options
  const rng = createRng(seed)
  const caseCount = options.caseCount ?? intBetween(rng, 4, 8)
  const identity = makeSampleIdentity({ layout: 'encdec', task_id, model, sample_index })

  const outcome =
    options.outcome ??
    pick(rng, [
      'passed',
      'passed',
      'passed',
      'tests_failed',
      'tests_failed',
      'extraction_failed',
    ] as const)

  if (outcome === 'extraction_failed' || outcome === 'empty_generation') {
    return {
      identity,
      prompt_text: PROMPT_TEXT,
      entry_point: ENTRY_POINT,
      raw_generation: outcome === 'empty_generation' ? null : 'Sure! Here is my approach…',
      extracted_code: null,
      extraction_method: null,
      compile_ok: false,
      compile_error: null,
      parsed_functions: [],
      best_function_name: null,
      generated_code_outcome: outcome,
      per_test_results: [],
      status_counts: {},
    }
  }

  const perTestResults = makePerTestResults(rng, caseCount, outcome === 'passed')
  return {
    identity,
    prompt_text: PROMPT_TEXT,
    entry_point: ENTRY_POINT,
    raw_generation: `\`\`\`python\n${EXTRACTED_CODE}\n\`\`\``,
    extracted_code: EXTRACTED_CODE,
    extraction_method: pick(rng, ['fenced_code', 'bare_python', 'dspy_code_field'] as const),
    compile_ok: true,
    compile_error: null,
    parsed_functions: [
      {
        function_name: ENTRY_POINT,
        arity: 1,
        signature_str: `def ${ENTRY_POINT}(numbers)`,
        is_selected: true,
      },
      {
        function_name: 'clamp',
        arity: 2,
        signature_str: 'def clamp(value, limit)',
        is_selected: false,
      },
    ],
    best_function_name: ENTRY_POINT,
    generated_code_outcome: outcome,
    per_test_results: perTestResults,
    status_counts: countStatuses(perTestResults),
  }
}

export function makeExtractionFlowSamples(
  count: number,
  options: ExtractionFixtureOptions = {},
): ExtractionFlowSample[] {
  const { seed = 1 } = options
  return Array.from({ length: count }, (_, index) =>
    makeExtractionFlowSample({ ...options, seed: seed + index, sample_index: index }),
  )
}
