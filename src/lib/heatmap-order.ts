import { arrayMove } from '@dnd-kit/sortable'
import type { SortMeasure } from '@/lib/aggregate-config'
import {
  AXIS_VALUE_ORDERS,
  type HeatmapAxis,
} from '@/lib/heatmap-config'
import type { AxisOrderSpec } from '@/lib/heatmap-params'
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

export type ResolveAxisOrdersInput = {
  yAxis: HeatmapAxis
  xAxis: HeatmapAxis
  colorMeasure: SortMeasure
  rowSort?: AxisOrderSpec
  colSort?: AxisOrderSpec
  rowOrder?: string[]
  colOrder?: string[]
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

/** Known values first (declared order); unknown categories appended in localeCompare order. */
export function orderByDeclaredValues(
  categories: string[],
  declaredOrder: readonly string[],
): string[] {
  const categorySet = new Set(categories)
  const known = new Set(declaredOrder)
  const ordered = declaredOrder.filter(value => categorySet.has(value))
  const unknown = [...categories]
    .filter(value => !known.has(value))
    .sort((left, right) => left.localeCompare(right))
  return [...ordered, ...unknown]
}

function meanMeasureForRow(
  yVal: string,
  colOrder: string[],
  cellMap: Map<string, Map<string, HeatmapCell>>,
): number {
  const row = cellMap.get(yVal)
  const values = colOrder
    .map(xVal => row?.get(xVal)?.value)
    .filter(isFiniteScore)
  if (values.length === 0) return Number.NaN
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function meanMeasureForCol(
  xVal: string,
  rowOrder: string[],
  cellMap: Map<string, Map<string, HeatmapCell>>,
): number {
  const values = rowOrder
    .map(yVal => cellMap.get(yVal)?.get(xVal)?.value)
    .filter(isFiniteScore)
  if (values.length === 0) return Number.NaN
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function orderByMeasure(
  categories: string[],
  pivot: HeatmapPivot,
  colorMeasure: SortMeasure,
  axis: 'row' | 'col',
  direction: 'asc' | 'desc',
): string[] {
  void colorMeasure
  const means = new Map<string, number>()
  for (const category of categories) {
    const mean =
      axis === 'row'
        ? meanMeasureForRow(category, pivot.naturalColOrder, pivot.cellMap)
        : meanMeasureForCol(category, pivot.naturalRowOrder, pivot.cellMap)
    means.set(category, mean)
  }

  const missing = direction === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY

  return [...categories].sort((left, right) => {
    const leftMean = means.get(left) ?? missing
    const rightMean = means.get(right) ?? missing
    const leftFinite = Number.isFinite(leftMean)
    const rightFinite = Number.isFinite(rightMean)
    if (!leftFinite && !rightFinite) return left.localeCompare(right)
    if (!leftFinite) return 1
    if (!rightFinite) return -1
    if (leftMean !== rightMean) {
      return direction === 'asc' ? leftMean - rightMean : rightMean - leftMean
    }
    return left.localeCompare(right)
  })
}

export function deriveGroupKey(
  category: string,
  axis: HeatmapAxis,
  groupBy: 'provider' | 'experiment_kind',
): string {
  if (groupBy === 'provider') {
    if (axis !== 'model') return category
    const slash = category.indexOf('/')
    return slash >= 0 ? category.slice(0, slash) : category
  }
  if (axis === 'experiment_kind') {
    if (category.includes('_direct')) return 'direct'
    if (category.includes('_encdec')) return 'encdec'
  }
  return category
}

export function orderByGroup(
  categories: string[],
  axis: HeatmapAxis,
  pivot: HeatmapPivot,
  colorMeasure: SortMeasure,
  rowOrCol: 'row' | 'col',
  groupBy: 'provider' | 'experiment_kind',
  direction: 'asc' | 'desc',
): string[] {
  const groupKeys = new Map(
    categories.map(category => [
      category,
      deriveGroupKey(category, axis, groupBy),
    ]),
  )
  const means = new Map<string, number>()
  for (const category of categories) {
    means.set(
      category,
      rowOrCol === 'row'
        ? meanMeasureForRow(category, pivot.naturalColOrder, pivot.cellMap)
        : meanMeasureForCol(category, pivot.naturalRowOrder, pivot.cellMap),
    )
  }

  return [...categories].sort((left, right) => {
    const leftGroup = groupKeys.get(left) ?? left
    const rightGroup = groupKeys.get(right) ?? right
    const groupCompare = leftGroup.localeCompare(rightGroup)
    if (groupCompare !== 0) {
      return direction === 'asc' ? groupCompare : -groupCompare
    }

    const leftMean = means.get(left) ?? Number.POSITIVE_INFINITY
    const rightMean = means.get(right) ?? Number.POSITIVE_INFINITY
    if (Number.isFinite(leftMean) && Number.isFinite(rightMean) && leftMean !== rightMean) {
      return leftMean - rightMean
    }
    return left.localeCompare(right)
  })
}

export function computeRuleOrder(
  categories: string[],
  naturalOrder: string[],
  spec: AxisOrderSpec,
  axis: HeatmapAxis,
  pivot: HeatmapPivot,
  colorMeasure: SortMeasure,
  rowOrCol: 'row' | 'col',
): string[] {
  switch (spec.kind) {
    case 'value': {
      const declared = AXIS_VALUE_ORDERS[axis]
      if (!declared) return naturalOrder
      return orderByDeclaredValues(categories, declared)
    }
    case 'measure':
      return orderByMeasure(
        categories,
        pivot,
        colorMeasure,
        rowOrCol,
        spec.direction,
      )
    case 'group':
      return orderByGroup(
        categories,
        axis,
        pivot,
        colorMeasure,
        rowOrCol,
        spec.groupBy,
        spec.direction,
      )
  }
}

export function computeAxisBaseline(
  pivot: HeatmapPivot,
  naturalOrder: string[],
  spec: AxisOrderSpec | undefined,
  axis: HeatmapAxis,
  colorMeasure: SortMeasure,
  rowOrCol: 'row' | 'col',
): string[] {
  if (!spec) return naturalOrder
  return computeRuleOrder(
    naturalOrder,
    naturalOrder,
    spec,
    axis,
    pivot,
    colorMeasure,
    rowOrCol,
  )
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
  input: ResolveAxisOrdersInput,
): {
  yValues: string[]
  xValues: string[]
  yBaseline: string[]
  xBaseline: string[]
  cells: Map<string, Map<string, HeatmapCell>>
} {
  const yBaseline = computeAxisBaseline(
    pivot,
    pivot.naturalRowOrder,
    input.rowSort,
    input.yAxis,
    input.colorMeasure,
    'row',
  )
  const xBaseline = computeAxisBaseline(
    pivot,
    pivot.naturalColOrder,
    input.colSort,
    input.xAxis,
    input.colorMeasure,
    'col',
  )
  const yValues = applyManualOrder(yBaseline, input.rowOrder)
  const xValues = applyManualOrder(xBaseline, input.colOrder)
  return { yValues, xValues, yBaseline, xBaseline, cells: pivot.cellMap }
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
  baseline: string[],
): string[] | undefined {
  return ordersEqual(current, baseline) ? undefined : current
}
