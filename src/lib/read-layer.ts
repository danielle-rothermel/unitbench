/**
 * The server-only dashboard query layer — the module that knows how
 * analytical rows are physically stored. Client-safe row parsing and view
 * models live in dashboard-model.ts. Today this queries a join over
 * the pinned Analysis Bundle. Its public signatures stay independent of
 * destination table names.
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
import { withAnalysisBundle } from '@/lib/bundle-adapter.server'
import { bundleIdentity, type BundleIdentity } from '@/lib/bundle-view'

export type {
  CompressionDistributionBin,
  CorrectnessCompressionPoint,
} from '@/lib/dashboard-model'

export const DASHBOARD_POINT_LIMIT = 1500

export type DashboardRead = Readonly<{
  points: readonly CorrectnessCompressionPoint[]
  distribution: readonly CompressionDistributionBin[]
  bundle: BundleIdentity
}>

async function readDashboard(
  database: Parameters<Parameters<typeof withAnalysisBundle>[0]>[0],
  predictions: string,
  limit: number,
): Promise<Pick<DashboardRead, 'points' | 'distribution'>> {
  const [distributionRows, pointRows] = await Promise.all([
    database.query(
      `SELECT width_bucket(compression_ratio, 0, $1, $2) AS bucket, result_state, count(*)::int AS count FROM ${predictions} WHERE experiment_kind = 'humaneval_encdec' AND compression_ratio IS NOT NULL AND result_state IN ('passed', 'failed') GROUP BY bucket, result_state ORDER BY bucket`,
      [DISTRIBUTION_MAX_RATIO, DISTRIBUTION_BUCKETS],
    ),
    database.query(
      `SELECT prediction_id, model, result_state, score, provider_cost, compression_ratio FROM ${predictions} WHERE experiment_kind = 'humaneval_encdec' AND compression_ratio IS NOT NULL AND result_state IN ('passed', 'failed') ORDER BY prediction_id LIMIT $1`,
      [limit],
    ),
  ])
  return { distribution: distributionRows.map(parseDistributionRow), points: pointRows.map(parseCorrectnessCompressionRow) }
}

export async function fetchDashboardRead(limit: number = DASHBOARD_POINT_LIMIT): Promise<DashboardRead> {
  return withAnalysisBundle(async (database, bundle) => ({
    ...(await readDashboard(database, bundle.members.predictions, limit)),
    bundle: bundleIdentity(bundle),
  }))
}

/**
 * Exact histogram over every qualifying prediction (not the scatter
 * sample): bucket 0..DISTRIBUTION_BUCKETS+1 per width_bucket semantics
 * (0 = below range, BUCKETS+1 = overflow beyond DISTRIBUTION_MAX_RATIO).
 */
export async function fetchCompressionDistribution(): Promise<
  CompressionDistributionBin[]
> {
  return withAnalysisBundle(async (database, bundle) => {
    const rows = await database.query(
      `
    SELECT
      width_bucket(
        compression_ratio,
        0,
        $1,
        $2
      ) AS bucket,
      result_state,
      count(*)::int AS count
    FROM ${bundle.members.predictions}
    WHERE experiment_kind = 'humaneval_encdec'
      AND compression_ratio IS NOT NULL
      AND result_state IN ('passed', 'failed')
    GROUP BY bucket, result_state
    ORDER BY bucket
  `,
      [DISTRIBUTION_MAX_RATIO, DISTRIBUTION_BUCKETS],
    )
    return rows.map(parseDistributionRow)
  })
}

export async function fetchCorrectnessCompressionPoints(
  limit: number = DASHBOARD_POINT_LIMIT,
): Promise<CorrectnessCompressionPoint[]> {
  return withAnalysisBundle(async (database, bundle) => {
    const rows = await database.query(
      `
    SELECT
      prediction_id,
      model,
      result_state,
      score,
      provider_cost,
      compression_ratio
    FROM ${bundle.members.predictions}
    WHERE experiment_kind = 'humaneval_encdec'
      AND compression_ratio IS NOT NULL
      AND result_state IN ('passed', 'failed')
    ORDER BY prediction_id
    LIMIT $1
  `,
      [limit],
    )
    return rows.map(parseCorrectnessCompressionRow)
  })
}
