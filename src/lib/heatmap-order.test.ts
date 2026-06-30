import { describe, expect, it } from 'vitest'
import {
  applyManualOrder,
  buildHeatmapPivot,
  computeDefaultRowOrder,
  deriveGroupKey,
  moveItem,
  orderByDeclaredValues,
  orderByGroup,
  orderByMeasure,
  ordersEqual,
  resolveAxisOrders,
} from '@/lib/heatmap-order'

describe('heatmap order', () => {
  const rows = [
    {
      model: 'openai/gpt-5.4-nano',
      experiment_kind: 'humaneval_direct',
      n: 987,
      avg_score: 0.147,
    },
    {
      model: 'openai/gpt-5.4-nano',
      experiment_kind: 'humaneval_encdec',
      n: 3451,
      avg_score: 0,
    },
    {
      model: 'openai/gpt-5-nano',
      experiment_kind: 'humaneval_direct',
      n: 987,
      avg_score: 0.75,
    },
    {
      model: 'openai/gpt-5-nano',
      experiment_kind: 'humaneval_encdec',
      n: 3451,
      avg_score: 0.9,
    },
    {
      model: 'deepseek/deepseek-chat',
      experiment_kind: 'humaneval_direct',
      n: 100,
      avg_score: 0.6,
    },
  ]

  it('sorts rows by minimum color measure ascending', () => {
    const pivot = buildHeatmapPivot(
      rows,
      'model',
      'experiment_kind',
      'avg_score',
    )
    expect(pivot.naturalRowOrder[0]).toBe('openai/gpt-5.4-nano')
    expect(pivot.naturalColOrder).toEqual([
      'humaneval_direct',
      'humaneval_encdec',
    ])
  })

  it('applyManualOrder keeps manual keys and appends new natural keys', () => {
    expect(
      applyManualOrder(['a', 'b', 'c'], ['c', 'a']),
    ).toEqual(['c', 'a', 'b'])
    expect(applyManualOrder(['a', 'b'], ['x', 'a'])).toEqual(['a', 'b'])
    expect(applyManualOrder(['a', 'b'], undefined)).toEqual(['a', 'b'])
  })

  it('resolveAxisOrders applies manual overrides on top of rule baseline', () => {
    const pivot = buildHeatmapPivot(
      rows,
      'model',
      'experiment_kind',
      'avg_score',
    )
    const { yValues } = resolveAxisOrders(pivot, {
      yAxis: 'model',
      xAxis: 'experiment_kind',
      colorMeasure: 'avg_score',
      rowOrder: ['openai/gpt-5-nano', 'openai/gpt-5.4-nano'],
    })
    expect(yValues).toEqual([
      'openai/gpt-5-nano',
      'openai/gpt-5.4-nano',
      'deepseek/deepseek-chat',
    ])
  })

  it('resolveAxisOrders applies measure sort by mean', () => {
    const pivot = buildHeatmapPivot(
      rows,
      'model',
      'experiment_kind',
      'avg_score',
    )
    const { yValues } = resolveAxisOrders(pivot, {
      yAxis: 'model',
      xAxis: 'experiment_kind',
      colorMeasure: 'avg_score',
      rowSort: { kind: 'measure', direction: 'desc' },
    })
    expect(yValues[0]).toBe('openai/gpt-5-nano')
    expect(yValues[yValues.length - 1]).toBe('openai/gpt-5.4-nano')
  })

  it('resolveAxisOrders applies group:provider on model rows', () => {
    const pivot = buildHeatmapPivot(
      rows,
      'model',
      'experiment_kind',
      'avg_score',
    )
    const { yValues } = resolveAxisOrders(pivot, {
      yAxis: 'model',
      xAxis: 'experiment_kind',
      colorMeasure: 'avg_score',
      rowSort: { kind: 'group', groupBy: 'provider', direction: 'asc' },
    })
    const deepseekIndex = yValues.indexOf('deepseek/deepseek-chat')
    const openaiIndices = yValues
      .map((value, index) => (value.startsWith('openai/') ? index : -1))
      .filter(index => index >= 0)
    expect(deepseekIndex).toBeLessThan(Math.min(...openaiIndices))
  })

  it('resolveAxisOrders applies group:experiment_kind on experiment_kind axis', () => {
    const pivot = buildHeatmapPivot(
      rows,
      'model',
      'experiment_kind',
      'avg_score',
    )
    const { xValues } = resolveAxisOrders(pivot, {
      yAxis: 'model',
      xAxis: 'experiment_kind',
      colorMeasure: 'avg_score',
      colSort: { kind: 'group', groupBy: 'experiment_kind', direction: 'asc' },
    })
    expect(xValues.indexOf('humaneval_direct')).toBeLessThan(
      xValues.indexOf('humaneval_encdec'),
    )
  })

  it('moveItem reorders a list', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
  })

  it('ordersEqual compares arrays', () => {
    expect(ordersEqual(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(ordersEqual(['a', 'b'], ['b', 'a'])).toBe(false)
  })

  it('computeDefaultRowOrder uses col order for min calculation', () => {
    const cellMap = new Map([
      [
        'row-a',
        new Map([
          ['x1', { value: 0.5, n: 1 }],
          ['x2', { value: 0.9, n: 1 }],
        ]),
      ],
      [
        'row-b',
        new Map([
          ['x1', { value: 0.1, n: 1 }],
          ['x2', { value: 0.8, n: 1 }],
        ]),
      ],
    ])
    expect(computeDefaultRowOrder(cellMap, ['x1', 'x2'])).toEqual([
      'row-b',
      'row-a',
    ])
  })

  describe('orderByDeclaredValues', () => {
    const declared = ['0.25', '0.5', '1.0', '2.0', '(none)']

    it('places (none) last among known budget values', () => {
      expect(
        orderByDeclaredValues(['(none)', '1.0', '0.5', '0.25'], declared),
      ).toEqual(['0.25', '0.5', '1.0', '(none)'])
    })

    it('appends unknown values after known ones in localeCompare order', () => {
      expect(
        orderByDeclaredValues(['9.9', '0.5', 'custom'], declared),
      ).toEqual(['0.5', '9.9', 'custom'])
    })
  })

  describe('orderByMeasure', () => {
    it('sorts rows by mean measure ascending', () => {
      const pivot = buildHeatmapPivot(
        rows,
        'model',
        'experiment_kind',
        'avg_score',
      )
      const ordered = orderByMeasure(
        pivot.naturalRowOrder,
        pivot,
        'avg_score',
        'row',
        'asc',
      )
      expect(ordered[0]).toBe('openai/gpt-5.4-nano')
    })
  })

  describe('deriveGroupKey', () => {
    it('extracts provider prefix from model ids', () => {
      expect(
        deriveGroupKey('openai/gpt-5-nano', 'model', 'provider'),
      ).toBe('openai')
    })

    it('normalizes experiment_kind values to direct and encdec', () => {
      expect(
        deriveGroupKey('humaneval_direct', 'experiment_kind', 'experiment_kind'),
      ).toBe('direct')
      expect(
        deriveGroupKey('humaneval_encdec', 'experiment_kind', 'experiment_kind'),
      ).toBe('encdec')
    })
  })

  describe('orderByGroup', () => {
    it('clusters providers together on model axis', () => {
      const pivot = buildHeatmapPivot(
        rows,
        'model',
        'experiment_kind',
        'avg_score',
      )
      const ordered = orderByGroup(
        pivot.naturalRowOrder,
        'model',
        pivot,
        'avg_score',
        'row',
        'provider',
        'asc',
      )
      const providers = ordered.map(model =>
        deriveGroupKey(model, 'model', 'provider'),
      )
      expect(providers).toEqual([...providers].sort())
    })
  })
})
