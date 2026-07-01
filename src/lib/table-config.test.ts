import { describe, expect, it } from 'vitest'
import {
  getTableConfig,
  getTableConfigs,
  isConfiguredColumn,
  UnknownTableError,
} from '@/lib/table-config'

describe('table config allowlist', () => {
  it('exposes the initial published table configs', () => {
    expect(getTableConfigs().map(config => config.id)).toEqual([
      'published-experiments',
      'published-predictions',
      'published-prediction-details',
    ])
  })

  it('resolves known tables and rejects unknown tables', () => {
    expect(getTableConfig('published-experiments').table.name).toBe(
      'published_experiments',
    )
    expect(() => getTableConfig('raw-local-table')).toThrow(UnknownTableError)
  })

  it('checks configured columns against a table config', () => {
    const config = getTableConfig('published-predictions')
    expect(isConfiguredColumn(config, 'prediction_id')).toBe(true)
    expect(isConfiguredColumn(config, 'drop table')).toBe(false)
  })

  it('exposes enriched prediction browse columns and facet filters', () => {
    const config = getTableConfig('published-predictions')
    const keys = config.columns.map(column => column.key)
    expect(keys).toEqual(
      expect.arrayContaining([
        'experiment_kind',
        'source',
        'generation_status',
        'scoring_status',
        'provider_cost',
      ]),
    )
    expect(
      config.columns
        .filter(column => column.filter === 'facet')
        .map(column => column.key),
    ).toEqual(
      expect.arrayContaining([
        'experiment_kind',
        'source',
        'model',
        'result_state',
        'generation_status',
        'scoring_status',
      ]),
    )
  })
})
