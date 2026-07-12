import 'server-only'

import { getAggregatePage, getHeatmapPage } from '@/lib/aggregate-data'
import { GROUP_BY_COLUMNS, SORT_MEASURES } from '@/lib/aggregate-config'
import { HEATMAP_AXES } from '@/lib/heatmap-config'
import { getPredictionDetail } from '@/lib/prediction-detail'
import { fetchCompressionDistribution, fetchCorrectnessCompressionPoints, fetchDashboardRead } from '@/lib/read-layer'
import { getTableConfigs } from '@/lib/table-config'
import { getTablePage } from '@/lib/table-data'

export type ParityCase = Readonly<{ id: string; plane: 'analysis' | 'detail'; execute: () => Promise<unknown> }>

const VALUE = 'fixture'
const base = { hideTestExperiments: false }

function tableCases(): ParityCase[] {
  return getTableConfigs().flatMap(config => {
    const cases: ParityCase[] = [
      { id: `table/${config.id}/base`, plane: config.plane, execute: () => getTablePage(config.id, {}) },
      { id: `table/${config.id}/include-test`, plane: config.plane, execute: () => getTablePage(config.id, { includeTestExperiments: 'true' }) },
      { id: `table/${config.id}/page-2`, plane: config.plane, execute: () => getTablePage(config.id, { page: '2', pageSize: '1' }) },
    ]
    for (const column of config.columns) {
      if (column.filter === 'text') cases.push({ id: `table/${config.id}/text/${column.key}`, plane: config.plane, execute: () => getTablePage(config.id, { [column.key]: VALUE }) })
      if (column.filter === 'facet') for (const prefix of ['', 'exclude_']) cases.push({ id: `table/${config.id}/${prefix ? 'exclude' : 'include'}/${column.key}`, plane: config.plane, execute: () => getTablePage(config.id, { [`${prefix}${column.key}`]: VALUE }) })
      if (column.filter === 'range') for (const suffix of ['min', 'max', 'min-max'] as const) cases.push({ id: `table/${config.id}/range/${column.key}/${suffix}`, plane: config.plane, execute: () => getTablePage(config.id, suffix === 'min-max' ? { [`${column.key}_min`]: '0', [`${column.key}_max`]: '1' } : { [`${column.key}_${suffix}`]: suffix === 'min' ? '0' : '1' }) })
      if (column.sortable) for (const dir of ['asc', 'desc'] as const) cases.push({ id: `table/${config.id}/sort/${column.key}/${dir}`, plane: config.plane, execute: () => getTablePage(config.id, { sort: column.key, dir }) })
    }
    // Budget is a production filter even though it is not a table column.
    if (config.id !== 'experiments') cases.push({ id: `table/${config.id}/text/budget`, plane: config.plane, execute: () => getTablePage(config.id, { budget: '0.5' }) })
    return cases
  })
}

function aggregateCases(): ParityCase[] {
  const cases: ParityCase[] = []
  for (const groupBy of GROUP_BY_COLUMNS) for (const sort of SORT_MEASURES) for (const dir of ['asc', 'desc'] as const) {
    const filterVariants: Record<string, string[]>[] = [{}, { model: [VALUE] }, { experiment_kind: [VALUE] }]
    for (const filters of filterVariants) {
      const id = `aggregate/${groupBy}/${sort}/${dir}/${Object.keys(filters)[0] ?? 'none'}`
      cases.push({ id, plane: 'analysis', execute: () => getAggregatePage({ groupBy: [groupBy], sort, dir, page: 1, pageSize: 25, filterIn: filters, filterOut: filters, ...base }) })
    }
  }
  return cases
}

function heatmapCases(): ParityCase[] {
  const cases: ParityCase[] = []
  for (const x of HEATMAP_AXES) for (const y of HEATMAP_AXES) if (x !== y) for (const color of SORT_MEASURES) {
    const filterVariants: Record<string, string[]>[] = [{}, { model: [VALUE] }, { task_id: [VALUE] }, { experiment_kind: [VALUE] }, { budget: ['0.5'] }]
    for (const filters of filterVariants) {
      cases.push({ id: `heatmap/${x}/${y}/${color}/${Object.keys(filters)[0] ?? 'none'}`, plane: 'analysis', execute: () => getHeatmapPage({ x, y, color, filterIn: filters, filterOut: filters, ...base }) })
    }
  }
  return cases
}

export const FROZEN_PRODUCTION_PARITY_CASES: readonly ParityCase[] = [
  { id: 'dashboard/read', plane: 'analysis', execute: () => fetchDashboardRead() },
  { id: 'dashboard/distribution', plane: 'analysis', execute: () => fetchCompressionDistribution() },
  { id: 'dashboard/points', plane: 'analysis', execute: () => fetchCorrectnessCompressionPoints() },
  ...tableCases(), ...aggregateCases(), ...heatmapCases(),
  { id: 'detail/prediction-id', plane: 'detail', execute: () => getPredictionDetail('fixture') },
]

/** Whetstone's frozen fixture derives its accepted prediction identity from run_id. */
export function executeFrozenParityCase(item: ParityCase, runId: string): Promise<unknown> {
  return item.id === 'detail/prediction-id'
    ? getPredictionDetail(`release_parity_${runId}_prediction`)
    : item.execute()
}

/** A frozen inventory must name every option family; this makes config drift fail CI. */
export function assertFrozenParityInventory(): void {
  const ids = FROZEN_PRODUCTION_PARITY_CASES.map(item => item.id)
  if (new Set(ids).size !== ids.length || ids.length < 350) throw new Error('Production parity inventory is incomplete')
  for (const config of getTableConfigs()) for (const column of config.columns) {
    if (column.filter && !ids.some(id => id.includes(`/${column.key}`))) throw new Error(`Missing parity variant for ${config.id}.${column.key}`)
    if (column.sortable && !ids.some(id => id.includes(`/sort/${column.key}/`))) throw new Error(`Missing parity sort for ${config.id}.${column.key}`)
  }
}
