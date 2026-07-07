import { describe, expect, it } from 'vitest'
import {
  binHeadroomPoints,
  makeHeadroomPoints,
  UNFACETED_KEY,
  type HeadroomPoint,
} from '@/fixtures/heatmap'

describe('makeHeadroomPoints', () => {
  it('is deterministic for a fixed seed', () => {
    expect(makeHeadroomPoints({ seed: 21 })).toEqual(makeHeadroomPoints({ seed: 21 }))
  })

  it('emits one point per model x task x target', () => {
    const points = makeHeadroomPoints({
      models: ['m1', 'm2'],
      taskCount: 4,
      targetRatios: [0.5, 1.0, 2.0],
    })
    expect(points).toHaveLength(2 * 4 * 3)
  })

  it('keeps pass rates within [0, 1]', () => {
    for (const point of makeHeadroomPoints({ taskCount: 10 })) {
      expect(point.mean_pass_rate).toBeGreaterThanOrEqual(0)
      expect(point.mean_pass_rate).toBeLessThanOrEqual(1)
    }
  })
})

describe('binHeadroomPoints', () => {
  const config = { x_bin_count: 10, y_bin_count: 10, x_domain: [0, 2] as [number, number] }

  it('returns no cells for no points', () => {
    expect(binHeadroomPoints([], config)).toEqual([])
  })

  it('accounts for every point in the unfaceted cells', () => {
    const points = makeHeadroomPoints({ taskCount: 12 })
    const cells = binHeadroomPoints(points, config)
    const unfacetedTotal = cells
      .filter(cell => cell.facet_key === UNFACETED_KEY)
      .reduce((total, cell) => total + cell.count, 0)
    expect(unfacetedTotal).toBe(points.length)
  })

  it('accounts for every point once per model facet', () => {
    const points = makeHeadroomPoints({ models: ['m1', 'm2'], taskCount: 6 })
    const cells = binHeadroomPoints(points, config)
    const m1Total = cells
      .filter(cell => cell.facet_key === 'm1')
      .reduce((total, cell) => total + cell.count, 0)
    expect(m1Total).toBe(points.filter(point => point.model === 'm1').length)
  })

  it('keeps bin indices within range and edges on the grid', () => {
    const cells = binHeadroomPoints(makeHeadroomPoints({ taskCount: 8 }), config)
    for (const cell of cells) {
      expect(cell.x_bin_index).toBeGreaterThanOrEqual(0)
      expect(cell.x_bin_index).toBeLessThan(config.x_bin_count)
      expect(cell.y_bin_index).toBeGreaterThanOrEqual(0)
      expect(cell.y_bin_index).toBeLessThan(config.y_bin_count)
      expect(cell.x_max).toBeCloseTo(cell.x_min + 0.2, 6)
      expect(cell.y_max).toBeCloseTo(cell.y_min + 0.1, 6)
    }
  })

  it('preserves facet keys that contain spaces', () => {
    const point: HeadroomPoint = {
      model: 'openai/enc -> anthropic/dec',
      task_id: 'HumanEval/0',
      experiment_kind: 'humaneval_encdec',
      target_compression_ratio: 0.5,
      achieved_compression_ratio: 0.4,
      mean_pass_rate: 0.5,
      n_samples: 3,
    }
    const cells = binHeadroomPoints([point], config)
    const facetKeys = cells.map(cell => cell.facet_key).sort()
    expect(facetKeys).toEqual(['all', 'openai/enc -> anthropic/dec'])
  })

  it('clamps out-of-domain values into the edge bins', () => {
    const point: HeadroomPoint = {
      model: 'm1',
      task_id: 'HumanEval/0',
      experiment_kind: 'humaneval_encdec',
      target_compression_ratio: 2.0,
      achieved_compression_ratio: 99,
      mean_pass_rate: 1,
      n_samples: 3,
    }
    const cells = binHeadroomPoints([point], config)
    for (const cell of cells) {
      expect(cell.x_bin_index).toBe(config.x_bin_count - 1)
      expect(cell.y_bin_index).toBe(config.y_bin_count - 1)
    }
  })
})
