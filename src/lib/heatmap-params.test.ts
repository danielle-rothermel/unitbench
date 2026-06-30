import { describe, expect, it } from 'vitest'
import {
  buildHeatmapQuery,
  heatmapHref,
  parseHeatmapState,
} from '@/lib/heatmap-params'

describe('heatmap params', () => {
  it('parses empty filters by default', () => {
    expect(parseHeatmapState({})).toEqual({
      filterIn: {},
      filterOut: {},
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
    })
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
    })
  })

  it('omits empty defaults from serialized URLs', () => {
    expect(buildHeatmapQuery(parseHeatmapState({})).toString()).toBe('')
    expect(heatmapHref(parseHeatmapState({}))).toBe('/aggregate/heatmap')
  })

  it('round-trips filter state', () => {
    const state = parseHeatmapState({
      model: 'openai/gpt-5.4-nano',
      'exclude.experiment_kind': 'humaneval_encdec',
    })
    const href = heatmapHref(state)
    expect(href).toContain('/aggregate/heatmap?')
    expect(href).toContain('model=openai%2Fgpt-5.4-nano')
    expect(href).toContain('exclude.experiment_kind=humaneval_encdec')
  })
})
