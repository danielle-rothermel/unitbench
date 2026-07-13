import { describe, expect, it, vi } from 'vitest'
import type { PublicationDatabase } from '@/lib/bundle-pins.server'
import {
  assertFrozenParityInventory,
  assertParityInventory,
  deriveProductionParityInventory,
  FROZEN_PRODUCTION_PARITY_CASES,
  FROZEN_PRODUCTION_PARITY_INVENTORY,
  normalizeProductionParityCase,
} from '@/lib/delivery-parity-inventory.server'

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
  it('exactly equals the production-config-derived loader cross-product', () => {
    expect(FROZEN_PRODUCTION_PARITY_INVENTORY).toEqual(deriveProductionParityInventory())
    expect(() => assertFrozenParityInventory()).not.toThrow()
  })

  it('rejects an omitted frozen case', () => {
    expect(() => assertParityInventory(FROZEN_PRODUCTION_PARITY_INVENTORY.slice(1))).toThrow(
      'Frozen parity inventory differs',
    )
  })

  it('keeps every loader-family case semantically and SQL-distinct', async () => {
    const states = new Map<string, string>()
    const fingerprints = new Map<string, string>()
    for (const [index, frozen] of FROZEN_PRODUCTION_PARITY_INVENTORY.entries()) {
      const parts = frozen.id.split('/')
      const family = frozen.id.startsWith('table/') ? parts.slice(0, 2).join('/')
        : frozen.id.startsWith('aggregate/') ? parts.slice(0, 4).join('/')
          : frozen.id.startsWith('heatmap/') ? parts.slice(0, 4).join('/')
            : frozen.id
      const stateKey = `${family}:${JSON.stringify(normalizeProductionParityCase(frozen))}`
      expect(states.get(stateKey), `normalized production state: ${frozen.id}`).toBeUndefined()
      states.set(stateKey, frozen.id)

      queries = []
      await FROZEN_PRODUCTION_PARITY_CASES[index]!.execute()
      const fingerprint = JSON.stringify(queries.map(query => [query.plane, query.text, query.params]).sort())
      const fingerprintKey = `${family}:${fingerprint}`
      expect(fingerprints.get(fingerprintKey), `SQL/parameter fingerprint: ${frozen.id}`).toBeUndefined()
      fingerprints.set(fingerprintKey, frozen.id)
    }
  })

  it('consolidates Detail into one execution that covers every provenance member query', async () => {
    expect(FROZEN_PRODUCTION_PARITY_INVENTORY.filter(item => item.id.startsWith('detail/')).map(item => item.id)).toEqual(['detail/read'])
    const detail = FROZEN_PRODUCTION_PARITY_CASES.find(item => item.id === 'detail/read')
    expect(detail).toBeDefined()
    queries = []
    await detail!.execute()
    const memberInventory = queries.map(query => ({
      members: Object.entries(members).filter(([, physical]) => query.text.includes(physical)).map(([member]) => member),
      params: query.params,
    }))
    expect(memberInventory).toEqual([
      { members: ['detail_predictions', 'detail_prediction_payloads'], params: ['fixture'] },
      { members: ['detail_generation_runs'], params: ['fixture'] },
      { members: ['detail_node_attempts'], params: ['fixture'] },
      { members: ['detail_score_attempts'], params: ['fixture'] },
      { members: ['detail_score_harness_failures'], params: ['fixture'] },
      { members: ['detail_platform_attempts'], params: ['fixture'] },
    ])
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
