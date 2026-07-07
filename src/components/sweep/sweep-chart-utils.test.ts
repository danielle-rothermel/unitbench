import { describe, expect, it } from 'vitest'
import {
  barPercent,
  formatMs,
  measureMax,
  sortRowsByMeasure,
  sweepGroupLabel,
  sweepRowKey,
  sweepSliceValues,
} from '@/components/sweep/sweep-chart-utils'
import { makeRow } from '@/components/sweep/sweep-test-helpers'

describe('sweepGroupLabel', () => {
  it('uses the group key when present', () => {
    const row = makeRow({ model: 'model-a', task_id: 'HumanEval/3' })
    expect(sweepGroupLabel(row, 'model')).toBe('model-a')
    expect(sweepGroupLabel(row, 'task_id')).toBe('HumanEval/3')
  })

  it('falls back model → task_id → experiment_kind', () => {
    expect(sweepGroupLabel(makeRow({ model: null, task_id: 'HumanEval/1' }), 'model')).toBe(
      'HumanEval/1',
    )
    expect(
      sweepGroupLabel(
        makeRow({ model: null, task_id: null, experiment_kind: 'humaneval_direct' }),
        'model',
      ),
    ).toBe('humaneval_direct')
  })

  it("labels the all-null-keys row 'all', never 'null'", () => {
    const row = makeRow({ model: null, task_id: null, experiment_kind: null })
    expect(sweepGroupLabel(row, 'model')).toBe('all')
    expect(sweepGroupLabel(row, 'task_id')).toBe('all')
  })
})

describe('sweepRowKey', () => {
  it('combines all three group keys so duplicate labels across slices stay unique', () => {
    const a = makeRow({ model: 'm', task_id: 'HumanEval/1', experiment_kind: 'humaneval_direct' })
    const b = makeRow({ model: 'm', task_id: 'HumanEval/1', experiment_kind: 'humaneval_encdec' })
    expect(sweepRowKey(a)).not.toBe(sweepRowKey(b))
  })
})

describe('barPercent', () => {
  it('returns 0 for null values', () => {
    expect(barPercent(null, 10)).toBe(0)
  })

  it('returns 0 for NaN values and NaN max', () => {
    expect(barPercent(Number.NaN, 10)).toBe(0)
    expect(barPercent(5, Number.NaN)).toBe(0)
  })

  it('guards max <= 0 (the 0/0 zero-n case)', () => {
    expect(barPercent(0, 0)).toBe(0)
    expect(barPercent(5, 0)).toBe(0)
    expect(barPercent(5, -1)).toBe(0)
  })

  it('clamps to [0, 100]', () => {
    expect(barPercent(-2, 10)).toBe(0)
    expect(barPercent(20, 10)).toBe(100)
    expect(barPercent(5, 10)).toBe(50)
  })
})

describe('measureMax', () => {
  it('ignores null measures', () => {
    const rows = [makeRow({ avg_cost: null }), makeRow({ avg_cost: 0.02 })]
    expect(measureMax(rows, row => row.avg_cost)).toBe(0.02)
  })

  it('returns 0 when nothing is finite', () => {
    const rows = [makeRow({ avg_cost: null }), makeRow({ avg_cost: Number.NaN })]
    expect(measureMax(rows, row => row.avg_cost)).toBe(0)
    expect(measureMax([], row => row.avg_cost)).toBe(0)
  })
})

describe('formatMs', () => {
  it('formats sub-second values as ms', () => {
    expect(formatMs(412)).toBe('412 ms')
    expect(formatMs(999)).toBe('999 ms')
  })

  it('formats second-scale values with one decimal', () => {
    expect(formatMs(8400)).toBe('8.4 s')
    expect(formatMs(22750)).toBe('22.8 s')
  })

  it('renders — for null and NaN', () => {
    expect(formatMs(null)).toBe('—')
    expect(formatMs(Number.NaN)).toBe('—')
  })
})

describe('sortRowsByMeasure', () => {
  it('sorts desc by measure with nulls last', () => {
    const rows = [
      makeRow({ model: 'a', avg_cost: 0.001 }),
      makeRow({ model: 'b', avg_cost: null }),
      makeRow({ model: 'c', avg_cost: 0.009 }),
    ]
    const sorted = sortRowsByMeasure(rows, 'model', row => row.avg_cost)
    expect(sorted.map(row => row.model)).toEqual(['c', 'a', 'b'])
  })

  it('breaks ties (and orders null-measure rows) by label, deterministically', () => {
    const rows = [
      makeRow({ model: 'b', avg_cost: 0.5 }),
      makeRow({ model: 'a', avg_cost: 0.5 }),
      makeRow({ model: 'd', avg_cost: null }),
      makeRow({ model: 'c', avg_cost: null }),
    ]
    const sorted = sortRowsByMeasure(rows, 'model', row => row.avg_cost)
    expect(sorted.map(row => row.model)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('does not mutate the input', () => {
    const rows = [makeRow({ model: 'b' }), makeRow({ model: 'a' })]
    sortRowsByMeasure(rows, 'model', row => row.avg_cost)
    expect(rows.map(row => row.model)).toEqual(['b', 'a'])
  })
})

describe('sweepSliceValues', () => {
  it('returns sorted distinct non-null values', () => {
    const rows = [
      makeRow({ model: 'b' }),
      makeRow({ model: 'a' }),
      makeRow({ model: 'b' }),
      makeRow({ model: null }),
    ]
    expect(sweepSliceValues(rows, 'model')).toEqual(['a', 'b'])
  })
})
