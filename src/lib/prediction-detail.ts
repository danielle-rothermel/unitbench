import { MissingDatabaseUrlError, neonSql } from '@/lib/neon'
import {
  PUBLISHED_PREDICTION_DETAIL_TABLES,
  type DetailTables,
} from '@/lib/table-config'
import { quoteIdentifier } from '@/lib/sql-identifiers'

export type PredictionDetail = {
  prediction_id: string
  experiment_id: string
  source: string
  experiment_kind: string
  task_id: string | null
  sample_index: number | null
  model: string | null
  result_state: string
  generation_status: string | null
  scoring_status: string | null
  harness_failure_count: number
  score: number | null
  provider_cost: number | null
  created_at: string | null
  updated_at: string | null
  summary_json: unknown
  input_kind: string | null
  input_text: string | null
  output_kind: string | null
  output_text: string | null
  prompt_text: string | null
  code_text: string | null
  raw_generation: string | null
  metrics_json: unknown
  request_json: unknown
  response_json: unknown
  validation_json: unknown
}

export type PredictionDetailResult =
  | { status: 'ok'; detail: PredictionDetail }
  | { status: 'not-found' }
  | { status: 'missing-url' }
  | { status: 'error'; message: string }

function predictionDetailSql(tables: DetailTables): string {
  const predictions = quoteIdentifier(tables.predictions.name)
  const details = quoteIdentifier(tables.details.name)
  return `
SELECT
  p.prediction_id,
  p.experiment_id,
  p.source,
  p.experiment_kind,
  p.task_id,
  p.sample_index,
  p.model,
  p.result_state,
  p.generation_status,
  p.scoring_status,
  p.harness_failure_count,
  p.score,
  p.provider_cost,
  p.created_at,
  p.updated_at,
  p.summary_json,
  d.input_kind,
  d.input_text,
  d.output_kind,
  d.output_text,
  d.prompt_text,
  d.code_text,
  d.raw_generation,
  d.metrics_json,
  d.request_json,
  d.response_json,
  d.validation_json
FROM ${predictions} p
LEFT JOIN ${details} d
  ON d.prediction_id = p.prediction_id
WHERE p.prediction_id = $1
LIMIT 1
`
}

export async function getPredictionDetail(
  predictionId: string,
  tables: DetailTables = PUBLISHED_PREDICTION_DETAIL_TABLES,
): Promise<PredictionDetailResult> {
  try {
    const sql = neonSql()
    const rows = (await sql.query(predictionDetailSql(tables), [
      predictionId,
    ])) as PredictionDetail[]
    const detail = rows[0]
    if (!detail) return { status: 'not-found' }
    return { status: 'ok', detail }
  } catch (error) {
    if (error instanceof MissingDatabaseUrlError) {
      return { status: 'missing-url' }
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}
