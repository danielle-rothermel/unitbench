import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configuredAnalysisAdapter, type AnalysisAdapter } from '@/lib/analysis-adapter.server'
import type { PublicationDatabase } from '@/lib/bundle-pins.server'
import { getAggregatePage, getHeatmapPage } from '@/lib/aggregate-data'
import {
  fetchCompressionDistribution,
  fetchCorrectnessCompressionPoints,
  fetchDashboardRead,
} from '@/lib/read-layer'
import { getPredictionDetail } from '@/lib/prediction-detail'
import { getTableConfigs } from '@/lib/table-config'
import { getTablePage } from '@/lib/table-data'

type RecordedQuery = Readonly<{ plane: 'analysis' | 'detail'; text: string; params: readonly unknown[] }>

const MEMBERS = {
  experiments: 'parity_experiments',
  predictions: 'parity_predictions',
  generation_runs: 'parity_generation_runs',
  score_attempts: 'parity_score_attempts',
  sweep_metrics: 'parity_sweep_metrics',
  failure_metrics: 'parity_failure_metrics',
  detail_predictions: 'parity_detail_predictions',
  detail_prediction_payloads: 'parity_detail_prediction_payloads',
  detail_generation_runs: 'parity_detail_generation_runs',
  detail_node_attempts: 'parity_detail_node_attempts',
  detail_score_attempts: 'parity_detail_score_attempts',
  detail_score_harness_failures: 'parity_detail_score_harness_failures',
  detail_platform_attempts: 'parity_detail_platform_attempts',
} as const

let recorded: RecordedQuery[] = []

const recorder: PublicationDatabase = {
  query: async (text, params) => {
    recorded.push({ plane: 'analysis', text, params })
    return []
  },
  transaction: async operation => operation(recorder),
}

vi.mock('@/lib/bundle-adapter.server', () => ({
  withAnalysisBundle: async (operation: (database: PublicationDatabase, bundle: unknown) => unknown) =>
    operation(recorder, { bundleId: 'parity', snapshotSeq: 1, members: MEMBERS }),
  withDetailBundle: async (operation: (database: PublicationDatabase, bundle: unknown) => unknown) => {
    const database: PublicationDatabase = {
      ...recorder,
      query: async (text, params) => {
        recorded.push({ plane: 'detail', text, params })
        return []
      },
    }
    return operation(database, { bundleId: 'parity', snapshotSeq: 1, members: MEMBERS })
  },
}))

async function productionQueries(): Promise<readonly RecordedQuery[]> {
  recorded = []
  await fetchDashboardRead()
  await fetchCompressionDistribution()
  await fetchCorrectnessCompressionPoints()
  for (const config of getTableConfigs()) {
    await getTablePage(config.id, { hideTestExperiments: 'false' })
  }
  await getAggregatePage({
    groupBy: ['model', 'experiment_kind'], sort: 'n', dir: 'desc', page: 1, pageSize: 25,
    filterIn: {}, filterOut: {}, hideTestExperiments: false,
  })
  await getHeatmapPage({
    x: 'model', y: 'experiment_kind', color: 'n', filterIn: {}, filterOut: {}, hideTestExperiments: false,
  })
  await getPredictionDetail('parity/prediction')
  return recorded
}

const INTEGER_COLUMNS = new Set(['bucket', 'count', 'n', 'row_count', 'sample_index', 'total'])
const NUMERIC_COLUMNS = new Set([
  'score', 'provider_cost', 'compression_ratio', 'pass_rate', 'avg_score', 'stddev_score', 'avg_cost',
])
const JSON_COLUMNS = new Set([
  'summary_json', 'metrics_json', 'request_json', 'response_json', 'validation_json',
])

/**
 * This is intentionally narrower than a generic string-to-number coercion:
 * text such as a prediction id or JSON value must never be silently changed.
 */
function normalizedValue(column: string, value: unknown): unknown {
  if (value === null || value === undefined) return value ?? null
  if (JSON_COLUMNS.has(column) && typeof value === 'string') return JSON.parse(value)
  if (INTEGER_COLUMNS.has(column)) {
    const parsed = typeof value === 'bigint' ? Number(value) : Number(value)
    if (!Number.isSafeInteger(parsed)) throw new TypeError(`Invalid integer parity value for ${column}`)
    return parsed
  }
  if (NUMERIC_COLUMNS.has(column)) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) throw new TypeError(`Invalid numeric parity value for ${column}`)
    return parsed
  }
  if (value instanceof Date) return value.toISOString().replace('.000Z', '+00:00').replace('Z', '+00:00')
  if (typeof value === 'bigint') return value.toString()
  return value
}

function normalizedRows(rows: readonly Record<string, unknown>[]): unknown[] {
  return rows.map(row => Object.fromEntries(
    Object.entries(row).map(([column, value]) => [column, normalizedValue(column, value)]),
  ))
}

function parityEnvironment(): NodeJS.ProcessEnv | null {
  // The explicit opt-in prevents a normal test invocation from touching either
  // developer databases or a deployed MotherDuck endpoint.
  if (process.env.UNITBENCH_DELIVERY_PARITY !== '1') return null
  const localPath = process.env.LOCAL_ANALYSIS_DATABASE_PATH?.trim()
  const remoteUrl = process.env.ANALYSIS_DATABASE_URL?.trim()
  return localPath && remoteUrl
    ? { ...process.env, LOCAL_ANALYSIS_DATABASE_PATH: localPath, ANALYSIS_DATABASE_URL: remoteUrl }
    : null
}

async function executeAll(adapter: AnalysisAdapter, queries: readonly RecordedQuery[]): Promise<unknown[][]> {
  const output: unknown[][] = []
  for (const query of queries) {
    output.push(normalizedRows(await adapter.query(query.text, query.params)))
  }
  return output
}

describe('delivery parity query inventory', () => {
  beforeEach(() => { recorded = [] })

  it('captures every current Analysis and Detail production read with its real SQL and parameters', async () => {
    const queries = await productionQueries()
    expect(queries.length).toBeGreaterThan(20)
    expect(queries.some(query => query.plane === 'analysis')).toBe(true)
    expect(queries.some(query => query.plane === 'detail')).toBe(true)
    expect(queries.every(query => query.text.includes('SELECT'))).toBe(true)
    expect(queries.some(query => query.text.includes('detail_prediction_payloads'))).toBe(true)
    expect(queries.some(query => query.text.includes('GROUP BY'))).toBe(true)
  })
})

describe('delivery parity against the exported fixture', () => {
  const environment = parityEnvironment()
  const run = environment ? it : it.skip

  run('executes every captured production query through local DuckDB and MotherDuck/Postgres', async () => {
    const queries = await productionQueries()
    const local = configuredAnalysisAdapter({ ...environment!, ANALYSIS_DATABASE_URL: undefined })
    const remote = configuredAnalysisAdapter({ ...environment!, LOCAL_ANALYSIS_DATABASE_PATH: undefined })
    try {
      const localRows = await executeAll(local, queries)
      const remoteRows = await executeAll(remote, queries)
      // Deliberately compare each query result, not just an aggregate/sampled view.
      expect(remoteRows).toEqual(localRows)
    } finally {
      await Promise.all([local.close?.(), remote.close?.()])
    }
  }, 60_000)
})
