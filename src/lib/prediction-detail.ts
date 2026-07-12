import { withDetailBundle } from '@/lib/bundle-adapter.server'
import { bundleFailure, bundleIdentity, type BundleIdentity, type BundleViewFailure } from '@/lib/bundle-view'

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

export type DetailProvenanceRecord = Readonly<Record<string, string | number | boolean | null>>
export type DetailProvenance = Readonly<{
  member: 'generation_runs' | 'node_attempts' | 'score_attempts' | 'score_harness_failures' | 'platform_attempts'
  rows: readonly DetailProvenanceRecord[]
}>

export type PredictionDetailResult =
  | { status: 'ok'; detail: PredictionDetail; provenance: readonly DetailProvenance[]; bundle: BundleIdentity }
  | { status: 'not-found' }
  | { status: 'failure'; failure: BundleViewFailure }

type DetailRow = Record<string, unknown>

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : typeof value === 'string' ? value : String(value)
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) throw new TypeError('Detail numeric projection is invalid')
  return parsed
}

function nullableInteger(value: unknown): number | null {
  const parsed = nullableNumber(value)
  if (parsed !== null && !Number.isSafeInteger(parsed)) throw new TypeError('Detail integer projection is invalid')
  return parsed
}

function jsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? null
  try { return JSON.parse(value) } catch { throw new TypeError('Detail JSON projection is invalid') }
}

export function parsePredictionDetailRow(row: DetailRow): PredictionDetail {
  const required = (name: string) => {
    const value = nullableString(row[name])
    if (!value) throw new TypeError(`Detail ${name} is required`)
    return value
  }
  return {
    prediction_id: required('prediction_id'), experiment_id: required('experiment_id'), source: required('source'),
    experiment_kind: required('experiment_kind'), task_id: nullableString(row.task_id),
    sample_index: nullableInteger(row.sample_index), model: nullableString(row.model),
    result_state: required('result_state'), generation_status: nullableString(row.generation_status),
    scoring_status: nullableString(row.scoring_status), harness_failure_count: nullableInteger(row.harness_failure_count) ?? 0,
    score: nullableNumber(row.score),
    provider_cost: nullableNumber(row.provider_cost), created_at: nullableString(row.created_at),
    updated_at: nullableString(row.updated_at), summary_json: jsonValue(row.summary_json),
    input_kind: nullableString(row.input_kind), input_text: nullableString(row.input_text),
    output_kind: nullableString(row.output_kind), output_text: nullableString(row.output_text),
    prompt_text: nullableString(row.prompt_text), code_text: nullableString(row.code_text),
    raw_generation: nullableString(row.raw_generation), metrics_json: jsonValue(row.metrics_json),
    request_json: jsonValue(row.request_json), response_json: jsonValue(row.response_json),
    validation_json: jsonValue(row.validation_json),
  }
}

export async function getPredictionDetail(predictionId: string): Promise<PredictionDetailResult> {
  try {
    return await withDetailBundle(async (database, bundle) => {
      const queries = [
        database.query<DetailRow>(
          `SELECT p.prediction_id, p.experiment_id, p.source, p.experiment_kind, p.task_id, p.sample_index, p.model, p.result_state, p.generation_status, p.scoring_status, p.harness_failure_count, p.score, p.provider_cost, p.created_at, p.updated_at, p.summary_json, d.input_kind, d.input_text, d.output_kind, d.output_text, d.prompt_text, d.code_text, d.raw_generation, d.metrics_json, d.request_json, d.response_json, d.validation_json FROM ${bundle.members.detail_predictions} p LEFT JOIN ${bundle.members.detail_prediction_payloads} d ON d.prediction_id = p.prediction_id WHERE p.prediction_id = $1 LIMIT 1`,
          [predictionId],
        ),
        ...([
          ['generation_runs', 'detail_generation_runs'], ['node_attempts', 'detail_node_attempts'],
          ['score_attempts', 'detail_score_attempts'], ['score_harness_failures', 'detail_score_harness_failures'],
          ['platform_attempts', 'detail_platform_attempts'],
        ] as const).map(([, member]) => database.query<DetailProvenanceRecord>(
          `SELECT * FROM ${bundle.members[member]} WHERE prediction_id = $1`, [predictionId],
        )),
      ] as const
      const [rows, ...provenanceRows] = await Promise.all(queries)
      const row = rows[0]
      if (!row) return { status: 'not-found' } as const
      const detail = parsePredictionDetailRow(row)
      const members = ['generation_runs', 'node_attempts', 'score_attempts', 'score_harness_failures', 'platform_attempts'] as const
      return {
        status: 'ok' as const, detail, bundle: bundleIdentity(bundle),
        provenance: members.map((member, index) => ({ member, rows: provenanceRows[index] ?? [] })),
      }
    })
  } catch (error) {
    return { status: 'failure', failure: bundleFailure(error) }
  }
}
