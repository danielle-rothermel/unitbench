import { afterEach, describe, expect, it } from 'vitest'
import { localDuckDbAdapter, type AnalysisAdapter } from '@/lib/analysis-adapter.server'
import { buildAggregateQuery, buildHeatmapQuerySql, type AggregateState } from '@/lib/aggregate-data'
import { parseHeatmapState } from '@/lib/heatmap-params'

let database: AnalysisAdapter | undefined

afterEach(async () => { await database?.close?.(); database = undefined })

async function nativePredictions(): Promise<AnalysisAdapter> {
  database = localDuckDbAdapter(':memory:')
  await database.query(`CREATE TABLE "predictions" (
    model VARCHAR, experiment_kind VARCHAR, task_id VARCHAR, score DOUBLE,
    result_state VARCHAR, provider_cost DOUBLE, experiment_id VARCHAR, summary_json JSON
  )`, [])
  await database.query(
    'INSERT INTO "predictions" VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      'model-a', 'direct', 'task-a', 1, 'passed', 1, 'production-a', '{"budget_ratio":"0.5"}',
      'model-b', 'encdec', 'task-b', 0, 'failed', 2, 'production-b', '{"budget_ratio":"1.0"}',
      'model-a', 'excluded', 'task-b', 1, 'passed', 3, 'production-c', '{"budget_ratio":"0.5"}',
    ],
  )
  return database
}

const aggregateState: AggregateState = {
  groupBy: ['model', 'experiment_kind'], sort: 'avg_score', dir: 'asc', page: 1, pageSize: 25,
  filterIn: {}, filterOut: {}, hideTestExperiments: false,
}

describe('native DuckDB aggregate and heatmap filters', () => {
  it.each([
    ['include', { filterIn: { model: ['model-a'] } }, 2],
    ['exclude', { filterOut: { experiment_kind: ['excluded'] } }, 2],
    ['combined', { filterIn: { model: ['model-a'] }, filterOut: { experiment_kind: ['excluded'] } }, 1],
    ['pairwise', { filterIn: { model: ['model-a'] }, filterOut: { task_id: ['task-b'] } }, 1],
  ])('executes aggregate %s filters through DuckDB 1.4 bindings', async (_name, filters, expected) => {
    const adapter = await nativePredictions()
    const query = buildAggregateQuery({ ...aggregateState, ...filters })
    const rows = await adapter.query(query.text, query.params)
    expect(rows.reduce((total, row) => total + Number(row.n), 0)).toBe(expected)
  })

  it.each([
    ['include', { model: 'model-a' }, 2],
    ['exclude', { 'exclude.experiment_kind': 'excluded' }, 2],
    ['combined', { model: 'model-a', 'exclude.experiment_kind': 'excluded' }, 1],
    ['pairwise', { model: 'model-a', 'exclude.task_id': 'task-b' }, 1],
  ])('executes heatmap %s filters through DuckDB 1.4 bindings', async (_name, input, expected) => {
    const adapter = await nativePredictions()
    const query = buildHeatmapQuerySql(parseHeatmapState({ x: 'model', y: 'task_id', color: 'n', includeTestExps: '1', ...input }))
    const rows = await adapter.query(query.text, query.params)
    expect(rows.reduce((total, row) => total + Number(row.n), 0)).toBe(expected)
  })
})
