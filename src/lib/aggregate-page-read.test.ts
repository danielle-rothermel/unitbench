import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BundleReadError } from '@/lib/bundle-adapter.server'
import { getAggregatePage, getHeatmapPage, type AggregateState } from '@/lib/aggregate-data'
import { parseHeatmapState } from '@/lib/heatmap-params'

const { withAnalysisBundle } = vi.hoisted(() => ({
  withAnalysisBundle: vi.fn(),
}))

vi.mock('@/lib/bundle-adapter.server', () => ({
  BundleReadError: class BundleReadError extends Error {
    readonly code: string

    constructor(code: string) {
      super(code)
      this.code = code
    }
  },
  withAnalysisBundle,
}))

const state: AggregateState = {
  groupBy: ['model'],
  sort: 'avg_score',
  dir: 'asc',
  page: 1,
  pageSize: 100,
  filterIn: {},
  filterOut: {},
  hideTestExperiments: true,
}

describe('aggregate page reads', () => {
  beforeEach(() => {
    withAnalysisBundle.mockReset()
  })

  it('returns the explicit bundle failure when a facet query fails', async () => {
    withAnalysisBundle.mockImplementation(async operation => operation(
      {
        query: async (statement: string) => {
          if (statement.startsWith('SELECT DISTINCT')) {
            throw new BundleReadError('BUNDLE_CONTRACT_INCOMPATIBLE')
          }
          return [{ total: 1 }]
        },
      },
      {
        bundleId: 'bundle-1',
        snapshotSeq: 7,
        members: { predictions: '"published"."predictions"' },
      },
    ))

    const page = await getAggregatePage(state)

    expect(withAnalysisBundle).toHaveBeenCalledTimes(1)
    expect(page).toEqual(expect.objectContaining({
      status: 'failure',
      failure: 'BUNDLE_CONTRACT_INCOMPATIBLE',
    }))
  })

  it('reads heatmap cells and facets through one page-boundary pin', async () => {
    withAnalysisBundle.mockImplementation(async operation => operation(
      {
        query: async () => [],
      },
      {
        bundleId: 'bundle-1',
        snapshotSeq: 7,
        members: { predictions: '"published"."predictions"' },
      },
    ))

    const page = await getHeatmapPage(parseHeatmapState({}))

    expect(withAnalysisBundle).toHaveBeenCalledTimes(1)
    expect(page).toEqual(expect.objectContaining({
      status: 'ok',
      bundle: { bundle_id: 'bundle-1', snapshot_seq: 7 },
    }))
  })
})
