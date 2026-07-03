import { describe, expect, it } from 'vitest'
import {
  aggregateRowPredictionsHref,
  experimentPredictionsHref,
  heatmapCellPredictionsHref,
  predictionsTableHref,
} from '@/lib/predictions-nav'
import { parseTableState } from '@/lib/table-params'
import { getTableConfig } from '@/lib/table-config'
import { parseHeatmapState } from '@/lib/heatmap-params'

describe('predictionsTableHref', () => {
  it('builds a filtered predictions URL with sort options', () => {
    const href = predictionsTableHref(
      { model: 'openai/test', experiment_kind: 'humaneval_encdec' },
      { sort: { column: 'score', dir: 'asc' } },
    )
    expect(href).toContain('sort=score')
    expect(href).toContain('dir=asc')
    expect(href).toContain('model=openai%2Ftest')
    expect(href).toContain('experiment_kind=humaneval_encdec')
  })

  it('includes exclude params for forward-compatible drill-down links', () => {
    const href = predictionsTableHref(
      { model: 'openai/test' },
      { exclude: { experiment_kind: ['humaneval_direct'] } },
    )
    expect(href).toContain('model=openai%2Ftest')
    expect(href).toContain('exclude.experiment_kind=humaneval_direct')
  })

  it('supports experiment text filter drill-down', () => {
    expect(experimentPredictionsHref('dr-dspy/direct/sweep-1')).toBe(
      '/tables/published-predictions?experiment_id=dr-dspy%2Fdirect%2Fsweep-1&includeTestExps=1',
    )
  })
})

describe('aggregateRowPredictionsHref', () => {
  it('maps group-by row values and active filters to a predictions URL', () => {
    const href = aggregateRowPredictionsHref(
      {
        groupBy: ['model', 'experiment_kind'],
        sort: 'avg_score',
        dir: 'asc',
        page: 1,
        pageSize: 100,
        filterIn: { model: ['openai/test'] },
        filterOut: {},
        hideTestExperiments: true,
      },
      { model: 'openai/test', experiment_kind: 'humaneval_encdec', n: 42 },
    )
    expect(href).toContain('sort=score&dir=asc')
    expect(href).toContain('model=openai%2Ftest')
    expect(href).toContain('experiment_kind=humaneval_encdec')
  })
})

describe('heatmapCellPredictionsHref', () => {
  it('maps heatmap axes and filters to a predictions URL', () => {
    const state = parseHeatmapState({
      x: 'experiment_kind',
      y: 'model',
      model: 'openai/test',
      experiment_kind: 'humaneval_direct',
    })
    const href = heatmapCellPredictionsHref(
      state,
      'openai/test',
      'humaneval_direct',
    )
    expect(href).toContain('model=openai%2Ftest')
    expect(href).toContain('experiment_kind=humaneval_direct')
  })

  it('maps budget axis values to the budget URL param', () => {
    const state = parseHeatmapState({ x: 'budget', y: 'model' })
    const href = heatmapCellPredictionsHref(state, 'openai/test', '0.5')
    expect(href).toContain('model=openai%2Ftest')
    expect(href).toContain('budget=0.5')
  })
})

describe('parseTableState budget param', () => {
  it('stores budget drill-down in text filters for SQL handling', () => {
    const config = getTableConfig('published-predictions')
    expect(parseTableState(config, { budget: '(none)' }).filters.budget).toBe(
      '(none)',
    )
  })
})

describe('hideTestExperiments propagation', () => {
  it('preserves hide setting in aggregate drill-down href', () => {
    const href = aggregateRowPredictionsHref(
      {
        groupBy: ['model'],
        sort: 'avg_score',
        dir: 'asc',
        page: 1,
        pageSize: 100,
        filterIn: {},
        filterOut: {},
        hideTestExperiments: true,
      },
      { model: 'openai/test' },
    )
    expect(href).not.toContain('includeTestExps=1')
  })

  it('includes includeTestExps when drill-down source shows test experiments', () => {
    const href = aggregateRowPredictionsHref(
      {
        groupBy: ['model'],
        sort: 'avg_score',
        dir: 'asc',
        page: 1,
        pageSize: 100,
        filterIn: {},
        filterOut: {},
        hideTestExperiments: false,
      },
      { model: 'openai/test' },
    )
    expect(href).toContain('includeTestExps=1')
  })
})
