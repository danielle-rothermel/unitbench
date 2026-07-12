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

export async function getPredictionDetail(predictionId: string): Promise<PredictionDetailResult> {
  try {
    return await withDetailBundle(async (database, bundle) => {
      const queries = [
        database.query<PredictionDetail>(
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
      const detail = rows[0]
      if (!detail) return { status: 'not-found' } as const
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
