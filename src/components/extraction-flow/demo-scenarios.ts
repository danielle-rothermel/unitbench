import {
  makeExtractionFlowSample,
  makeExtractionFlowSamples,
  type ExtractionFlowSample,
  type PerTestResult,
} from '@/fixtures/extraction'
import {
  makeSampleIdentity,
  type EvaluationCaseStatus,
} from '@/fixtures/primitives'

export type ExtractionFlowScenario = {
  /** Stable slug, e.g. 'passed', 'extraction-failed'. */
  id: string
  /** Picker button text. */
  label: string
  /** One-line "what to look for" caption on the demo page. */
  description: string
  sample: ExtractionFlowSample
}

const HAND_AUTHORED_ENTRY_POINT = 'rolling_max'
const HAND_AUTHORED_PROMPT = [
  'from typing import List',
  '',
  'def rolling_max(numbers: List[int]) -> List[int]:',
  '    """ From a given list of integers, generate a list of rolling',
  '    maximum element found until given moment in the sequence."""',
].join('\n')

function countTestStatuses(
  results: PerTestResult[],
): Partial<Record<EvaluationCaseStatus, number>> {
  const counts: Partial<Record<EvaluationCaseStatus, number>> = {}
  for (const result of results) {
    counts[result.status] = (counts[result.status] ?? 0) + 1
  }
  return counts
}

/**
 * Hand-authored samples derive status_counts from per_test_results so the
 * typed literals cannot drift out of internal consistency.
 */
function makeHandAuthoredSample(
  sample: Omit<ExtractionFlowSample, 'status_counts'>,
): ExtractionFlowSample {
  return { ...sample, status_counts: countTestStatuses(sample.per_test_results) }
}

function handAuthoredBase(input: { task_id: string; sample_index: number }) {
  return {
    identity: makeSampleIdentity({
      layout: 'encdec' as const,
      task_id: input.task_id,
      model: 'openai/gpt-5.5-codex',
      sample_index: input.sample_index,
    }),
    prompt_text: HAND_AUTHORED_PROMPT,
    entry_point: HAND_AUTHORED_ENTRY_POINT,
  }
}

function makeTestResult(input: {
  index: number
  status: EvaluationCaseStatus
  function_name?: string
  message?: string
}): PerTestResult {
  const expected = `[${input.index + 1}, ${input.index + 3}, ${input.index + 3}]`
  const passed = input.status === 'passed'
  return {
    test_id: `case-${input.index}`,
    function_name: input.function_name ?? HAND_AUTHORED_ENTRY_POINT,
    status: input.status,
    message: input.message ?? (passed ? '' : `expected ${expected}, got []`),
    test_type: 'input_result',
    input_repr: `([${input.index + 1}, ${input.index + 3}, ${input.index + 2}],)`,
    expected_output_repr: expected,
    actual_output_repr: passed ? expected : '[]',
  }
}

const NO_TOP_LEVEL_FUNCTIONS_SAMPLE = makeHandAuthoredSample({
  ...handAuthoredBase({ task_id: 'HumanEval/31', sample_index: 0 }),
  raw_generation: '```python\nclass RollingMax:\n    pass\n\nprint("done")\n```',
  extracted_code: 'class RollingMax:\n    pass\n\nprint("done")',
  extraction_method: 'fenced_code',
  compile_ok: true,
  compile_error: null,
  parsed_functions: [],
  best_function_name: null,
  generated_code_outcome: 'no_top_level_functions',
  per_test_results: [],
})

const COMPILE_ERROR_SAMPLE = makeHandAuthoredSample({
  ...handAuthoredBase({ task_id: 'HumanEval/32', sample_index: 0 }),
  raw_generation:
    '```python\ndef rolling_max(numbers):\n    result = [\n    return result\n```',
  extracted_code: 'def rolling_max(numbers):\n    result = [\n    return result',
  extraction_method: 'fenced_code',
  compile_ok: false,
  compile_error: 'SyntaxError: invalid syntax (line 3)',
  parsed_functions: [],
  best_function_name: null,
  generated_code_outcome: 'extraction_failed',
  per_test_results: [],
})

const SELECTED_NOT_ENTRY_POINT_SAMPLE = makeHandAuthoredSample({
  ...handAuthoredBase({ task_id: 'HumanEval/33', sample_index: 1 }),
  raw_generation:
    '```python\ndef rolling_max(numbers, seed):\n    ...\n\ndef helper(numbers):\n    ...\n```',
  extracted_code: [
    'def rolling_max(numbers, seed):',
    '    return helper(numbers)',
    '',
    'def helper(numbers):',
    '    result = []',
    '    for value in numbers:',
    '        result.append(max(result[-1], value) if result else value)',
    '    return result',
  ].join('\n'),
  extraction_method: 'fenced_code',
  compile_ok: true,
  compile_error: null,
  parsed_functions: [
    {
      function_name: HAND_AUTHORED_ENTRY_POINT,
      arity: 2,
      signature_str: 'def rolling_max(numbers, seed)',
      is_selected: false,
    },
    {
      function_name: 'helper',
      arity: 1,
      signature_str: 'def helper(numbers)',
      is_selected: true,
    },
  ],
  best_function_name: 'helper',
  generated_code_outcome: 'passed',
  per_test_results: [
    makeTestResult({ index: 0, status: 'passed', function_name: 'helper' }),
    makeTestResult({ index: 1, status: 'passed', function_name: 'helper' }),
    makeTestResult({ index: 2, status: 'passed', function_name: 'helper' }),
  ],
})

