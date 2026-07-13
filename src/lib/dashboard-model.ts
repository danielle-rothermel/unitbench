export const DISTRIBUTION_MAX_RATIO = 3
export const DISTRIBUTION_BUCKETS = 12

export type CorrectnessCompressionPoint = {
  predictionId: string
  model: string
  resultState: string
  score: number | null
  compressionRatio: number | null
  providerCost: number | null
}

export type CompressionDistributionBin = {
  bucket: number
  resultState: string
  count: number
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

export function parseDistributionRow(
  row: Record<string, unknown>,
): CompressionDistributionBin {
  return {
    bucket: Number(row.bucket),
    resultState: String(row.result_state),
    count: Number(row.count),
  }
}
