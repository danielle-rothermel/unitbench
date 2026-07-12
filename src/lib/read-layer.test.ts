import { describe, expect, it } from 'vitest'
import {
  parseCorrectnessCompressionRow,
  parseDistributionRow,
} from '@/lib/dashboard-model'

describe('parseCorrectnessCompressionRow', () => {
  it('maps a joined row into a typed point', () => {
    const point = parseCorrectnessCompressionRow({
      prediction_id: 'dr-dspy/encdec/prediction/abc',
      model: 'openai/gpt-5-nano',
      result_state: 'passed',
      score: 1,
      provider_cost: '0.0012',
      compression_ratio: '0.84',
    })

    expect(point).toEqual({
      predictionId: 'dr-dspy/encdec/prediction/abc',
      model: 'openai/gpt-5-nano',
      resultState: 'passed',
      score: 1,
      compressionRatio: 0.84,
      providerCost: 0.0012,
    })
  })

  it('maps non-numeric metric values to null instead of NaN', () => {
    const point = parseCorrectnessCompressionRow({
      prediction_id: 'x',
      model: 'm',
      result_state: 'failed',
      score: null,
      provider_cost: undefined,
      compression_ratio: 'not-a-number',
    })

    expect(point.score).toBeNull()
    expect(point.providerCost).toBeNull()
    expect(point.compressionRatio).toBeNull()
  })
})

describe('parseDistributionRow', () => {
  it('maps histogram rows', () => {
    expect(
      parseDistributionRow({ bucket: '3', result_state: 'failed', count: 41 }),
    ).toEqual({ bucket: 3, resultState: 'failed', count: 41 })
  })
})
