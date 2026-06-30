import { describe, expect, it } from 'vitest'
import {
  applyManualOrder,
  buildHeatmapPivot,
  computeDefaultRowOrder,
  moveItem,
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

  it('resolveAxisOrders applies manual overrides', () => {
    const pivot = buildHeatmapPivot(
      rows,
      'model',
      'experiment_kind',
      'avg_score',
    )
    const { yValues } = resolveAxisOrders(pivot, [
      'openai/gpt-5-nano',
      'openai/gpt-5.4-nano',
    ])
    expect(yValues).toEqual([
      'openai/gpt-5-nano',
      'openai/gpt-5.4-nano',
    ])
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
})
