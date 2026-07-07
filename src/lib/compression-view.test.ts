import { describe, expect, it } from 'vitest'
import { makeCompressionResultRows, type CompressionMetric } from '@/fixtures/compression'
import {
  achievedTone,
  bestMetric,
  formatRatio,
  ratioDomainMax,
  ratioPercent,
} from '@/lib/compression-view'

function makeMetric(overrides: Partial<CompressionMetric> = {}): CompressionMetric {
  return {
    method: 'raw',
    ground_truth_bytes: 200,
    representation_bytes: 100,
    compressed_bytes: 100,
    ratio_to_ground_truth: 0.5,
    percent_reduction_vs_ground_truth: 50,
    ...overrides,
  }
}

function makeRatioRow(ratios: {
  target: number | null
  achieved: number | null
  best: number | null
}) {
  const [row] = makeCompressionResultRows({ seed: 1, taskCount: 1, samplesPerTarget: 1 })
  return {
    ...row,
    target_compression_ratio: ratios.target,
    achieved_compression_ratio: ratios.achieved,
    best_compression_ratio: ratios.best,
  }
}

describe('ratioDomainMax', () => {
  it('floors at 1.25 when every ratio is small', () => {
    const rows = [makeRatioRow({ target: 0.25, achieved: 0.3, best: 0.28 })]
    expect(ratioDomainMax(rows)).toBe(1.25)
  })

  it('covers the largest ratio across rows with padding', () => {
    const rows = [
      makeRatioRow({ target: 0.5, achieved: 0.4, best: 0.35 }),
      makeRatioRow({ target: 2.0, achieved: 1.8, best: 1.6 }),
    ]
    const domain = ratioDomainMax(rows)
    expect(domain).toBeGreaterThan(2.0)
  })

  it('ignores null ratios and still floors at 1.25', () => {
    const rows = [makeRatioRow({ target: null, achieved: null, best: null })]
    expect(ratioDomainMax(rows)).toBe(1.25)
  })
})

describe('ratioPercent', () => {
  it('maps a ratio to its percent of the domain', () => {
    expect(ratioPercent(0.5, 2)).toBe(25)
  })

  it('clamps values above the domain to 100', () => {
    expect(ratioPercent(3, 2)).toBe(100)
  })

  it('clamps negative values to 0', () => {
    expect(ratioPercent(-1, 2)).toBe(0)
  })

  it('returns 0 for a non-positive domain', () => {
    expect(ratioPercent(0.5, 0)).toBe(0)
  })

  it('returns 0 for non-finite input', () => {
    expect(ratioPercent(Number.NaN, 2)).toBe(0)
  })
})

describe('achievedTone', () => {
  it.each([
    { target: 0.5, achieved: 0.4, tone: 'green' },
    { target: 0.5, achieved: 0.5, tone: 'green' },
    { target: 0.5, achieved: 0.7, tone: 'yellow' },
    { target: 2.0, achieved: 1.4, tone: 'red' },
    { target: null, achieved: 1.4, tone: 'red' },
    { target: null, achieved: 0.8, tone: 'neutral' },
    { target: 0.5, achieved: null, tone: 'neutral' },
    { target: null, achieved: null, tone: 'neutral' },
  ])('target=$target achieved=$achieved → $tone', ({ target, achieved, tone }) => {
    expect(achievedTone(target, achieved)).toBe(tone)
  })
})

describe('formatRatio', () => {
  it('formats a ratio with two decimals and the times sign', () => {
    expect(formatRatio(0.44)).toBe('0.44×')
  })

  it('renders null as an em dash', () => {
    expect(formatRatio(null)).toBe('—')
  })
})

describe('bestMetric', () => {
  it('picks the metric with the minimum non-null ratio', () => {
    const metrics = [
      makeMetric({ method: 'raw', ratio_to_ground_truth: 0.5 }),
      makeMetric({ method: 'zstd', ratio_to_ground_truth: 0.41 }),
      makeMetric({ method: 'lzma', ratio_to_ground_truth: 0.45 }),
    ]
    expect(bestMetric(metrics)?.method).toBe('zstd')
  })

  it('skips null ratios', () => {
    const metrics = [
      makeMetric({ method: 'raw', ratio_to_ground_truth: null }),
      makeMetric({ method: 'gzip', ratio_to_ground_truth: 0.6 }),
    ]
    expect(bestMetric(metrics)?.method).toBe('gzip')
  })

  it('resolves ties to the first minimum', () => {
    const metrics = [
      makeMetric({ method: 'zlib', ratio_to_ground_truth: 0.4 }),
      makeMetric({ method: 'zstd', ratio_to_ground_truth: 0.4 }),
    ]
    expect(bestMetric(metrics)?.method).toBe('zlib')
  })

  it('returns null when every ratio is null', () => {
    const metrics = [makeMetric({ ratio_to_ground_truth: null })]
    expect(bestMetric(metrics)).toBeNull()
  })

  it('returns null for an empty metric list', () => {
    expect(bestMetric([])).toBeNull()
  })
})
