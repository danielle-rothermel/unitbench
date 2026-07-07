import { describe, expect, it } from 'vitest'
import {
  buildHeadroomHeatmapQuery,
  headroomHeatmapHref,
  parseHeadroomHeatmapState,
  toBinConfig,
  type HeadroomHeatmapState,
} from '@/lib/headroom-heatmap-params'

const defaults: HeadroomHeatmapState = {
  view: 'facets',
  x_bin_count: 10,
  y_bin_count: 10,
  seed: 1,
}

function roundTrip(state: HeadroomHeatmapState): HeadroomHeatmapState {
  return parseHeadroomHeatmapState(
    Object.fromEntries(buildHeadroomHeatmapQuery(state)),
  )
}

describe('parseHeadroomHeatmapState', () => {
  it('parses an empty record into the defaults', () => {
    expect(parseHeadroomHeatmapState({})).toEqual(defaults)
  })

  it('parses explicit view, bins, domain, order, and seed', () => {
    expect(
      parseHeadroomHeatmapState({
        view: 'overlay',
        xBins: '25',
        yBins: '5',
        xDomain: '0:2',
        facetOrder: 'google/gemini-3-flash,openai/gpt-5.5-codex',
        seed: '21',
      }),
    ).toEqual({
      view: 'overlay',
      x_bin_count: 25,
      y_bin_count: 5,
      x_domain: [0, 2],
      facetOrder: ['google/gemini-3-flash', 'openai/gpt-5.5-codex'],
      seed: 21,
    })
  })

  it('preserves facet keys containing spaces and arrows', () => {
    expect(
      parseHeadroomHeatmapState({ facetOrder: 'a/enc -> b/dec,openai/gpt-5.5-codex' })
        .facetOrder,
    ).toEqual(['a/enc -> b/dec', 'openai/gpt-5.5-codex'])
  })

  it('falls back to the default view for unknown values', () => {
    expect(parseHeadroomHeatmapState({ view: 'nope' }).view).toBe('facets')
  })

  it.each([
    ['abc', 10],
    ['1.5', 10],
    ['0', 2],
    ['-3', 2],
    ['999', 50],
    ['1e9', 50],
  ])('clamps or defaults hostile bin count %s to %d', (raw, expected) => {
    const state = parseHeadroomHeatmapState({ xBins: raw, yBins: raw })
    expect(state.x_bin_count).toBe(expected)
    expect(state.y_bin_count).toBe(expected)
  })

  it.each([['2:0'], ['1'], ['x:y'], [':1'], ['0:'], ['1:1']])(
    'drops invalid xDomain %s',
    raw => {
      expect(parseHeadroomHeatmapState({ xDomain: raw }).x_domain).toBeUndefined()
    },
  )

  it('falls back to the default seed for non-integers', () => {
    expect(parseHeadroomHeatmapState({ seed: '1.5' }).seed).toBe(1)
    expect(parseHeadroomHeatmapState({ seed: 'abc' }).seed).toBe(1)
  })

  it('takes the first value of array-valued params', () => {
    expect(
      parseHeadroomHeatmapState({ xBins: ['20', '30'], view: ['overlay', 'facets'] }),
    ).toEqual({ ...defaults, view: 'overlay', x_bin_count: 20 })
  })

  it('drops empty facetOrder entries', () => {
    expect(
      parseHeadroomHeatmapState({ facetOrder: ' , ,m1, ' }).facetOrder,
    ).toEqual(['m1'])
    expect(parseHeadroomHeatmapState({ facetOrder: ',' }).facetOrder).toBeUndefined()
  })
})

describe('buildHeadroomHeatmapQuery / headroomHeatmapHref', () => {
  it('omits defaults from serialized URLs', () => {
    expect(buildHeadroomHeatmapQuery(defaults).toString()).toBe('')
    expect(headroomHeatmapHref(defaults)).toBe('/dev/headroom-heatmap')
  })

  it.each<[string, HeadroomHeatmapState]>([
    ['defaults', defaults],
    ['overlay with custom bins', { ...defaults, view: 'overlay', x_bin_count: 25, y_bin_count: 5 }],
    ['fixed x domain', { ...defaults, x_domain: [0, 2] }],
    [
      'facet order with arrows and slashes',
      { ...defaults, facetOrder: ['a/enc -> b/dec', 'openai/gpt-5.5-codex'] },
    ],
    ['seed 21', { ...defaults, seed: 21 }],
    [
      'everything at once',
      {
        view: 'overlay',
        x_bin_count: 15,
        y_bin_count: 20,
        x_domain: [0.5, 2.25],
        facetOrder: ['m2', 'm1'],
        seed: 99,
      },
    ],
  ])('round-trips %s through parse(build(state))', (_label, state) => {
    expect(roundTrip(state)).toEqual(state)
  })

  it('percent-encodes facet keys safely in hrefs', () => {
    const href = headroomHeatmapHref({
      ...defaults,
      facetOrder: ['a/enc -> b/dec', 'm1'],
    })
    expect(href).toContain('/dev/headroom-heatmap?facetOrder=')
    expect(href).not.toContain(' ')
  })
})

describe('toBinConfig', () => {
  it('projects state into a bin config with a fixed y domain', () => {
    expect(toBinConfig({ ...defaults, x_bin_count: 15 })).toEqual({
      x_bin_count: 15,
      y_bin_count: 10,
      y_domain: [0, 1],
    })
  })

  it('passes an explicit x domain through', () => {
    expect(toBinConfig({ ...defaults, x_domain: [0, 2] })).toEqual({
      x_bin_count: 10,
      y_bin_count: 10,
      x_domain: [0, 2],
      y_domain: [0, 1],
    })
  })
})
