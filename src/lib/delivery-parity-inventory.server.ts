import 'server-only'

import artifact from '@/lib/delivery-parity-inventory.json'
import { getAggregatePage, getHeatmapPage } from '@/lib/aggregate-data'
import { FILTER_COLUMNS, GROUP_BY_COLUMNS, SORT_MEASURES } from '@/lib/aggregate-config'
import { HEATMAP_AXES, HEATMAP_FILTER_COLUMNS } from '@/lib/heatmap-config'
import { getPredictionDetail } from '@/lib/prediction-detail'
import { fetchCompressionDistribution, fetchCorrectnessCompressionPoints, fetchDashboardRead } from '@/lib/read-layer'
import { getTableConfigs } from '@/lib/table-config'
import { getTablePage } from '@/lib/table-data'

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

const VALUE = 'fixture'
const OTHER = 'other'
const base = { hideTestExperiments: false }
const filterVariants = (column: string, value = VALUE) => [
  ['empty', {}, {}],
  ['include', { [column]: [value] }, {}],
  ['exclude', {}, { [column]: [OTHER] }],
  ['combined', { [column]: [value] }, { [column]: [OTHER] }],
] as const

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
    add('base'); add('include-test', { includeTestExperiments: 'true' }); add('page-2', { page: '2', pageSize: '1' })
    for (const column of config.columns) {
      if (column.filter === 'text') add(`text/${column.key}`, { [column.key]: VALUE })
      if (column.filter === 'facet') for (const [variant, include, exclude] of filterVariants(column.key)) {
        const input: Record<string, string> = {}
        if (Object.keys(include).length) input[column.key] = VALUE
        if (Object.keys(exclude).length) input[`exclude_${column.key}`] = OTHER
        if (variant === 'empty') input[column.key] = ''
        add(`facet/${column.key}/${variant}`, input)
      }
      if (column.filter === 'range') {
        add(`range/${column.key}/min`, { [`${column.key}_min`]: '0' })
        add(`range/${column.key}/max`, { [`${column.key}_max`]: '1' })
        add(`range/${column.key}/min-max`, { [`${column.key}_min`]: '0', [`${column.key}_max`]: '1' })
      }
      if (column.sortable) { add(`sort/${column.key}/asc`, { sort: column.key, dir: 'asc' }); add(`sort/${column.key}/desc`, { sort: column.key, dir: 'desc' }) }
    }
    if (table !== 'experiments') add('text/budget', { budget: '0.5' })
  }
  for (const groupBy of GROUP_BY_COLUMNS) for (const sort of SORT_MEASURES) for (const dir of ['asc', 'desc'] as const) for (const column of FILTER_COLUMNS) for (const [variant, filterIn, filterOut] of filterVariants(column)) {
    expected.push({ id: `aggregate/${groupBy}/${sort}/${dir}/${column}/${variant}`, plane: 'analysis', loader: 'aggregate', state: { groupBy: [groupBy], sort, dir, page: 1, pageSize: 25, filterIn, filterOut, ...base } })
  }
  for (const x of HEATMAP_AXES) for (const y of HEATMAP_AXES) if (x !== y) for (const color of SORT_MEASURES) for (const column of HEATMAP_FILTER_COLUMNS) for (const [variant, filterIn, filterOut] of filterVariants(column, column === 'budget' ? '0.5' : VALUE)) {
    expected.push({ id: `heatmap/${x}/${y}/${color}/${column}/${variant}`, plane: 'analysis', loader: 'heatmap', state: { x, y, color, filterIn, filterOut, ...base } })
  }
  for (const path of ['identity', 'generation-runs', 'node-attempts', 'score-attempts', 'score-harness-failures', 'platform-attempts']) expected.push({ id: `detail/${path}`, plane: 'detail', loader: 'detail' })
  return expected
}

export const FROZEN_PRODUCTION_PARITY_INVENTORY = artifact as readonly FrozenCase[]

function execute(item: FrozenCase, predictionId: string): Promise<unknown> {
  switch (item.loader) {
    case 'dashboard': return fetchDashboardRead()
    case 'distribution': return fetchCompressionDistribution()
    case 'points': return fetchCorrectnessCompressionPoints()
    case 'table': return getTablePage(item.table!, item.input ?? {})
    case 'aggregate': return getAggregatePage(item.state as Parameters<typeof getAggregatePage>[0])
    case 'heatmap': return getHeatmapPage(item.state as Parameters<typeof getHeatmapPage>[0])
    case 'detail': return getPredictionDetail(predictionId)
  }
}

export const FROZEN_PRODUCTION_PARITY_CASES: readonly ParityCase[] = FROZEN_PRODUCTION_PARITY_INVENTORY.map(item => ({ id: item.id, plane: item.plane, execute: () => execute(item, 'fixture') }))

/** Whetstone's frozen fixture derives its accepted prediction identity from run_id. */
export function executeFrozenParityCase(item: ParityCase, runId: string): Promise<unknown> {
  const frozen = FROZEN_PRODUCTION_PARITY_INVENTORY.find(candidate => candidate.id === item.id)
  if (!frozen) throw new Error(`Frozen parity case is missing: ${item.id}`)
  return execute(frozen, `release_parity_${runId}_prediction`)
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
