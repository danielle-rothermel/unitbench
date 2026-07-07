import { describe, expect, it } from 'vitest'
import { makeBootstrapSampleRows } from '@/fixtures/bootstrap'

describe('makeBootstrapSampleRows', () => {
  it('is deterministic for a fixed seed', () => {
    expect(makeBootstrapSampleRows({ seed: 12 })).toEqual(
      makeBootstrapSampleRows({ seed: 12 }),
    )
  })

  it('emits one row per model x task x sample', () => {
    const rows = makeBootstrapSampleRows({
      models: ['m1', 'm2'],
      taskCount: 5,
      samplesPerTask: 3,
    })
    expect(rows).toHaveLength(2 * 5 * 3)
    const sampleIndexes = new Set(rows.map(row => row.sample_index))
    expect([...sampleIndexes].sort()).toEqual([0, 1, 2])
  })

  it('pairs passed with a binary score', () => {
    for (const row of makeBootstrapSampleRows({ taskCount: 8 })) {
      expect(row.score).toBe(row.passed ? 1.0 : 0.0)
    }
  })

  it('produces mixed outcomes suitable for resampling', () => {
    const rows = makeBootstrapSampleRows({ taskCount: 24 })
    const passCount = rows.filter(row => row.passed).length
    expect(passCount).toBeGreaterThan(0)
    expect(passCount).toBeLessThan(rows.length)
  })
})
