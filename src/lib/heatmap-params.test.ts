import { describe, expect, it } from 'vitest'
import {
  buildHeatmapQuery,
  heatmapHref,
  parseHeatmapState,
} from '@/lib/heatmap-params'
import {
  DEFAULT_HEATMAP_COLOR,
  DEFAULT_HEATMAP_X,
  DEFAULT_HEATMAP_Y,
} from '@/lib/heatmap-config'

describe('heatmap params', () => {
  it('parses defaults for axes, color, and filters', () => {
    expect(parseHeatmapState({})).toEqual({
      filterIn: {},
      filterOut: {},
      x: DEFAULT_HEATMAP_X,
      y: DEFAULT_HEATMAP_Y,
      color: DEFAULT_HEATMAP_COLOR,
    })
  })

  it('parses include and exclude filters', () => {
    expect(
      parseHeatmapState({
        model: ['openai/test', 'openai/other'],
        'exclude.experiment_kind': 'humaneval_direct',
      }),
    ).toEqual({
      filterIn: { model: ['openai/test', 'openai/other'] },
      filterOut: { experiment_kind: ['humaneval_direct'] },
      x: DEFAULT_HEATMAP_X,
      y: DEFAULT_HEATMAP_Y,
      color: DEFAULT_HEATMAP_COLOR,
    })
  })

  it('parses axis, color, and budget filters', () => {
    expect(
      parseHeatmapState({
        x: 'budget',
        y: 'model',
        color: 'pass_rate',
        budget: '0.5',
        task_id: 'HumanEval/0',
      }),
    ).toEqual({
      filterIn: { budget: ['0.5'], task_id: ['HumanEval/0'] },
      filterOut: {},
      x: 'budget',
      y: 'model',
      color: 'pass_rate',
    })
  })

  it('normalizes conflicting x and y axes', () => {
    const state = parseHeatmapState({ x: 'model', y: 'model' })
    expect(state.x).toBe('model')
    expect(state.y).toBe(DEFAULT_HEATMAP_X)
  })

  it('ignores aggregate-only params', () => {
    expect(
      parseHeatmapState({
        groupBy: 'model,task_id',
        sort: 'n',
        page: '2',
        model: 'openai/test',
      }),
    ).toEqual({
      filterIn: { model: ['openai/test'] },
      filterOut: {},
      x: DEFAULT_HEATMAP_X,
      y: DEFAULT_HEATMAP_Y,
      color: DEFAULT_HEATMAP_COLOR,
    })
  })

  it('omits empty defaults from serialized URLs', () => {
    expect(buildHeatmapQuery(parseHeatmapState({})).toString()).toBe('')
    expect(heatmapHref(parseHeatmapState({}))).toBe('/aggregate/heatmap')
  })

  it('round-trips filter and layout state', () => {
    const state = parseHeatmapState({
      x: 'budget',
      y: 'model',
      color: 'n',
      model: 'openai/gpt-5.4-nano',
      'exclude.experiment_kind': 'humaneval_encdec',
    })
    const href = heatmapHref(state)
    expect(href).toContain('/aggregate/heatmap?')
    expect(href).toContain('x=budget')
    expect(href).not.toContain('y=')
    expect(href).toContain('color=n')
    expect(href).toContain('model=openai%2Fgpt-5.4-nano')
    expect(href).toContain('exclude.experiment_kind=humaneval_encdec')
  })
})
