import { describe, expect, it, vi } from 'vitest'
import type { PublicationDatabase } from '@/lib/bundle-pins.server'
import { assertFrozenParityInventory, FROZEN_PRODUCTION_PARITY_CASES } from '@/lib/delivery-parity-inventory.server'

type Query = Readonly<{ plane: 'analysis' | 'detail'; text: string; params: readonly unknown[] }>
const members = {
  experiments: 'main.experiments', predictions: 'main.predictions', generation_runs: 'main.generation_runs', score_attempts: 'main.score_attempts', sweep_metrics: 'main.sweep_metrics', failure_metrics: 'main.failure_metrics',
  detail_predictions: 'public.detail_predictions', detail_prediction_payloads: 'public.detail_prediction_payloads', detail_generation_runs: 'public.detail_generation_runs', detail_node_attempts: 'public.detail_node_attempts', detail_score_attempts: 'public.detail_score_attempts', detail_score_harness_failures: 'public.detail_score_harness_failures', detail_platform_attempts: 'public.detail_platform_attempts',
} as const
let queries: Query[] = []
const database: PublicationDatabase = { query: async (text, params) => { queries.push({ plane: 'analysis', text, params }); return [] }, transaction: async operation => operation(database) }

vi.mock('@/lib/bundle-adapter.server', () => ({
  withAnalysisBundle: async (operation: (db: PublicationDatabase, bundle: unknown) => unknown) => operation(database, { bundleId: 'fixture-bundle', snapshotSeq: 1, members }),
  withDetailBundle: async (operation: (db: PublicationDatabase, bundle: unknown) => unknown) => operation({ ...database, query: async (text, params) => { queries.push({ plane: 'detail', text, params }); return [] } }, { bundleId: 'fixture-bundle', snapshotSeq: 1, members }),
}))

describe('frozen production parity inventory', () => {
  it('has an exhaustive, omission-detecting production loader inventory', () => {
    expect(() => assertFrozenParityInventory()).not.toThrow()
    expect(FROZEN_PRODUCTION_PARITY_CASES.length).toBeGreaterThanOrEqual(350)
  })

  it('captures real SQL and parameters from every production loader path', async () => {
    queries = []
    await Promise.all(FROZEN_PRODUCTION_PARITY_CASES.map(item => item.execute()))
    expect(queries.length).toBeGreaterThan(FROZEN_PRODUCTION_PARITY_CASES.length)
    expect(queries.some(query => query.plane === 'analysis')).toBe(true)
    expect(queries.some(query => query.plane === 'detail')).toBe(true)
    expect(queries.every(query => /SELECT/i.test(query.text))).toBe(true)
    expect(queries.some(query => query.text.includes('detail_prediction_payloads'))).toBe(true)
    expect(queries.some(query => query.text.includes('GROUP BY'))).toBe(true)
  })
})
