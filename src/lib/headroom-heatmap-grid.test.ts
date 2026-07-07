import { describe, expect, it } from 'vitest'
import {
  binHeadroomPoints,
  makeHeadroomPoints,
  UNFACETED_KEY,
  type HeadroomBinConfig,
  type HeadroomPoint,
} from '@/fixtures/heatmap'
import {
  buildHeadroomGrid,
  formatEdge,
  resolveXDomain,
} from '@/lib/headroom-heatmap-grid'

const config: HeadroomBinConfig = {
  x_bin_count: 10,
  y_bin_count: 10,
  x_domain: [0, 2],
  y_domain: [0, 1],
}

function makePoint(overrides: Partial<HeadroomPoint> = {}): HeadroomPoint {
  return {
    model: 'm1',
    task_id: 'HumanEval/0',
    experiment_kind: 'humaneval_encdec',
    target_compression_ratio: 0.5,
    achieved_compression_ratio: 0.4,
    mean_pass_rate: 0.5,
    n_samples: 3,
    ...overrides,
  }
}

describe('buildHeadroomGrid edges', () => {
  it('produces bins + 1 edges spanning the domain with uniform steps', () => {
    const grid = buildHeadroomGrid(makeHeadroomPoints({ taskCount: 4 }), config)
    expect(grid).not.toBeNull()
    expect(grid?.x_edges).toHaveLength(config.x_bin_count + 1)
    expect(grid?.y_edges).toHaveLength(config.y_bin_count + 1)
    expect(grid?.x_edges[0]).toBe(0)
    expect(grid?.x_edges.at(-1)).toBe(2)
    expect(grid?.y_edges[0]).toBe(0)
    expect(grid?.y_edges.at(-1)).toBe(1)
    for (const edges of [grid?.x_edges ?? [], grid?.y_edges ?? []]) {
      const step = (edges[edges.length - 1] - edges[0]) / (edges.length - 1)
      edges.forEach((edge, index) => {
        expect(edge).toBeCloseTo(edges[0] + index * step, 6)
      })
    }
  })

  it('matches binHeadroomPoints cell edges for an explicit domain (no-drift invariant)', () => {
    const points = makeHeadroomPoints({ taskCount: 8 })
    const grid = buildHeadroomGrid(points, config)
    const sparse = binHeadroomPoints(points, config)
    for (const cell of sparse) {
      expect(grid?.x_edges[cell.x_bin_index]).toBe(cell.x_min)
      expect(grid?.x_edges[cell.x_bin_index + 1]).toBe(cell.x_max)
      expect(grid?.y_edges[cell.y_bin_index]).toBe(cell.y_min)
      expect(grid?.y_edges[cell.y_bin_index + 1]).toBe(cell.y_max)
    }
  })

  it('matches binHeadroomPoints cell edges when the x domain is left to default', () => {
    const points = makeHeadroomPoints({ taskCount: 8 })
    const defaultConfig: HeadroomBinConfig = { x_bin_count: 10, y_bin_count: 10 }
    const grid = buildHeadroomGrid(points, defaultConfig)
    const sparse = binHeadroomPoints(points, defaultConfig)
    for (const cell of sparse) {
      if (cell.facet_key !== UNFACETED_KEY) continue
      expect(grid?.x_edges[cell.x_bin_index]).toBe(cell.x_min)
      expect(grid?.x_edges[cell.x_bin_index + 1]).toBe(cell.x_max)
    }
  })
})

describe('buildHeadroomGrid counts', () => {
  it.each([[1], [21]])('accounts for every point at seed %d', seed => {
    const points = makeHeadroomPoints({ seed })
    const grid = buildHeadroomGrid(points, config)
    expect(grid).not.toBeNull()
    if (!grid) return
    for (const facet of grid.facets) {
      const denseTotal = facet.rows.flat().reduce((total, cell) => total + cell.count, 0)
      const modelPoints = points.filter(point => point.model === facet.facet_key)
      expect(denseTotal).toBe(modelPoints.length)
      expect(facet.point_count).toBe(modelPoints.length)
      expect(facet.rows.flat()).toHaveLength(config.x_bin_count * config.y_bin_count)
    }
    const overlayTotal = grid.overlay.rows
      .flat()
      .reduce((total, cell) => total + cell.count, 0)
    expect(overlayTotal).toBe(points.length)
  })

  it('fills empty cells with count 0 and the correct edges', () => {
    const grid = buildHeadroomGrid([makePoint()], config)
    expect(grid).not.toBeNull()
    if (!grid) return
    const facet = grid.facets[0]
    const emptyCells = facet.rows.flat().filter(cell => cell.count === 0)
    expect(emptyCells).toHaveLength(config.x_bin_count * config.y_bin_count - 1)
    for (const cell of emptyCells) {
      expect(cell.x_min).toBe(grid.x_edges[cell.x_bin_index])
      expect(cell.x_max).toBe(grid.x_edges[cell.x_bin_index + 1])
      expect(cell.y_min).toBe(grid.y_edges[cell.y_bin_index])
      expect(cell.y_max).toBe(grid.y_edges[cell.y_bin_index + 1])
    }
  })
})

