import 'server-only'

import artifact from '@/lib/delivery-parity-inventory.json'
import { getAggregatePage, getHeatmapPage } from '@/lib/aggregate-data'
import { FILTER_COLUMNS, GROUP_BY_COLUMNS, SORT_MEASURES } from '@/lib/aggregate-config'
import { parseAggregateState } from '@/lib/aggregate-params'
import { HEATMAP_AXES, HEATMAP_FILTER_COLUMNS } from '@/lib/heatmap-config'
import { parseHeatmapState } from '@/lib/heatmap-params'
import { getPredictionDetail } from '@/lib/prediction-detail'
import { fetchCompressionDistribution, fetchCorrectnessCompressionPoints, fetchDashboardRead } from '@/lib/read-layer'
import { getTableConfigs } from '@/lib/table-config'
import { getTablePage } from '@/lib/table-data'
import { parseTableState } from '@/lib/table-params'

type Plane = 'analysis' | 'detail'
type FrozenCase = Readonly<{
  id: string
  plane: Plane
  loader: 'dashboard' | 'distribution' | 'points' | 'table' | 'aggregate' | 'heatmap' | 'detail'
  table?: string
  input?: Record<string, string>
  state?: Record<string, unknown>
}>
export type ParityCase = Readonly<{ id: string; plane: Plane; execute: () => Promise<unknown> }>

/** Values promised by Whetstone's parity fixture projection, keyed by UI field. */
const FIXTURE_VALUE: Readonly<Record<string, string>> = {
  experiment_id: 'release_parity_', display_name: 'release_parity_',
  task_id: 'HumanEval/0', experiment_kind: 'humaneval_encdec', source: 'whetstone',
  model: 'fixture-model', result_state: 'passed', generation_status: 'success',
  scoring_status: 'success', budget: '0.5',
}
const OTHER = 'other'

function fixtureValue(column: string): string {
  const value = FIXTURE_VALUE[column]
  if (!value) throw new Error(`Parity fixture has no value contract for ${column}`)
  return value
}
function filterInputs(column: string, value = fixtureValue(column)): readonly [string, Record<string, string>][] {
  return [
    ['include', { [column]: value }],
    ['exclude', { [`exclude.${column}`]: OTHER }],
    ['combined', { [column]: value, [`exclude.${column}`]: OTHER }],
  ]
}

/**
 * A filter contributes one independent WHERE fragment and parameter sequence.
 * Pairing each directed include/exclude column combination therefore covers the
 * complete SQL-shape boundary without an exponential all-column product.
 */
function pairwiseFilterInputs(columns: readonly string[], valueFor: (column: string) => string): readonly [string, Record<string, string>][] {
  const pairs: [string, Record<string, string>][] = []
  for (const includeColumn of columns) for (const excludeColumn of columns) {
    if (includeColumn === excludeColumn) continue
    pairs.push([
      `pair/${includeColumn}/include-${excludeColumn}/exclude`,
      { [includeColumn]: valueFor(includeColumn), [`exclude.${excludeColumn}`]: OTHER },
    ])
  }
  return pairs
}

