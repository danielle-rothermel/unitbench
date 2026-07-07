import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeBootstrapSampleRows } from '@/fixtures/bootstrap'
import { CiWidthVsNChart } from '@/components/bootstrap/CiWidthVsNChart'
import { computeCisAcrossN, observeGroups } from '@/lib/bootstrap-ci'

const SWEEP_CONFIG = { seed: 17, n_resamples: 500, confidence_level: 0.95 }
const LADDER = [2, 8, 32]

// 4 models x 6 tasks x 3 samples -> 18 available per model group
const rows = makeBootstrapSampleRows({ seed: 12, taskCount: 6 })
const observations = observeGroups(rows, 'model')
const ciByN = computeCisAcrossN(rows, 'model', SWEEP_CONFIG, LADDER)

function intervalsBySeries(container: HTMLElement): Map<string, Element[]> {
  const bySeries = new Map<string, Element[]>()
  for (const interval of container.querySelectorAll('[data-ci-interval]')) {
    const series = interval.getAttribute('data-series') ?? ''
    bySeries.set(series, [...(bySeries.get(series) ?? []), interval])
  }
  return bySeries
}

describe('CiWidthVsNChart', () => {
  it('renders one interval per ladder N per series', () => {
    const { container } = render(
      <CiWidthVsNChart ciByN={ciByN} observations={observations} />,
    )

    const bySeries = intervalsBySeries(container)
    expect(bySeries.size).toBe(4)
    for (const intervals of bySeries.values()) {
      expect(
        intervals.map(interval => Number(interval.getAttribute('data-n'))),
      ).toEqual(LADDER)
    }
  })

  it('renders narrower intervals at the largest N than at the smallest N', () => {
    const { container } = render(
      <CiWidthVsNChart ciByN={ciByN} observations={observations} />,
    )

    for (const intervals of intervalsBySeries(container).values()) {
      const widthAt = (n: number) =>
        Number(
          intervals
            .find(interval => interval.getAttribute('data-n') === String(n))
            ?.getAttribute('data-width'),
        )
      expect(widthAt(Math.max(...LADDER))).toBeLessThan(widthAt(Math.min(...LADDER)))
    }
  })

  it('marks ladder entries beyond the available samples as extrapolated', () => {
    const { container } = render(
      <CiWidthVsNChart ciByN={ciByN} observations={observations} />,
    )

    for (const interval of container.querySelectorAll('[data-ci-interval]')) {
      const n = Number(interval.getAttribute('data-n'))
      const expected = n > 18 ? 'true' : null
      expect(interval.getAttribute('data-extrapolated')).toBe(expected)
    }
  })

  it('renders the width strip with a threshold reference line', () => {
    const { container } = render(
      <CiWidthVsNChart
        ciByN={ciByN}
        observations={observations}
        thresholdWidth={0.2}
      />,
    )

    expect(container.querySelector('[data-width-threshold]')).not.toBeNull()
    expect(container.textContent).toContain('width ≤ 0.2')
    expect(container.querySelectorAll('[data-width-series]')).toHaveLength(4)
  })

  it('falls back to small multiples above six series', () => {
    // model x task over 4 models and 6 tasks -> 24 series
    const modelTaskObservations = observeGroups(rows, 'model_task')
    const modelTaskCiByN = computeCisAcrossN(rows, 'model_task', SWEEP_CONFIG, LADDER)
    const { container } = render(
      <CiWidthVsNChart ciByN={modelTaskCiByN} observations={modelTaskObservations} />,
    )

    // One mini fan svg per series plus the width strip
    expect(container.querySelectorAll('svg')).toHaveLength(24 + 1)
  })
})
