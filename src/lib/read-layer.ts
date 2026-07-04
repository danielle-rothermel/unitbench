/**
 * The dashboard read layer — the single module that knows how
 * analytical rows are physically stored. Today: a join over
 * `published_predictions` + `published_prediction_details` with JSONB
 * extraction. When v1 projections land (see
 * docs/workbench/projections.md), only the SQL in here changes;
 * signatures and consumers stay put.
 */

import { neonSql } from '@/lib/neon'

export const DASHBOARD_POINT_LIMIT = 1500

export type CorrectnessCompressionPoint = {
  predictionId: string
  model: string
  resultState: string
  score: number | null
  compressionRatio: number | null
  providerCost: number | null
}

function asFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseCorrectnessCompressionRow(
  row: Record<string, unknown>,
): CorrectnessCompressionPoint {
  return {
    predictionId: String(row.prediction_id),
    model: String(row.model),
    resultState: String(row.result_state),
    score: asFiniteNumber(row.score),
    compressionRatio: asFiniteNumber(row.compression_ratio),
    providerCost: asFiniteNumber(row.provider_cost),
  }
}

export const DISTRIBUTION_MAX_RATIO = 3
export const DISTRIBUTION_BUCKETS = 12

export type CompressionDistributionBin = {
  bucket: number
  resultState: string
  count: number
}

export function parseDistributionRow(
  row: Record<string, unknown>,
): CompressionDistributionBin {
  return {
    bucket: Number(row.bucket),
    resultState: String(row.result_state),
    count: Number(row.count),
  }
}

/**
 * Exact histogram over every qualifying prediction (not the scatter
 * sample): bucket 0..DISTRIBUTION_BUCKETS+1 per width_bucket semantics
 * (0 = below range, BUCKETS+1 = overflow beyond DISTRIBUTION_MAX_RATIO).
 */
export async function fetchCompressionDistribution(): Promise<
  CompressionDistributionBin[]
> {
  const sql = neonSql()
  const rows = (await sql`
    SELECT
      width_bucket(
        (d.metrics_json ->> 'best_compression_ratio')::float8,
        0,
        ${DISTRIBUTION_MAX_RATIO},
        ${DISTRIBUTION_BUCKETS}
      ) AS bucket,
      p.result_state,
      count(*)::int AS count
    FROM published_predictions p
    JOIN published_prediction_details d USING (prediction_id)
    WHERE p.experiment_kind = 'humaneval_encdec'
      AND d.metrics_json ? 'best_compression_ratio'
      AND p.result_state IN ('passed', 'failed')
    GROUP BY bucket, p.result_state
    ORDER BY bucket
  `) as Record<string, unknown>[]
  return rows.map(parseDistributionRow)
}

export async function fetchCorrectnessCompressionPoints(
  limit: number = DASHBOARD_POINT_LIMIT,
): Promise<CorrectnessCompressionPoint[]> {
  const sql = neonSql()
  const rows = (await sql`
    SELECT
      p.prediction_id,
      p.model,
      p.result_state,
      p.score,
      p.provider_cost,
      (d.metrics_json ->> 'best_compression_ratio')::float8 AS compression_ratio
    FROM published_predictions p
    JOIN published_prediction_details d USING (prediction_id)
    WHERE p.experiment_kind = 'humaneval_encdec'
      AND d.metrics_json ? 'best_compression_ratio'
      AND p.result_state IN ('passed', 'failed')
    ORDER BY p.prediction_id
    LIMIT ${limit}
  `) as Record<string, unknown>[]
  return rows.map(parseCorrectnessCompressionRow)
}