/** Derived from the production configuration; the checked-in artifact must equal this. */
export function deriveProductionParityInventory(): readonly FrozenCase[] {
  const expected: FrozenCase[] = [
    { id: 'dashboard/read', plane: 'analysis', loader: 'dashboard' },
    { id: 'dashboard/distribution', plane: 'analysis', loader: 'distribution' },
    { id: 'dashboard/points', plane: 'analysis', loader: 'points' },
  ]
  for (const config of getTableConfigs()) {
    const table = config.id
    const add = (suffix: string, input: Record<string, string> = {}) => expected.push({ id: `table/${table}/${suffix}`, plane: config.plane, loader: 'table', table, input })
    add('base'); add('include-test', { includeTestExps: 'true' }); add('page-2', { page: '2', pageSize: '1' })
    for (const column of config.columns) {
      if (column.filter === 'text') add(`text/${column.key}`, { [column.key]: fixtureValue(column.key) })
      if (column.filter === 'facet') for (const [variant, input] of filterInputs(column.key)) add(`facet/${column.key}/${variant}`, input)
      if (column.filter === 'range') {
        add(`range/${column.key}/min`, { [`${column.key}_min`]: '0' })
        add(`range/${column.key}/max`, { [`${column.key}_max`]: '1' })
        add(`range/${column.key}/min-max`, { [`${column.key}_min`]: '0', [`${column.key}_max`]: '1' })
      }
      if (column.sortable) for (const dir of ['asc', 'desc'] as const) {
        if (column.key === config.defaultSort.column && dir === config.defaultSort.direction) continue
        add(`sort/${column.key}/${dir}`, { sort: column.key, dir })
      }
    }
    const facetColumns = config.columns.filter(column => column.filter === 'facet').map(column => column.key)
    for (const [suffix, input] of pairwiseFilterInputs(facetColumns, fixtureValue)) add(`facet/${suffix}`, input)
    if (table !== 'experiments') add('text/budget', { budget: '0.5' })
  }
  for (const groupBy of GROUP_BY_COLUMNS) for (const sort of SORT_MEASURES) for (const dir of ['asc', 'desc'] as const) {
    const baseInput = { groupBy, sort, dir, page: '1', pageSize: '25' }
    for (const column of FILTER_COLUMNS) for (const [variant, input] of filterInputs(column)) {
      expected.push({ id: `aggregate/${groupBy}/${sort}/${dir}/${column}/${variant}`, plane: 'analysis', loader: 'aggregate', input: { ...baseInput, ...input } })
    }
    for (const [suffix, input] of pairwiseFilterInputs(FILTER_COLUMNS, fixtureValue)) {
      expected.push({ id: `aggregate/${groupBy}/${sort}/${dir}/${suffix}`, plane: 'analysis', loader: 'aggregate', input: { ...baseInput, ...input } })
    }
  }
  for (const x of HEATMAP_AXES) for (const y of HEATMAP_AXES) if (x !== y) for (const color of SORT_MEASURES) {
    const baseInput = { x, y, color }
    const valueFor = fixtureValue
    for (const column of HEATMAP_FILTER_COLUMNS) for (const [variant, input] of filterInputs(column, valueFor(column))) {
      expected.push({ id: `heatmap/${x}/${y}/${color}/${column}/${variant}`, plane: 'analysis', loader: 'heatmap', input: { ...baseInput, ...input } })
    }
    for (const [suffix, input] of pairwiseFilterInputs(HEATMAP_FILTER_COLUMNS, valueFor)) {
      expected.push({ id: `heatmap/${x}/${y}/${color}/${suffix}`, plane: 'analysis', loader: 'heatmap', input: { ...baseInput, ...input } })
    }
  }
  expected.push({ id: 'detail/read', plane: 'detail', loader: 'detail' })
  return expected
}

export const FROZEN_PRODUCTION_PARITY_INVENTORY = artifact as readonly FrozenCase[]

function execute(item: FrozenCase, predictionId: string): Promise<unknown> {
  switch (item.loader) {
    case 'dashboard': return fetchDashboardRead()
    case 'distribution': return fetchCompressionDistribution()
    case 'points': return fetchCorrectnessCompressionPoints()
    case 'table': return getTablePage(item.table!, item.input ?? {})
    case 'aggregate': return getAggregatePage(parseAggregateState(item.input ?? {}))
    case 'heatmap': return getHeatmapPage(parseHeatmapState(item.input ?? {}))
    case 'detail': return getPredictionDetail(predictionId)
  }
}

/** The production parser's canonical state for a checked-in parity case. */
export function normalizeProductionParityCase(item: FrozenCase): unknown {
  switch (item.loader) {
    case 'table': return { table: item.table, state: parseTableState(getTableConfigs().find(config => config.id === item.table)!, item.input ?? {}) }
    case 'aggregate': return parseAggregateState(item.input ?? {})
    case 'heatmap': return parseHeatmapState(item.input ?? {})
    case 'detail': return { predictionId: 'fixture' }
    default: return undefined
  }
}

export const FROZEN_PRODUCTION_PARITY_CASES: readonly ParityCase[] = FROZEN_PRODUCTION_PARITY_INVENTORY.map(item => ({ id: item.id, plane: item.plane, execute: () => execute(item, 'fixture') }))

/** Whetstone's frozen fixture derives its accepted prediction identity from run_id. */
export function executeFrozenParityCase(item: ParityCase, fixturePredictionId: string): Promise<unknown> {
  const frozen = FROZEN_PRODUCTION_PARITY_INVENTORY.find(candidate => candidate.id === item.id)
  if (!frozen) throw new Error(`Frozen parity case is missing: ${item.id}`)
  return execute(frozen, fixturePredictionId)
}

export function assertParityInventory(
  inventory: readonly FrozenCase[],
): void {
  const expected = deriveProductionParityInventory()
  if (JSON.stringify(inventory) !== JSON.stringify(expected)) {
    throw new Error('Frozen parity inventory differs from production loader configuration')
  }
  if (new Set(expected.map(item => item.id)).size !== expected.length) throw new Error('Frozen parity inventory has duplicate cases')
}

export function assertFrozenParityInventory(): void {
  assertParityInventory(FROZEN_PRODUCTION_PARITY_INVENTORY)
}
