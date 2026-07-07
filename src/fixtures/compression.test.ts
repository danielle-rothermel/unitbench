import { describe, expect, it } from 'vitest'
import { makeCompressionResultRows } from '@/fixtures/compression'
import { COMPRESSION_METHODS } from '@/fixtures/primitives'

describe('makeCompressionResultRows', () => {
  it('is deterministic for a fixed seed', () => {
    expect(makeCompressionResultRows({ seed: 2 })).toEqual(
      makeCompressionResultRows({ seed: 2 }),
    )
  })

  it('emits one row per task x model x target x sample', () => {
    const rows = makeCompressionResultRows({
      models: ['m1'],
      taskCount: 2,
      targetRatios: [0.5, 1.0],
      samplesPerTarget: 3,
    })
    expect(rows).toHaveLength(2 * 1 * 2 * 3)
  })

  it('includes every compression method exactly once per row', () => {
    for (const row of makeCompressionResultRows({ taskCount: 2 })) {
      expect(row.compression_metrics.map(metric => metric.method)).toEqual([
        ...COMPRESSION_METHODS,
      ])
    }
  })

  it('computes ratios as compressed over ground truth', () => {
    for (const row of makeCompressionResultRows({ taskCount: 2 })) {
      for (const metric of row.compression_metrics) {
        expect(metric.ratio_to_ground_truth).toBeCloseTo(
          metric.compressed_bytes / metric.ground_truth_bytes,
          3,
        )
      }
      const ratios = row.compression_metrics.map(m => m.ratio_to_ground_truth ?? Infinity)
      expect(row.best_compression_ratio).toBeCloseTo(Math.min(...ratios), 4)
    }
  })

  it('applies the minimum encoder char budget', () => {
    for (const row of makeCompressionResultRows({ targetRatios: [0.25], taskCount: 4 })) {
      expect(row.encoder_char_budget).toBe(
        Math.max(50, Math.round(0.25 * row.ground_truth_char_count)),
      )
    }
  })

  it('pairs result_state with a binary score', () => {
    for (const row of makeCompressionResultRows({ taskCount: 3 })) {
      expect(row.score).toBe(row.result_state === 'passed' ? 1.0 : 0.0)
    }
  })
})
