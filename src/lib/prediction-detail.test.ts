import { describe, expect, it } from 'vitest'
import { parsePredictionDetailRow } from '@/lib/prediction-detail'

const row = {
  prediction_id: 'dr-dspy/encdec/prediction/abc', experiment_id: 'experiment-1', source: 'benchmark',
  experiment_kind: 'encdec', task_id: null, sample_index: '2', model: 'model', result_state: 'passed',
  generation_status: 'completed', scoring_status: 'completed', score: '1.0', provider_cost: '0.0125',
  created_at: '2026-07-12T12:34:56+00:00', updated_at: null, summary_json: '{"score":"001"}',
  input_kind: null, input_text: null, output_kind: null, output_text: null, prompt_text: null,
  code_text: null, raw_generation: null, metrics_json: '{"x":1}', request_json: null,
  response_json: null, validation_json: null,
}

describe('parsePredictionDetailRow', () => {
  it('normalizes driver strings into the typed Detail view model', () => {
    const detail = parsePredictionDetailRow(row)
    expect(detail.score).toBe(1)
    expect(detail.provider_cost).toBe(0.0125)
    expect(detail.sample_index).toBe(2)
    expect(detail.summary_json).toEqual({ score: '001' })
  })

  it('rejects invalid typed projections at the database boundary', () => {
    expect(() => parsePredictionDetailRow({ ...row, score: 'not-a-number' })).toThrow(
      'Detail numeric projection is invalid',
    )
  })
})