const TIMEOUT_AND_ERROR_CASES_SAMPLE = makeHandAuthoredSample({
  ...handAuthoredBase({ task_id: 'HumanEval/34', sample_index: 2 }),
  raw_generation:
    '```python\ndef rolling_max(numbers):\n    while True:\n        ...\n```',
  extracted_code: [
    'def rolling_max(numbers):',
    '    while numbers and numbers[0] < 0:',
    '        pass',
    '    return [max(numbers[: i + 1]) for i in range(len(numbers))]',
  ].join('\n'),
  extraction_method: 'bare_python',
  compile_ok: true,
  compile_error: null,
  parsed_functions: [
    {
      function_name: HAND_AUTHORED_ENTRY_POINT,
      arity: 1,
      signature_str: 'def rolling_max(numbers)',
      is_selected: true,
    },
  ],
  best_function_name: HAND_AUTHORED_ENTRY_POINT,
  generated_code_outcome: 'tests_failed',
  per_test_results: [
    makeTestResult({ index: 0, status: 'passed' }),
    makeTestResult({ index: 1, status: 'failed' }),
    makeTestResult({
      index: 2,
      status: 'error',
      message: "TypeError: '<' not supported between 'str' and 'int'",
    }),
    makeTestResult({
      index: 3,
      status: 'timeout',
      message: 'case exceeded 5s wall-clock limit',
    }),
  ],
})

const EVALUATION_INCOMPLETE_SAMPLE = makeHandAuthoredSample({
  ...handAuthoredBase({ task_id: 'HumanEval/35', sample_index: 0 }),
  raw_generation:
    '```python\ndef rolling_max(numbers):\n    return numbers\n```',
  extracted_code: 'def rolling_max(numbers):\n    return numbers',
  extraction_method: 'fenced_code',
  compile_ok: true,
  compile_error: null,
  parsed_functions: [
    {
      function_name: HAND_AUTHORED_ENTRY_POINT,
      arity: 1,
      signature_str: 'def rolling_max(numbers)',
      is_selected: true,
    },
  ],
  best_function_name: HAND_AUTHORED_ENTRY_POINT,
  generated_code_outcome: 'evaluation_incomplete',
  per_test_results: [
    makeTestResult({ index: 0, status: 'passed' }),
    makeTestResult({ index: 1, status: 'error', message: 'harness crashed' }),
  ],
})

const GENERATOR_SCENARIOS: ExtractionFlowScenario[] = [
  {
    id: 'passed',
    label: 'passed',
    description:
      'Clean run: all three code panes filled, entry point selected, every test green.',
    sample: makeExtractionFlowSample({ seed: 3, outcome: 'passed' }),
  },
  {
    id: 'tests-failed',
    label: 'tests failed',
    description:
      'Code extracted and selected, but the per-test table mixes failing statuses with red expected/actual cells.',
    sample: makeExtractionFlowSample({ seed: 5, outcome: 'tests_failed' }),
  },
  {
    id: 'extraction-failed',
    label: 'extraction failed',
    description:
      'Raw generation is prose with no code block: extracted-code placeholder plus warning banner.',
    sample: makeExtractionFlowSample({ seed: 7, outcome: 'extraction_failed' }),
  },
  {
    id: 'empty-generation',
    label: 'empty generation',
    description:
      'The model returned nothing: raw-generation and extracted-code placeholders, empty stages 2-3.',
    sample: makeExtractionFlowSample({ seed: 9, outcome: 'empty_generation' }),
  },
]

const SAMPLED_SWEEP_SCENARIOS: ExtractionFlowScenario[] =
  makeExtractionFlowSamples(4, { seed: 21 }).map((sample, index) => ({
    id: `sampled-${index}`,
    label: `sampled #${index}`,
    description: `Generator-sampled outcome (seed ${21 + index}): whatever mix the fixture's own outcome sampling produces.`,
    sample,
  }))

const HAND_AUTHORED_SCENARIOS: ExtractionFlowScenario[] = [
  {
    id: 'no-top-level-functions',
    label: 'no top-level functions',
    description:
      'Code extracted but only a class and a print statement: empty function list and empty tests.',
    sample: NO_TOP_LEVEL_FUNCTIONS_SAMPLE,
  },
  {
    id: 'compile-error',
    label: 'compile error',
    description:
      'Extracted code fails to compile: error-tone banner carrying the SyntaxError message.',
    sample: COMPILE_ERROR_SAMPLE,
  },
  {
    id: 'selected-not-entry-point',
    label: 'selected ≠ entry point',
    description:
      'Outcome-based selection picked helper (arity 1) over the entry point (arity 2): yellow mismatch callout.',
    sample: SELECTED_NOT_ENTRY_POINT_SAMPLE,
  },
  {
    id: 'timeout-and-error-cases',
    label: 'timeout + error cases',
    description:
      'Per-test rows covering all four statuses: passed, failed, error, and timeout tags in one table.',
    sample: TIMEOUT_AND_ERROR_CASES_SAMPLE,
  },
  {
    id: 'evaluation-incomplete',
    label: 'evaluation incomplete',
    description:
      'Only part of the suite ran: warning banner with a partial per-test table.',
    sample: EVALUATION_INCOMPLETE_SAMPLE,
  },
]

export const EXTRACTION_FLOW_SCENARIOS: readonly ExtractionFlowScenario[] = [
  ...GENERATOR_SCENARIOS,
  ...SAMPLED_SWEEP_SCENARIOS,
  ...HAND_AUTHORED_SCENARIOS,
]
