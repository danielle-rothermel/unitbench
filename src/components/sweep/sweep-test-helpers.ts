/**
 * Shared helpers for the sweep chart tests (not a test file itself).
 *
 * The multi-seed invariant loop from the plan lives here: every chart renders
 * fixture output for several seeds and must never emit NaN into a style/SVG
 * attribute or a literal "null"/"undefined" label.
 */
import { expect } from 'vitest'
import type { SweepMetricsRow } from '@/fixtures'

/** Seed list from the plan's test section. */
export const FUZZ_SEEDS = [1, 5, 9, 23, 47] as const

/** Hand-built row typed against the fixture type, so contract drift fails compilation. */
export function makeRow(overrides: Partial<SweepMetricsRow> = {}): SweepMetricsRow {
  return {
    model: 'openai/gpt-5.5-codex',
    task_id: null,
    experiment_kind: 'humaneval_encdec',
    n: 96,
    pass_count: 60,
    fail_count: 24,
    pending_count: 4,
    error_count: 8,
    rate_limit_count: 3,
    pass_rate: 0.625,
    avg_score: 0.625,
    stddev_score: 0.4841,
    avg_cost: 0.0042,
    total_cost: 0.4032,
    avg_latency_ms: 8410,
    p95_latency_ms: 22750,
    ...overrides,
  }
}

/** A row for a zero-n group, exactly as the generator emits it. */
export function makeZeroNRow(overrides: Partial<SweepMetricsRow> = {}): SweepMetricsRow {
  return makeRow({
    n: 0,
    pass_count: 0,
    fail_count: 0,
    pending_count: 0,
    error_count: 0,
    rate_limit_count: 0,
    pass_rate: null,
    avg_score: null,
    stddev_score: null,
    ...overrides,
  })
}

/** No NaN in any attribute (style, cx, width, …); no literal null/undefined/NaN text. */
export function expectNoRenderArtifacts(container: HTMLElement): void {
  for (const element of container.querySelectorAll('*')) {
    for (const attribute of element.attributes) {
      expect(
        attribute.value.includes('NaN'),
        `NaN in <${element.tagName.toLowerCase()} ${attribute.name}="${attribute.value}">`,
      ).toBe(false)
    }
  }
  const text = container.textContent ?? ''
  expect(
    /\b(?:null|undefined|NaN)\b/.test(text),
    `literal null/undefined/NaN rendered: "${text.slice(0, 200)}"`,
  ).toBe(false)
}

/** Percent width parsed from an inline style, for bar-scale assertions. */
export function styleWidthPercent(element: Element): number {
  const style = element.getAttribute('style') ?? ''
  const match = style.match(/width:\s*([\d.]+)%/)
  if (!match) throw new Error(`no percent width in style="${style}"`)
  return Number.parseFloat(match[1])
}
