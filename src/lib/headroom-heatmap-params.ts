import type { HeadroomBinConfig } from '@/fixtures/heatmap'
import type { SearchParamsRecord } from '@/lib/aggregate-filters'

export type HeadroomViewMode = 'facets' | 'overlay'

/**
 * URL-owned state for the /dev/headroom-heatmap demo (R6). Bin-count and
 * domain fields keep the fixture's snake_case names so toBinConfig is a
 * near-identity projection into HeadroomBinConfig.
 */
export type HeadroomHeatmapState = {
  view: HeadroomViewMode
  /** Clamped to [MIN_HEADROOM_BIN_COUNT, MAX_HEADROOM_BIN_COUNT]. */
  x_bin_count: number
  y_bin_count: number
  /** Unset = data extent (resolved by the grid helper). */
  x_domain?: [number, number]
  /** Manual facet order; keys are canonical model labels and must not contain literal commas. */
  facetOrder?: string[]
  /** Demo fixture seed. */
  seed: number
}

export const HEADROOM_HEATMAP_PATH = '/dev/headroom-heatmap'
export const DEFAULT_HEADROOM_VIEW: HeadroomViewMode = 'facets'
export const DEFAULT_HEADROOM_BIN_COUNT = 10
export const MIN_HEADROOM_BIN_COUNT = 2
export const MAX_HEADROOM_BIN_COUNT = 50
export const DEFAULT_HEADROOM_SEED = 1

/** Colon keeps '.' free for decimals and '-' free for future negative domains. */
const X_DOMAIN_SEPARATOR = ':'

function firstValue(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw
}

function parseView(raw: string | string[] | undefined): HeadroomViewMode {
  const value = firstValue(raw)
  return value === 'overlay' ? 'overlay' : DEFAULT_HEADROOM_VIEW
}

function parseBinCount(raw: string | string[] | undefined): number {
  const value = firstValue(raw)
  if (!value) return DEFAULT_HEADROOM_BIN_COUNT
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return DEFAULT_HEADROOM_BIN_COUNT
  return Math.min(MAX_HEADROOM_BIN_COUNT, Math.max(MIN_HEADROOM_BIN_COUNT, parsed))
}

function parseSeed(raw: string | string[] | undefined): number {
  const value = firstValue(raw)
  if (!value) return DEFAULT_HEADROOM_SEED
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : DEFAULT_HEADROOM_SEED
}

function toFiniteNumber(text: string | undefined): number | undefined {
  if (!text || text.trim() === '') return undefined
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Needs two finite floats with min < max (e.g. '0:2'); anything else is unset. */
function parseXDomain(raw: string | string[] | undefined): [number, number] | undefined {
  const value = firstValue(raw)
  if (!value) return undefined
  const parts = value.split(X_DOMAIN_SEPARATOR)
  if (parts.length !== 2) return undefined
  const min = toFiniteNumber(parts[0])
  const max = toFiniteNumber(parts[1])
  if (min === undefined || max === undefined || min >= max) return undefined
  return [min, max]
}

/** Comma-joined facet keys; keys must not contain literal commas. */
function parseFacetOrder(raw: string | string[] | undefined): string[] | undefined {
  const value = firstValue(raw)
  if (!value) return undefined
  const keys = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
  return keys.length > 0 ? keys : undefined
}

export function parseHeadroomHeatmapState(input: SearchParamsRecord): HeadroomHeatmapState {
  const xDomain = parseXDomain(input.xDomain)
  const facetOrder = parseFacetOrder(input.facetOrder)
  return {
    view: parseView(input.view),
    x_bin_count: parseBinCount(input.xBins),
    y_bin_count: parseBinCount(input.yBins),
    ...(xDomain ? { x_domain: xDomain } : {}),
    ...(facetOrder ? { facetOrder } : {}),
    seed: parseSeed(input.seed),
  }
}

/** Defaults are omitted so the bare route stays the canonical URL. */
export function buildHeadroomHeatmapQuery(state: HeadroomHeatmapState): URLSearchParams {
  const params = new URLSearchParams()
  if (state.view !== DEFAULT_HEADROOM_VIEW) params.set('view', state.view)
  if (state.x_bin_count !== DEFAULT_HEADROOM_BIN_COUNT) {
    params.set('xBins', String(state.x_bin_count))
  }
  if (state.y_bin_count !== DEFAULT_HEADROOM_BIN_COUNT) {
    params.set('yBins', String(state.y_bin_count))
  }
  if (state.x_domain) {
    params.set('xDomain', state.x_domain.join(X_DOMAIN_SEPARATOR))
  }
  if (state.facetOrder && state.facetOrder.length > 0) {
    params.set('facetOrder', state.facetOrder.join(','))
  }
  if (state.seed !== DEFAULT_HEADROOM_SEED) params.set('seed', String(state.seed))
  return params
}

export function headroomHeatmapHref(state: HeadroomHeatmapState): string {
  const query = buildHeadroomHeatmapQuery(state).toString()
  return query ? `${HEADROOM_HEATMAP_PATH}?${query}` : HEADROOM_HEATMAP_PATH
}

/** Y is semantically pass rate, so its domain is hard-coded to [0, 1]. */
export function toBinConfig(state: HeadroomHeatmapState): HeadroomBinConfig {
  return {
    x_bin_count: state.x_bin_count,
    y_bin_count: state.y_bin_count,
    ...(state.x_domain ? { x_domain: state.x_domain } : {}),
    y_domain: [0, 1],
  }
}
