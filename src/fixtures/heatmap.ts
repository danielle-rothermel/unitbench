import {
  FIXTURE_MODELS,
  FIXTURE_TARGET_RATIOS,
  fixtureTaskIds,
  type ExperimentKind,
} from '@/fixtures/primitives'
import { createRng, floatBetween, round } from '@/fixtures/rng'

/** One task × model × target group — the unit that gets binned (R6). */
export type HeadroomPoint = {
  /** Facet key (canonical label). */
  model: string
  task_id: string
  experiment_kind: ExperimentKind
  /** The knob; null for direct baseline points. */
  target_compression_ratio: number | null
  /** X: mean realized ratio across the group's samples. */
  achieved_compression_ratio: number
  /** Y: mean pass/fail across the group's N samples. */
  mean_pass_rate: number
  n_samples: number
}

export type HeadroomBinConfig = {
  x_bin_count: number
  y_bin_count: number
  /** Default: data extent. */
  x_domain?: [number, number]
  /** Default: [0, 1]. */
  y_domain?: [number, number]
}

/** Render contract — produced by binHeadroomPoints, consumed by the component. */
export type HeadroomHeatmapCell = {
  /** Model, or 'all' when unfaceted. */
  facet_key: string
  x_bin_index: number
  x_min: number
  x_max: number
  y_bin_index: number
  y_min: number
  y_max: number
  /** Task count in the cell (color). */
  count: number
}

export const UNFACETED_KEY = 'all'

export type HeadroomFixtureOptions = {
  seed?: number
  models?: readonly string[]
  taskCount?: number
  targetRatios?: readonly number[]
  samplesPerGroup?: number
}

export function makeHeadroomPoints(options: HeadroomFixtureOptions = {}): HeadroomPoint[] {
  const {
    seed = 1,
    models = FIXTURE_MODELS,
    taskCount = 40,
    targetRatios = FIXTURE_TARGET_RATIOS,
    samplesPerGroup = 3,
  } = options
  const rng = createRng(seed)
  const points: HeadroomPoint[] = []
  for (const model of models) {
    for (const task_id of fixtureTaskIds(taskCount)) {
      const taskSkill = floatBetween(rng, 0.15, 0.95)
      for (const target of targetRatios) {
        const achieved = round(target * floatBetween(rng, 0.75, 1.1), 4)
        // Pass rate degrades as compression tightens (lower achieved ratio)
        const headroom = Math.min(1, taskSkill * (0.5 + Math.min(achieved, 1.2) / 2))
        const passes = Math.round(headroom * samplesPerGroup + (rng() - 0.5))
        points.push({
          model,
          task_id,
          experiment_kind: 'humaneval_encdec',
          target_compression_ratio: target,
          achieved_compression_ratio: achieved,
          mean_pass_rate: round(
            Math.max(0, Math.min(samplesPerGroup, passes)) / samplesPerGroup,
            4,
          ),
          n_samples: samplesPerGroup,
        })
      }
    }
  }
  return points
}

function dataExtent(values: number[]): [number, number] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  return min === max ? [min, min + 1] : [min, max]
}

function binIndex(value: number, domain: [number, number], binCount: number): number {
  const [min, max] = domain
  const clamped = Math.max(min, Math.min(max, value))
  const index = Math.floor(((clamped - min) / (max - min)) * binCount)
  return Math.min(index, binCount - 1)
}

/**
 * Bin points into per-facet cells; empty cells are omitted. Facets are one
 * cell set per model plus an UNFACETED_KEY set over all points. Facet labels
 * can contain spaces ("encoder -> decoder"), so counts are keyed on nested
 * maps rather than a delimited string.
 */
export function binHeadroomPoints(
  points: HeadroomPoint[],
  config: HeadroomBinConfig,
): HeadroomHeatmapCell[] {
  if (points.length === 0) return []
  const xDomain =
    config.x_domain ?? dataExtent(points.map(point => point.achieved_compression_ratio))
  const yDomain: [number, number] = config.y_domain ?? [0, 1]
  const xStep = (xDomain[1] - xDomain[0]) / config.x_bin_count
  const yStep = (yDomain[1] - yDomain[0]) / config.y_bin_count

  const counts = new Map<string, Map<number, Map<number, number>>>()
  for (const point of points) {
    const x = binIndex(point.achieved_compression_ratio, xDomain, config.x_bin_count)
    const y = binIndex(point.mean_pass_rate, yDomain, config.y_bin_count)
    for (const facet of [point.model, UNFACETED_KEY]) {
      const facetCounts = counts.get(facet) ?? new Map<number, Map<number, number>>()
      const columnCounts = facetCounts.get(x) ?? new Map<number, number>()
      columnCounts.set(y, (columnCounts.get(y) ?? 0) + 1)
      facetCounts.set(x, columnCounts)
      counts.set(facet, facetCounts)
    }
  }

  const cells: HeadroomHeatmapCell[] = []
  for (const [facet_key, facetCounts] of counts) {
    for (const [x_bin_index, columnCounts] of facetCounts) {
      for (const [y_bin_index, count] of columnCounts) {
        cells.push({
          facet_key,
          x_bin_index,
          x_min: round(xDomain[0] + x_bin_index * xStep, 6),
          x_max: round(xDomain[0] + (x_bin_index + 1) * xStep, 6),
          y_bin_index,
          y_min: round(yDomain[0] + y_bin_index * yStep, 6),
          y_max: round(yDomain[0] + (y_bin_index + 1) * yStep, 6),
          count,
        })
      }
    }
  }
  return cells
}
