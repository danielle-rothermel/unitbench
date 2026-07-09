import { describe, expect, it } from 'vitest'
import {
  experimentKindForLayout,
  fixtureExperimentId,
  fixturePredictionId,
  fixtureTaskIds,
  makeSampleIdentity,
} from '@/fixtures/primitives'

describe('fixtureExperimentId', () => {
  it('matches the dr_dspy_v1 experiment_id format', () => {
    expect(fixtureExperimentId('encdec', 'coarse-budget-01')).toBe(
      'dr-dspy-v1/encdec/coarse-budget-01',
    )
  })
})

describe('fixturePredictionId', () => {
  it('matches the dr_dspy_v1 published_prediction_id format', () => {
    expect(fixturePredictionId('direct', 'pred-1')).toBe(
      'dr-dspy-v1/direct/prediction/pred-1',
    )
  })
})

describe('experimentKindForLayout', () => {
  it('maps layouts to experiment kinds', () => {
    expect(experimentKindForLayout('direct')).toBe('humaneval_direct')
    expect(experimentKindForLayout('encdec')).toBe('humaneval_encdec')
  })
})

describe('fixtureTaskIds', () => {
  it('produces HumanEval-style ids', () => {
    expect(fixtureTaskIds(3)).toEqual(['HumanEval/0', 'HumanEval/1', 'HumanEval/2'])
  })
})

describe('makeSampleIdentity', () => {
  it('derives a consistent identity from task, model, and sample', () => {
    const identity = makeSampleIdentity({
      layout: 'encdec',
      task_id: 'HumanEval/12',
      model: 'openai/gpt-5.5-codex',
      sample_index: 2,
    })
    expect(identity).toEqual({
      prediction_id: 'dr-dspy-v1/encdec/prediction/pred-humaneval-12-s2',
      experiment_id: 'dr-dspy-v1/encdec/coarse-budget-01',
      experiment_kind: 'humaneval_encdec',
      task_id: 'HumanEval/12',
      model: 'openai/gpt-5.5-codex',
      sample_index: 2,
    })
  })
})
