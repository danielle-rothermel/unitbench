import { describe, expect, it } from 'vitest'
import {
  parseCorrectnessCompressionRow,
  parseDistributionRow,
} from '@/lib/dashboard-model'

const LOCAL_DUCKDB_POINT_ROW = {
  prediction_id: 'prediction/parity-1',
  model: 'openai/gpt-5-nano',
  result_state: 'passed',
  score: 1,
  provider_cost: 0.0012,
  compression_ratio: 0.84,
}

const MOTHERDUCK_POSTGRES_POINT_ROW = {
  ...LOCAL_DUCKDB_POINT_ROW,
  score: '1',
  provider_cost: '0.0012',
  compression_ratio: '0.84',
}

describe('Analysis adapter parity prerequisites', () => {
  it('maps the same point fixture to one view model across drivers', () => {
    expect(parseCorrectnessCompressionRow(LOCAL_DUCKDB_POINT_ROW)).toEqual(
      parseCorrectnessCompressionRow(MOTHERDUCK_POSTGRES_POINT_ROW),
    )
  })

  it('maps integer aggregates identically across driver representations', () => {
    expect(
      parseDistributionRow({
        bucket: 3,
        result_state: 'failed',
        count: BigInt(41),
      }),
    ).toEqual(
      parseDistributionRow({
        bucket: '3',
        result_state: 'failed',
        count: '41',
      }),
    )
  })
})
