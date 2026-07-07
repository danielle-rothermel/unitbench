import { describe, expect, it } from 'vitest'
import {
  DEMO_TRACES,
  firstSeedWhere,
  GALLERY_TRACES,
  hasRecoveredRetry,
  type DemoTrace,
} from '@/components/pipeline-flow/demo-traces'
import type { PipelineTrace } from '@/fixtures/pipeline'

function demo(id: string): DemoTrace {
  const found = DEMO_TRACES.find(entry => entry.id === id)
  if (!found) throw new Error(`missing demo trace: ${id}`)
  return found
}

function stageStatuses(trace: PipelineTrace): [string, string][] {
  return trace.stages.map(stage => [stage.stage, stage.status])
}

describe('DEMO_TRACES', () => {
  it('ships the eight named scenarios', () => {
    expect(DEMO_TRACES.map(entry => entry.id)).toEqual([
      'encdec-pass',
      'encdec-retry-recovered',
      'encdec-tests-failed',
      'encdec-fail-decode',
      'encdec-fail-encode',
      'direct-pass',
      'direct-fail-generate',
      'encdec-fail-tests',
    ])
  })

  it('encdec-pass is a clean five-stage pass', () => {
    const { trace } = demo('encdec-pass')
    expect(trace.graph_layout).toBe('encdec')
    expect(trace.result_state).toBe('passed')
    expect(trace.stages).toHaveLength(5)
    expect(trace.stages.every(stage => stage.status === 'success')).toBe(true)
    expect(trace.stages.every(stage => stage.failure === null)).toBe(true)
    expect(trace.stages.at(-1)?.output_excerpt).toBe('8/8 cases passed')
  })

  it('encdec-retry-recovered contains a recovered retry, not an error', () => {
    const { trace } = demo('encdec-retry-recovered')
    expect(hasRecoveredRetry(trace)).toBe(true)
    expect(trace.stages.some(stage => stage.status === 'error')).toBe(false)
  })

  it('encdec-tests-failed keeps all stages green with a 6/8 excerpt', () => {
    const { trace } = demo('encdec-tests-failed')
    expect(trace.result_state).toBe('failed')
    expect(trace.stages.every(stage => stage.status === 'success')).toBe(true)
    expect(trace.stages.at(-1)?.output_excerpt).toBe('6/8 cases passed')
  })

  it('encdec-fail-decode errors at decode and skips run_tests', () => {
    const { trace } = demo('encdec-fail-decode')
    expect(stageStatuses(trace)).toEqual([
      ['encode', 'success'],
      ['compress', 'success'],
      ['decompress', 'success'],
      ['decode', 'error'],
      ['run_tests', 'skipped'],
    ])
    expect(trace.result_state).toBe('error')
  })

  it('encdec-fail-encode errors first and skips the four downstream stages', () => {
    const { trace } = demo('encdec-fail-encode')
    expect(stageStatuses(trace)).toEqual([
      ['encode', 'error'],
      ['compress', 'skipped'],
      ['decompress', 'skipped'],
      ['decode', 'skipped'],
      ['run_tests', 'skipped'],
    ])
  })

  it('direct-pass is a passing two-stage direct trace', () => {
    const { trace } = demo('direct-pass')
    expect(trace.graph_layout).toBe('direct')
    expect(trace.result_state).toBe('passed')
    expect(stageStatuses(trace)).toEqual([
      ['generate', 'success'],
      ['run_tests', 'success'],
    ])
  })

  it('direct-fail-generate errors at generate and skips run_tests', () => {
    const { trace } = demo('direct-fail-generate')
    expect(stageStatuses(trace)).toEqual([
      ['generate', 'error'],
      ['run_tests', 'skipped'],
    ])
  })

  it('encdec-fail-tests errors on the last stage with nothing skipped', () => {
    const { trace } = demo('encdec-fail-tests')
    expect(stageStatuses(trace)).toEqual([
      ['encode', 'success'],
      ['compress', 'success'],
      ['decompress', 'success'],
      ['decode', 'success'],
      ['run_tests', 'error'],
    ])
  })
})

describe('firstSeedWhere', () => {
  it('finds the lowest matching seed deterministically', () => {
    const seed = firstSeedWhere(trace => trace.result_state === 'passed')
    expect(seed).toBe(firstSeedWhere(trace => trace.result_state === 'passed'))
    expect(seed).toBeGreaterThanOrEqual(1)
  })

  it('throws when no seed matches within the scan budget', () => {
    expect(() => firstSeedWhere(() => false, {}, 5)).toThrow(
      'no seed in 1..5 produces a matching pipeline trace',
    )
  })
})

describe('GALLERY_TRACES', () => {
  it('has unique prediction ids and both layouts', () => {
    const ids = GALLERY_TRACES.map(trace => trace.identity.prediction_id)
    expect(new Set(ids).size).toBe(ids.length)
    const layouts = new Set(GALLERY_TRACES.map(trace => trace.graph_layout))
    expect(layouts).toEqual(new Set(['encdec', 'direct']))
  })
})
