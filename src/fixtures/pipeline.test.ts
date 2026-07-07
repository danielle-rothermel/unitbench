import { describe, expect, it } from 'vitest'
import { makePipelineTrace } from '@/fixtures/pipeline'

describe('makePipelineTrace', () => {
  it('is deterministic for a fixed seed', () => {
    expect(makePipelineTrace({ seed: 8 })).toEqual(makePipelineTrace({ seed: 8 }))
  })

  it('emits the encdec stage order', () => {
    const trace = makePipelineTrace({ layout: 'encdec' })
    expect(trace.stages.map(stage => stage.stage)).toEqual([
      'encode',
      'compress',
      'decompress',
      'decode',
      'run_tests',
    ])
    expect(trace.stages[0].node_id).toBe('encoder')
    expect(trace.stages[3].node_id).toBe('decoder')
  })

  it('emits generate + run_tests for the direct layout', () => {
    const trace = makePipelineTrace({ layout: 'direct' })
    expect(trace.stages.map(stage => stage.stage)).toEqual(['generate', 'run_tests'])
    expect(trace.stages[0].node_id).toBe('direct')
    expect(trace.graph_layout).toBe('direct')
  })

  it('marks the failed stage and skips everything after it', () => {
    const trace = makePipelineTrace({ failAt: 'decode' })
    const statuses = trace.stages.map(stage => [stage.stage, stage.status])
    expect(statuses).toEqual([
      ['encode', 'success'],
      ['compress', 'success'],
      ['decompress', 'success'],
      ['decode', 'error'],
      ['run_tests', 'skipped'],
    ])
    const decode = trace.stages[3]
    expect(decode.failure?.failure_class).toBe('rate_limited')
    expect(trace.result_state).toBe('error')
  })

  it('totals cost across the LLM stages', () => {
    const trace = makePipelineTrace({ seed: 3, layout: 'encdec' })
    const stageCosts = trace.stages
      .map(stage => stage.provider_cost)
      .filter((cost): cost is number => cost !== null)
    expect(stageCosts).toHaveLength(2)
    expect(trace.total_provider_cost).toBeCloseTo(
      stageCosts.reduce((a, b) => a + b, 0),
      6,
    )
  })

  it('keeps LLM stage timestamps ordered', () => {
    const trace = makePipelineTrace({ seed: 6 })
    const timed = trace.stages.filter(stage => stage.started_at !== null)
    for (const stage of timed) {
      expect(new Date(stage.completed_at ?? 0).getTime()).toBeGreaterThanOrEqual(
        new Date(stage.started_at ?? 0).getTime(),
      )
    }
  })
})
