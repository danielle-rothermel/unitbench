import { arrayMove } from '@dnd-kit/sortable'
import type { SortMeasure } from '@/lib/aggregate-config'
import type { HeatmapAxis } from '@/lib/heatmap-config'
import type { TableRow } from '@/lib/table-data'

export type HeatmapCell = {
  value: number | null
  n: number
}

export type HeatmapPivot = {
  cellMap: Map<string, Map<string, HeatmapCell>>
  naturalColOrder: string[]
  naturalRowOrder: string[]
}

function isFiniteScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseScore(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function computeDefaultColOrder(xSet: Set<string>): string[] {
  return [...xSet].sort()
}

export function computeDefaultRowOrder(
  cellMap: Map<string, Map<string, HeatmapCell>>,
  colOrder: string[],
): string[] {
  return [...cellMap.keys()].sort((left, right) => {
    const leftValues = colOrder
      .map(xVal => cellMap.get(left)?.get(xVal)?.value)
      .filter(isFiniteScore)
    const rightValues = colOrder
      .map(xVal => cellMap.get(right)?.get(xVal)?.value)
      .filter(isFiniteScore)
    const leftMin =
      leftValues.length > 0 ? Math.min(...leftValues) : Number.POSITIVE_INFINITY
    const rightMin =
      rightValues.length > 0 ? Math.min(...rightValues) : Number.POSITIVE_INFINITY
    if (leftMin !== rightMin) return leftMin - rightMin
    return left.localeCompare(right)
  })
}

export function buildHeatmapPivot(
  rows: TableRow[],
  yAxis: HeatmapAxis,
  xAxis: HeatmapAxis,
  colorMeasure: SortMeasure,
): HeatmapPivot {
  const xSet = new Set<string>()
  const cellMap = new Map<string, Map<string, HeatmapCell>>()

  for (const row of rows) {
    const yVal = String(row[yAxis] ?? '')
    const xVal = String(row[xAxis] ?? '')
    if (!yVal || !xVal) continue
    xSet.add(xVal)
    const value = parseScore(row[colorMeasure])
    const nRaw = row.n
    const n =
      typeof nRaw === 'number'
        ? nRaw
        : Number.parseInt(String(nRaw ?? '0'), 10) || 0
    if (!cellMap.has(yVal)) cellMap.set(yVal, new Map())
    cellMap.get(yVal)?.set(xVal, { value, n })
  }

  const naturalColOrder = computeDefaultColOrder(xSet)
  const naturalRowOrder = computeDefaultRowOrder(cellMap, naturalColOrder)

  return { cellMap, naturalColOrder, naturalRowOrder }
}

/** Category keys must not contain literal commas (see heatmap-params). */
export function applyManualOrder(
  natural: string[],
  manual?: string[],
): string[] {
  if (!manual || manual.length === 0) return natural

  const naturalSet = new Set(natural)
  const ordered = manual.filter(key => naturalSet.has(key))
  for (const key of natural) {
    if (!ordered.includes(key)) ordered.push(key)
  }
  return ordered
}

export function resolveAxisOrders(
  pivot: HeatmapPivot,
  rowOrder?: string[],
  colOrder?: string[],
): {
  yValues: string[]
  xValues: string[]
  cells: Map<string, Map<string, HeatmapCell>>
} {
  const xValues = applyManualOrder(pivot.naturalColOrder, colOrder)
  const yValues = applyManualOrder(pivot.naturalRowOrder, rowOrder)
  return { yValues, xValues, cells: pivot.cellMap }
}

export function ordersEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

export function moveItem(
  list: string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  return arrayMove(list, fromIndex, toIndex)
}

export function manualOrderOrUndefined(
  current: string[],
  natural: string[],
): string[] | undefined {
  return ordersEqual(current, natural) ? undefined : current
}
