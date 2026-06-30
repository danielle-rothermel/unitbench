import { describe, it, expect } from 'vitest'
import { getConnectionStatus } from '@/lib/neon'
import {
  getAggregatePage,
  getAggregateFacets,
  getHeatmapRows,
} from '@/lib/aggregate-data'
import { parseAggregateState } from '@/lib/aggregate-params'
import { parseHeatmapState } from '@/lib/heatmap-params'

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL)

describe.skipIf(!hasDatabaseUrl)('aggregate db integration', () => {
  it('connects to Neon', async () => {
    expect(await getConnectionStatus()).toEqual({ status: 'ok' })
  })

  it('loads aggregate page with default state', async () => {
    const state = parseAggregateState({})
    const page = await getAggregatePage(state)
    expect(page.status).toBe('ok')
    if (page.status !== 'ok') return
    expect(page.rows.length).toBeGreaterThan(0)
    expect(page.total).toBeGreaterThan(0)
    expect(page.rows[0]).toHaveProperty('avg_score')
    expect(page.rows[0]).toHaveProperty('n')
    const worst = page.rows[0]
    expect(String(worst.model)).toContain('gpt-5.4-nano')
    expect(Number(worst.avg_score)).toBeLessThan(0.2)
  })

  it('loads heatmap rows for model x experiment_kind', async () => {
    const filters = parseHeatmapState({})
    const rows = await getHeatmapRows(filters)
    expect(rows.length).toBeGreaterThan(0)
    const nanoDirect = rows.find(
      row =>
        String(row.model) === 'openai/gpt-5.4-nano' &&
        row.experiment_kind === 'humaneval_direct',
    )
    expect(nanoDirect).toBeDefined()
    expect(Number(nanoDirect?.avg_score)).toBeCloseTo(0.147, 2)
  })

  it('loads facets for filters', async () => {
    const facets = await getAggregateFacets()
    expect(facets.model?.length).toBeGreaterThan(0)
    expect(facets.experiment_kind).toEqual(
      expect.arrayContaining(['humaneval_direct', 'humaneval_encdec']),
    )
  })
})
