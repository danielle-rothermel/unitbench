/**
 * The server-only dashboard query layer — the module that knows how
 * analytical rows are physically stored. Client-safe row parsing and view
 * models live in dashboard-model.ts. Today this queries a join over
 * `published_predictions` + `published_prediction_details` with JSONB
 * extraction. When v1 projections land (see
 * docs/workbench/projections.md), only the SQL in here changes;
 * signatures and consumers stay put.
 */

import 'server-only'

import {
  DISTRIBUTION_BUCKETS,
  DISTRIBUTION_MAX_RATIO,
  parseCorrectnessCompressionRow,
  parseDistributionRow,
  type CompressionDistributionBin,
  type CorrectnessCompressionPoint,
} from '@/lib/dashboard-model'
import { neonSql } from '@/lib/neon'

export type {
  CompressionDistributionBin,
  CorrectnessCompressionPoint,
} from '@/lib/dashboard-model'

export const DASHBOARD_POINT_LIMIT = 1500

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
