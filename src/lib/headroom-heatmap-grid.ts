import {
  binHeadroomPoints,
  UNFACETED_KEY,
  type HeadroomBinConfig,
  type HeadroomHeatmapCell,
  type HeadroomPoint,
} from '@/fixtures/heatmap'
import { round } from '@/fixtures/rng'

/** Matches the edge rounding baked into binHeadroomPoints' cells. */
const EDGE_DECIMALS = 6
const MAX_TICK_DECIMALS = 3

export type HeadroomFacetGrid = {
  facet_key: string
  point_count: number
  /** rows[y_bin_index][x_bin_index]; y ascending. Dense: every cell present, count 0 filled in. */
  rows: HeadroomHeatmapCell[][]
}

export type HeadroomGrid = {
  x_domain: [number, number]
  y_domain: [number, number]
  /** length x_bin_count + 1 */
  x_edges: number[]
  /** length y_bin_count + 1 */
  y_edges: number[]
  /** One per model, localeCompare order; excludes UNFACETED_KEY. */
  facets: HeadroomFacetGrid[]
  /** The UNFACETED_KEY facet: counts summed across models over the same grid. */
  overlay: HeadroomFacetGrid
  /** Color max across model facets (shared so equal color = equal count in every panel). */
  max_facet_count: number
  /** Color max for overlay mode; sums across models would wash out per-model facets. */
  max_overlay_count: number
  /** Points whose achieved ratio falls outside x_domain (clamped into edge bins). */
  clamped_count: number
}

/**
 * Mirrors the fixture default: data extent; min === max widens to [min, min + 1].
 * When config.x_domain is unset, points must be non-empty.
 */
export function resolveXDomain(
  points: HeadroomPoint[],
  config: HeadroomBinConfig,
): [number, number] {
  if (config.x_domain) return config.x_domain
  const values = points.map(point => point.achieved_compression_ratio)
  const min = Math.min(...values)
  const max = Math.max(...values)
  return min === max ? [min, min + 1] : [min, max]
}

function computeEdges(domain: [number, number], binCount: number): number[] {
  const step = (domain[1] - domain[0]) / binCount
  return Array.from({ length: binCount + 1 }, (_, index) =>
    round(domain[0] + index * step, EDGE_DECIMALS),
  )
}

function denseRows(
  facetKey: string,
  sparse: HeadroomHeatmapCell[],
  xEdges: number[],
  yEdges: number[],
): HeadroomHeatmapCell[][] {
  const xBinCount = xEdges.length - 1
  const yBinCount = yEdges.length - 1
  const rows = Array.from({ length: yBinCount }, (_, y) =>
    Array.from(
      { length: xBinCount },
      (_, x): HeadroomHeatmapCell => ({
        facet_key: facetKey,
        x_bin_index: x,
        x_min: xEdges[x],
        x_max: xEdges[x + 1],
        y_bin_index: y,
        y_min: yEdges[y],
        y_max: yEdges[y + 1],
        count: 0,
      }),
    ),
  )
  for (const cell of sparse) {
    rows[cell.y_bin_index][cell.x_bin_index] = cell
  }
  return rows
}

function maxCellCount(facets: HeadroomFacetGrid[]): number {
  let max = 0
  for (const facet of facets) {
    for (const row of facet.rows) {
      for (const cell of row) {
        if (cell.count > max) max = cell.count
      }
    }
  }
  return max
}

function countOutOfDomain(points: HeadroomPoint[], domain: [number, number]): number {
  const [min, max] = domain
  return points.filter(
    point =>
      point.achieved_compression_ratio < min || point.achieved_compression_ratio > max,
  ).length
}

/**
 * Dense-grid view-model over binHeadroomPoints (the frozen bin math). Owns
 * domain resolution so the fixture is always called with explicit domains,
 * then expands its sparse cells to a full grid with zero-count cells synthesized
 * from the same edges. Returns null when points is empty (empty-state panel).
 */
export function buildHeadroomGrid(
  points: HeadroomPoint[],
  config: HeadroomBinConfig,
): HeadroomGrid | null {
  if (points.length === 0) return null
  const x_domain = resolveXDomain(points, config)
  const y_domain: [number, number] = config.y_domain ?? [0, 1]
  const cells = binHeadroomPoints(points, {
    x_bin_count: config.x_bin_count,
    y_bin_count: config.y_bin_count,
    x_domain,
    y_domain,
  })
  const x_edges = computeEdges(x_domain, config.x_bin_count)
  const y_edges = computeEdges(y_domain, config.y_bin_count)

  const sparseByFacet = new Map<string, HeadroomHeatmapCell[]>()
  for (const cell of cells) {
    const list = sparseByFacet.get(cell.facet_key) ?? []
    list.push(cell)
    sparseByFacet.set(cell.facet_key, list)
  }

  const buildFacet = (facetKey: string): HeadroomFacetGrid => {
    const sparse = sparseByFacet.get(facetKey) ?? []
    return {
      facet_key: facetKey,
      point_count: sparse.reduce((total, cell) => total + cell.count, 0),
      rows: denseRows(facetKey, sparse, x_edges, y_edges),
    }
  }

  const facets = [...sparseByFacet.keys()]
    .filter(key => key !== UNFACETED_KEY)
    .sort((left, right) => left.localeCompare(right))
    .map(buildFacet)
  const overlay = buildFacet(UNFACETED_KEY)

  return {
    x_domain,
    y_domain,
    x_edges,
    y_edges,
    facets,
    overlay,
    max_facet_count: maxCellCount(facets),
    max_overlay_count: maxCellCount([overlay]),
    clamped_count: countOutOfDomain(points, x_domain),
  }
}

/** Tick label precision derives from the bin step, capped at 3 decimals. */
export function formatEdge(value: number, step: number): string {
  const decimals =
    step > 0
      ? Math.min(MAX_TICK_DECIMALS, Math.max(0, Math.ceil(-Math.log10(step))))
      : 0
  return value.toFixed(decimals)
}
