import { describe, expect, it } from 'vitest'
import { makeBootstrapSampleRows, type BootstrapSampleRow } from '@/fixtures/bootstrap'
import {
  DEFAULT_BOOTSTRAP_CONFIG,
  computeBootstrapCis,
  computeCisAcrossN,
  observeGroups,
  type BootstrapCiConfig,
} from '@/lib/bootstrap-ci'

const CONFIG: BootstrapCiConfig = { ...DEFAULT_BOOTSTRAP_CONFIG, n_resamples: 500 }

function handcraftedRow(overrides: Partial<BootstrapSampleRow>): BootstrapSampleRow {
  return {
    experiment_id: 'dr-dspy-v1/encdec/handcrafted',
    experiment_kind: 'humaneval_encdec',
    model: 'model-a',
    task_id: 'HumanEval/0',
    sample_index: 0,
    passed: true,
    score: 1.0,
    ...overrides,
  }
}

describe('computeBootstrapCis', () => {
  const rows = makeBootstrapSampleRows({ seed: 12 })

  it('is deterministic for identical rows, grouping, and config', () => {
    expect(computeBootstrapCis(rows, 'model', CONFIG)).toEqual(
      computeBootstrapCis(rows, 'model', CONFIG),
    )
  })

  it('is independent of input row order', () => {
    const shuffled = [...rows].reverse()
    expect(computeBootstrapCis(shuffled, 'model', CONFIG)).toEqual(
      computeBootstrapCis(rows, 'model', CONFIG),
    )
  })

  it('changes at least one bound when the seed changes', () => {
    const seedA = computeBootstrapCis(rows, 'model', CONFIG)
    const seedB = computeBootstrapCis(rows, 'model', { ...CONFIG, seed: CONFIG.seed + 1 })
    const differs = seedA.some(
      (summary, index) =>
        summary.ci_low !== seedB[index].ci_low ||
        summary.ci_high !== seedB[index].ci_high,
    )
    expect(differs).toBe(true)
  })

  it('gives each group a stream independent of which other groups are present', () => {
    const allModels = computeBootstrapCis(rows, 'model', CONFIG)
    const oneModel = rows[0].model
    const oneModelOnly = computeBootstrapCis(
      rows.filter(row => row.model === oneModel),
      'model',
      CONFIG,
    )
    expect(oneModelOnly).toHaveLength(1)
    expect(allModels.find(summary => summary.model === oneModel)).toEqual(
      oneModelOnly[0],
    )
  })

  it('bounds contain the observed rate and stay inside [0, 1], echoing the config', () => {
    for (const grouping of ['model', 'task', 'model_task', 'overall'] as const) {
      for (const summary of computeBootstrapCis(rows, grouping, CONFIG)) {
        expect(summary.ci_low).toBeGreaterThanOrEqual(0)
        expect(summary.ci_low).toBeLessThanOrEqual(summary.observed_pass_rate)
        expect(summary.ci_high).toBeGreaterThanOrEqual(summary.observed_pass_rate)
        expect(summary.ci_high).toBeLessThanOrEqual(1)
        expect(summary.confidence_level).toBe(CONFIG.confidence_level)
        expect(summary.n_resamples).toBe(CONFIG.n_resamples)
        expect(summary.seed).toBe(CONFIG.seed)
      }
    }
  })

  it('shrinks mean CI width strictly as N grows (3 -> 12 -> 48)', () => {
    const deepRows = makeBootstrapSampleRows({ seed: 5, samplesPerTask: 50 })
    const meanWidthAt = (n: number) => {
      const summaries = computeBootstrapCis(deepRows, 'model', {
        ...CONFIG,
        n_resamples: 1000,
        n_per_group: n,
      })
      const totalWidth = summaries.reduce(
        (total, summary) => total + (summary.ci_high - summary.ci_low),
        0,
      )
      return totalWidth / summaries.length
    }
    const widthAt3 = meanWidthAt(3)
    const widthAt12 = meanWidthAt(12)
    const widthAt48 = meanWidthAt(48)
    expect(widthAt3).toBeGreaterThan(widthAt12)
    expect(widthAt12).toBeGreaterThan(widthAt48)
  })

  it('nests the 0.80 CI inside the 0.99 CI for the same group and seed', () => {
    const narrow = computeBootstrapCis(rows, 'model', { ...CONFIG, confidence_level: 0.8 })
    const wide = computeBootstrapCis(rows, 'model', { ...CONFIG, confidence_level: 0.99 })
    for (const [index, narrowSummary] of narrow.entries()) {
      expect(wide[index].ci_low).toBeLessThanOrEqual(narrowSummary.ci_low)
      expect(wide[index].ci_high).toBeGreaterThanOrEqual(narrowSummary.ci_high)
    }
  })

  it('returns degenerate [1, 1] for all-pass and [0, 0] for all-fail groups', () => {
    const allPass = [0, 1, 2].map(sample_index =>
      handcraftedRow({ sample_index, passed: true, score: 1.0 }),
    )
    const allFail = [0, 1, 2].map(sample_index =>
      handcraftedRow({ task_id: 'HumanEval/1', sample_index, passed: false, score: 0.0 }),
    )
    const summaries = computeBootstrapCis([...allPass, ...allFail], 'task', CONFIG)
    expect(summaries).toEqual([
      expect.objectContaining({
        task_id: 'HumanEval/0',
        observed_pass_rate: 1,
        ci_low: 1,
        ci_high: 1,
      }),
      expect.objectContaining({
        task_id: 'HumanEval/1',
        observed_pass_rate: 0,
        ci_low: 0,
        ci_high: 0,
      }),
    ])
  })

  it('returns a degenerate CI at the single observation for an n=1 group', () => {
    const summaries = computeBootstrapCis(
      [handcraftedRow({ passed: false, score: 0.0 })],
      'model',
      CONFIG,
    )
    expect(summaries).toEqual([
      expect.objectContaining({
        model: 'model-a',
        n_samples: 1,
        observed_pass_rate: 0,
        ci_low: 0,
        ci_high: 0,
      }),
    ])
  })

  it('returns [] for empty input', () => {
    expect(computeBootstrapCis([], 'model', CONFIG)).toEqual([])
    expect(computeBootstrapCis([], 'overall', CONFIG)).toEqual([])
  })

  it('allows m > n draws and reports the requested N', () => {
    const threeSamples = [0, 1, 2].map(sample_index =>
      handcraftedRow({ sample_index, passed: sample_index !== 1, score: null }),
    )
    const [summary] = computeBootstrapCis(threeSamples, 'model', {
      ...CONFIG,
      n_per_group: 40,
    })
    expect(summary.n_samples).toBe(40)
    expect(summary.ci_low).toBeGreaterThanOrEqual(0)
    expect(summary.ci_high).toBeLessThanOrEqual(1)
    expect(summary.ci_low).toBeLessThan(summary.ci_high)
  })

  it.each([
    ['n_per_group: 0', { n_per_group: 0 }],
    ['n_per_group: 2.5', { n_per_group: 2.5 }],
    ['n_resamples: 0', { n_resamples: 0 }],
    ['confidence_level: 1.2', { confidence_level: 1.2 }],
    ['confidence_level: 0', { confidence_level: 0 }],
    ['seed: 1.5', { seed: 1.5 }],
  ] as const)('throws on invalid config (%s)', (_label, override) => {
    expect(() => computeBootstrapCis(rows, 'model', { ...CONFIG, ...override })).toThrow()
  })

  it('populates null group keys per grouping', () => {
    const modelSummaries = computeBootstrapCis(rows, 'model', CONFIG)
    expect(modelSummaries.every(summary => summary.task_id === null)).toBe(true)
    expect(modelSummaries.every(summary => summary.model !== null)).toBe(true)

    const taskSummaries = computeBootstrapCis(rows, 'task', CONFIG)
    expect(taskSummaries.every(summary => summary.model === null)).toBe(true)
    expect(taskSummaries.every(summary => summary.task_id !== null)).toBe(true)

    const overall = computeBootstrapCis(rows, 'overall', CONFIG)
    expect(overall).toHaveLength(1)
    expect(overall[0].model).toBeNull()
    expect(overall[0].task_id).toBeNull()

    const modelTask = computeBootstrapCis(rows, 'model_task', CONFIG)
    expect(
      modelTask.every(summary => summary.model !== null && summary.task_id !== null),
    ).toBe(true)
  })
})