describe('domain resolution', () => {
  it('defaults to the data extent', () => {
    const points = [
      makePoint({ achieved_compression_ratio: 0.3 }),
      makePoint({ achieved_compression_ratio: 1.8 }),
    ]
    expect(resolveXDomain(points, { x_bin_count: 10, y_bin_count: 10 })).toEqual([
      0.3, 1.8,
    ])
  })

  it('widens an all-equal extent to [v, v + 1] (fixture parity)', () => {
    const points = [makePoint(), makePoint({ task_id: 'HumanEval/1' })]
    const defaultConfig: HeadroomBinConfig = { x_bin_count: 4, y_bin_count: 4 }
    expect(resolveXDomain(points, defaultConfig)).toEqual([0.4, 1.4])
    const grid = buildHeadroomGrid(points, defaultConfig)
    const sparse = binHeadroomPoints(points, defaultConfig)
    for (const cell of sparse) {
      expect(grid?.x_edges[cell.x_bin_index]).toBe(cell.x_min)
      expect(grid?.x_edges[cell.x_bin_index + 1]).toBe(cell.x_max)
    }
  })

  it('passes an explicit domain through untouched', () => {
    expect(
      resolveXDomain([makePoint()], { ...config, x_domain: [0.5, 1.5] }),
    ).toEqual([0.5, 1.5])
  })
})

describe('domain clamping', () => {
  it('lands out-of-domain points in the edge bin and reports clamped_count', () => {
    const grid = buildHeadroomGrid(
      [makePoint({ achieved_compression_ratio: 99, mean_pass_rate: 1 })],
      config,
    )
    expect(grid?.clamped_count).toBe(1)
    const facet = grid?.facets[0]
    const lastRow = facet?.rows[config.y_bin_count - 1]
    expect(lastRow?.[config.x_bin_count - 1]?.count).toBe(1)
  })

  it('reports zero clamped points for in-domain data', () => {
    // Targets <= 1.0 keep achieved ratios (target * [0.75, 1.1]) inside [0, 2].
    const points = makeHeadroomPoints({ taskCount: 6, targetRatios: [0.25, 0.5, 1.0] })
    const grid = buildHeadroomGrid(points, config)
    expect(grid?.clamped_count).toBe(0)
  })
})

describe('color maxima', () => {
  it('splits per-facet and overlay maxima', () => {
    const points = makeHeadroomPoints({ seed: 1 })
    const grid = buildHeadroomGrid(points, config)
    expect(grid).not.toBeNull()
    if (!grid) return
    const perFacetMax = Math.max(
      ...grid.facets.flatMap(facet => facet.rows.flat().map(cell => cell.count)),
    )
    const overlayMax = Math.max(...grid.overlay.rows.flat().map(cell => cell.count))
    expect(grid.max_facet_count).toBe(perFacetMax)
    expect(grid.max_overlay_count).toBe(overlayMax)
    expect(grid.max_overlay_count).toBeGreaterThanOrEqual(grid.max_facet_count)
  })

  it('returns null for empty input', () => {
    expect(buildHeadroomGrid([], config)).toBeNull()
  })
})

describe('formatEdge', () => {
  it('derives precision from the step', () => {
    expect(formatEdge(0.4, 0.2)).toBe('0.4')
    expect(formatEdge(2, 0.2)).toBe('2.0')
    expect(formatEdge(1, 1)).toBe('1')
    expect(formatEdge(0.05, 0.05)).toBe('0.05')
  })

  it('caps precision at three decimals', () => {
    expect(formatEdge(0.00012, 0.0001)).toBe('0.000')
  })
})
