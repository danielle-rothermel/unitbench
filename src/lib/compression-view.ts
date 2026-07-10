/**
 * Pure view-model helpers for the compression-results visualizer (R3, REL-4).
 * No React here; components in src/components/compression consume these.
 * Design doc: docs/planning/viz-components/v0/workstreams/r3-compression-results.md.
 */

import type { CompressionMetric, CompressionResultRow } from '@/fixtures/compression'

/** Ratios ≤ this always fit on the axis so the 1.0 reference line stays visible. */
const RATIO_DOMAIN_FLOOR = 1.25

/** Headroom past the largest ratio so bars never touch the track edge. */
const RATIO_DOMAIN_PADDING = 1.1

export type AchievedTone = 'green' | 'yellow' | 'red' | 'neutral'

export const NULL_RATIO_LABEL = '—'

/**
 * Shared ratio-axis max for a group of rows: max of 1 and every non-null
 * target/achieved/best ratio, padded, floored at 1.25 so the 1.0 reference
 * line always sits inside the track.
 */
export function ratioDomainMax(rows: CompressionResultRow[]): number {
  const ratios = rows.flatMap(row =>
    [
      row.target_compression_ratio,
      row.achieved_compression_ratio,
      row.best_compression_ratio,
    ].filter((ratio): ratio is number => ratio !== null && Number.isFinite(ratio)),
  )
  return Math.max(RATIO_DOMAIN_FLOOR, Math.max(1, ...ratios) * RATIO_DOMAIN_PADDING)
}

/** Clamped 0–100 width (in percent) for a ratio bar on the shared axis. */
export function ratioPercent(value: number, domainMax: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(domainMax) || domainMax <= 0) {
    return 0
  }
  return Math.min(100, Math.max(0, (value / domainMax) * 100))
}

/**
 * Tone for the achieved bar: red past 1.0 (expansion), green within target,
 * yellow over target, neutral when either side is unknown.
 */
export function achievedTone(
  target: number | null,
  achieved: number | null,
): AchievedTone {
  if (achieved === null) return 'neutral'
  if (achieved > 1) return 'red'
  if (target === null) return 'neutral'
  return achieved <= target ? 'green' : 'yellow'
}

/** '0.44×' for numbers, '—' for null. */
export function formatRatio(value: number | null): string {
  if (value === null) return NULL_RATIO_LABEL
  return `${value.toFixed(2)}×`
}

/** Metric with the minimum non-null ratio_to_ground_truth; ties keep the first; null when none. */
export function bestMetric(metrics: CompressionMetric[]): CompressionMetric | null {
  let best: CompressionMetric | null = null
  for (const metric of metrics) {
    if (metric.ratio_to_ground_truth === null) continue
    if (
      best === null ||
      best.ratio_to_ground_truth === null ||
      metric.ratio_to_ground_truth < best.ratio_to_ground_truth
    ) {
      best = metric
    }
  }
  return best
}
