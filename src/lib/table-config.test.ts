import { describe, expect, it } from 'vitest'
import {
  getTableConfig,
  getTableConfigs,
  isConfiguredColumn,
  UnknownTableError,
} from '@/lib/table-config'

describe('table config allowlist', () => {
  it('exposes only pinned-bundle table configs', () => {
    expect(getTableConfigs().map(config => config.id)).toEqual([
      'experiments',
      'predictions',
      'detail-predictions',
    ])
  })

  it('resolves known tables and rejects unknown tables', () => {
    expect(getTableConfig('experiments').table.name).toBe(
      'experiments',
    )
    expect(getTableConfig('predictions').table.name).toBe(
      'predictions',
    )
    expect(() => getTableConfig('raw-local-table')).toThrow(UnknownTableError)
  })

  it('checks configured columns against a table config', () => {
    const config = getTableConfig('predictions')
    expect(isConfiguredColumn(config, 'prediction_id')).toBe(true)
    expect(isConfiguredColumn(config, 'drop table')).toBe(false)
  })

  it('exposes enriched prediction browse columns and facet filters', () => {
    const config = getTableConfig('predictions')
    const keys = config.columns.map(column => column.key)
    expect(keys).toEqual(
      expect.arrayContaining([
        'experiment_kind',
        'source',
        'generation_status',
        'scoring_status',
        'harness_failure_count',
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