describe('computeCisAcrossN', () => {
  it('returns one batch per ladder N, each matching a direct call', () => {
    const rows = makeBootstrapSampleRows({ seed: 12, taskCount: 6 })
    const ladder = [2, 5, 10]
    const batches = computeCisAcrossN(rows, 'model', CONFIG, ladder)
    expect(batches.map(batch => batch.n)).toEqual(ladder)
    for (const batch of batches) {
      expect(batch.summaries).toEqual(
        computeBootstrapCis(rows, 'model', { ...CONFIG, n_per_group: batch.n }),
      )
    }
  })
})

describe('observeGroups', () => {
  it('returns [] for empty input', () => {
    expect(observeGroups([], 'model')).toEqual([])
    expect(observeGroups([], 'model_task')).toEqual([])
  })

  it('reports missing model x task combinations with n_available 0', () => {
    const rows = [
      handcraftedRow({ model: 'model-a', task_id: 'HumanEval/0' }),
      handcraftedRow({ model: 'model-a', task_id: 'HumanEval/1', passed: false }),
      handcraftedRow({ model: 'model-b', task_id: 'HumanEval/0' }),
    ]
    const observations = observeGroups(rows, 'model_task')
    expect(observations).toEqual([
      { model: 'model-a', task_id: 'HumanEval/0', n_available: 1, observed_pass_rate: 1 },
      { model: 'model-a', task_id: 'HumanEval/1', n_available: 1, observed_pass_rate: 0 },
      { model: 'model-b', task_id: 'HumanEval/0', n_available: 1, observed_pass_rate: 1 },
      { model: 'model-b', task_id: 'HumanEval/1', n_available: 0, observed_pass_rate: null },
    ])
    const summaries = computeBootstrapCis(rows, 'model_task', CONFIG)
    expect(summaries).toHaveLength(3)
    expect(
      summaries.some(
        summary => summary.model === 'model-b' && summary.task_id === 'HumanEval/1',
      ),
    ).toBe(false)
  })

  it('counts available samples per group', () => {
    const rows = makeBootstrapSampleRows({
      seed: 3,
      models: ['m1', 'm2'],
      taskCount: 4,
      samplesPerTask: 3,
    })
    const observations = observeGroups(rows, 'model')
    expect(observations.map(observation => observation.model)).toEqual(['m1', 'm2'])
    expect(observations.every(observation => observation.n_available === 12)).toBe(true)
  })
})
