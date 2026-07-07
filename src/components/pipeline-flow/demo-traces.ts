/**
 * Named demo scenarios for the pipeline-flow dev route, built from the frozen
 * makePipelineTrace generator. Retries and pass/fail are probabilistic in the
 * generator, so probabilistic scenarios scan seeds deterministically; the
 * fixture is frozen, so found seeds are stable. demo-traces.test.ts pins each
 * scenario's advertised invariant.
 */

import {
  makePipelineTrace,
  type PipelineFixtureOptions,
  type PipelineTrace,
} from '@/fixtures/pipeline'
import { FIXTURE_MODELS } from '@/fixtures/primitives'

export type DemoTrace = {
  id: string
  title: string
  description: string
  trace: PipelineTrace
}

const MAX_SCANNED_SEED = 500

/** Scans seeds 1..maxSeed and throws when no generated trace matches (fail fast). */
export function firstSeedWhere(
  predicate: (trace: PipelineTrace) => boolean,
  options: Omit<PipelineFixtureOptions, 'seed'> = {},
  maxSeed: number = MAX_SCANNED_SEED,
): number {
  for (let seed = 1; seed <= maxSeed; seed += 1) {
    if (predicate(makePipelineTrace({ ...options, seed }))) return seed
  }
  throw new Error(`no seed in 1..${maxSeed} produces a matching pipeline trace`)
}

function scannedTrace(
  predicate: (trace: PipelineTrace) => boolean,
  options: Omit<PipelineFixtureOptions, 'seed'> = {},
): PipelineTrace {
  return makePipelineTrace({ ...options, seed: firstSeedWhere(predicate, options) })
}

export function hasRecoveredRetry(trace: PipelineTrace): boolean {
  return trace.stages.some(
    stage => stage.status === 'success' && stage.failure !== null,
  )
}

function isCleanRun(trace: PipelineTrace): boolean {
  return trace.stages.every(stage => stage.failure === null)
}

export const DEMO_TRACES: DemoTrace[] = [
  {
    id: 'encdec-pass',
    title: 'Encdec · passed',
    description:
      'Happy path: all five stages green with no retries; run_tests reports 8/8.',
    trace: scannedTrace(
      trace => trace.result_state === 'passed' && isCleanRun(trace),
    ),
  },
  {
    id: 'encdec-retry-recovered',
    title: 'Encdec · rate-limited retry that recovered',
    description:
      'An LLM stage was rate limited, retried, and succeeded — yellow retry affordance, not an error.',
    trace: scannedTrace(hasRecoveredRetry),
  },
  {
    id: 'encdec-tests-failed',
    title: 'Encdec · tests failed',
    description:
      'Every stage completed but the sample failed: run_tests reports 6/8 and the trace badge is failed.',
    trace: scannedTrace(
      trace => trace.result_state === 'failed' && isCleanRun(trace),
    ),
  },
  {
    id: 'encdec-fail-decode',
    title: 'Encdec · decode failed',
    description:
      'The decoder errored after a retry; run_tests was never reached and renders skipped.',
    trace: makePipelineTrace({ failAt: 'decode' }),
  },
  {
    id: 'encdec-fail-encode',
    title: 'Encdec · encode failed',
    description:
      'The first stage errored, so all four downstream stages render skipped.',
    trace: makePipelineTrace({ failAt: 'encode' }),
  },
  {
    id: 'direct-pass',
    title: 'Direct · passed',
    description: 'Two-stage direct layout: generate then run_tests, both green.',
    trace: scannedTrace(trace => trace.result_state === 'passed', {
      layout: 'direct',
    }),
  },
  {
    id: 'direct-fail-generate',
    title: 'Direct · generate failed',
    description:
      'Direct-layout failure: generate errors and run_tests renders skipped.',
    trace: makePipelineTrace({ layout: 'direct', failAt: 'generate' }),
  },
  {
    id: 'encdec-fail-tests',
    title: 'Encdec · run_tests failed',
    description:
      'The last stage errored — everything upstream is green and nothing is skipped.',
    trace: makePipelineTrace({ failAt: 'run_tests' }),
  },
]

/** Extra seeds/models beyond the named scenarios, to show generator variance. */
export const GALLERY_TRACES: PipelineTrace[] = [
  makePipelineTrace({ seed: 21, task_id: 'HumanEval/21', model: FIXTURE_MODELS[1] }),
  makePipelineTrace({ seed: 22, task_id: 'HumanEval/22', model: FIXTURE_MODELS[2], sample_index: 1 }),
  makePipelineTrace({ seed: 23, task_id: 'HumanEval/23', model: FIXTURE_MODELS[3], sample_index: 2 }),
  makePipelineTrace({
    seed: 24,
    layout: 'direct',
    task_id: 'HumanEval/24',
    model: FIXTURE_MODELS[1],
  }),
  makePipelineTrace({
    seed: 25,
    layout: 'direct',
    task_id: 'HumanEval/25',
    model: FIXTURE_MODELS[2],
    sample_index: 1,
  }),
]
