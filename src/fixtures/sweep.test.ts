import { describe, expect, it } from 'vitest'
import { makeSweepMetricsRows } from '@/fixtures/sweep'

describe('makeSweepMetricsRows', () => {
  it('is deterministic for a fixed seed', () => {
    expect(makeSweepMetricsRows({ seed: 5 })).toEqual(makeSweepMetricsRows({ seed: 5 }))
  })

  it('emits one row per model for the default grouping', () => {
    const rows = makeSweepMetricsRows({ models: ['m1', 'm2', 'm3'] })
    expect(rows.map(row => row.model)).toEqual(['m1', 'm2', 'm3'])
    expect(rows.every(row => row.task_id === null)).toBe(true)
    expect(rows.every(row => row.experiment_kind === null)).toBe(true)
  })

  it('crosses group keys when grouped by model and task', () => {
    const rows = makeSweepMetricsRows({
      groupBy: ['model', 'task_id'],
      models: ['m1', 'm2'],
      taskCount: 3,
    })
    expect(rows).toHaveLength(6)
    expect(rows.every(row => row.model !== null && row.task_id !== null)).toBe(true)
  })

  it('keeps the state counts consistent with n', () => {
    for (const row of makeSweepMetricsRows({ groupBy: ['model', 'experiment_kind'] })) {
      expect(
        row.pass_count + row.fail_count + row.pending_count + row.error_count,
      ).toBe(row.n)
      expect(row.rate_limit_count).toBeLessThanOrEqual(row.error_count)
      expect(row.pass_rate).toBeCloseTo(row.pass_count / row.n, 4)
    }
  })

  it('keeps latency percentiles ordered', () => {
    for (const row of makeSweepMetricsRows({ seed: 9 })) {
      expect(row.p95_latency_ms ?? 0).toBeGreaterThanOrEqual(row.avg_latency_ms ?? 0)
    }
  })
})
