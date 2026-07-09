import { shortDate } from '@/lib/format'
import type { PredictionDetail } from '@/lib/prediction-detail'

export type StageStatus =
  | 'passed'
  | 'failed'
  | 'pending'
  | 'skipped'
  | 'unknown'
  | 'completed'
  | 'inconsistent'

export type PipelineStageId =
  | 'generation'
  | 'extraction'
  | 'compile'
  | 'evaluation'
  | 'scoring'

export type PipelineStageInfo = {
  id: PipelineStageId
  label: string
  status: StageStatus
  statusLabel?: string
  detail: string | null
}

export type PredictionDiagnostics = {
  primaryFailureReason: string | null
  pipelineStages: PipelineStageInfo[]
  testSummary: string | null
}

export type RunConfigField = {
  label: string
  value: string
}

export type ReferenceFields = {
  canonicalSolution: string | null
  groundTruthCode: string | null
  test: string | null
  entryPoint: string | null
}

export type EncdecPipelineData = {
  prompt: string | null
  encodedDescription: string | null
  decodedGeneration: string | null
  encoderCost: number | null
  decoderCost: number | null
}

export type OutcomeBanner = {
  tone: 'error' | 'warning'
  title: string
  message: string
}

const ENCDEC_KIND = 'humaneval_encdec'
const FAILURE_REASON_MAX = 60

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asBool(value: unknown): boolean | null {
  if (value === true || value === false) return value
  return null
}

function asInt(value: unknown): number | null {
  const parsed = asNumber(value)
  if (parsed === null || !Number.isInteger(parsed)) return null
  return parsed
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const text = asString(value)
    if (text) return text
  }
  return null
}

function formatConfigValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
  }
  return asString(value)
}

export function truncateFailureReason(reason: string | null): string | null {
  if (!reason) return null
  if (reason.length <= FAILURE_REASON_MAX) return reason
  return `${reason.slice(0, FAILURE_REASON_MAX - 1)}…`
}

function buildGenerationStage(
  detail: PredictionDetail,
  validation: Record<string, unknown>,
): PipelineStageInfo {
  const status = detail.generation_status
  if (status === 'generated') {
    return {
      id: 'generation',
      label: 'Generation',
      status: 'passed',
      detail: null,
    }
  }
  if (status === 'generation_error') {
    return {
      id: 'generation',
      label: 'Generation',
      status: 'failed',
      detail: firstNonEmpty(
        asString(validation.generation_exception_message),
        asString(validation.generation_failure_class),
      ),
    }
  }
  if (status === 'pending' || status === 'queued' || status === 'started') {
    return {
      id: 'generation',
      label: 'Generation',
      status: 'pending',
      detail: status,
    }
  }
  return {
    id: 'generation',
    label: 'Generation',
    status: 'unknown',
    detail: status,
  }
}

function buildExtractionStage(validation: Record<string, unknown>): PipelineStageInfo {
  const extractionError = asString(validation.extraction_error)
  if (extractionError) {
    return {
      id: 'extraction',
      label: 'Extraction',
      status: 'failed',
      detail: extractionError,
    }
  }

  const candidateCount = asInt(validation.extraction_candidate_count)
  if (candidateCount !== null) {
    const selectedIndex = asInt(validation.selected_candidate_index)
    const detail =
      selectedIndex !== null
        ? `${candidateCount} candidate${candidateCount === 1 ? '' : 's'}, selected #${selectedIndex}`
        : `${candidateCount} candidate${candidateCount === 1 ? '' : 's'}`
    return {
      id: 'extraction',
      label: 'Extraction',
      status: 'passed',
      detail,
    }
  }

  return {
    id: 'extraction',
    label: 'Extraction',
    status: 'skipped',
    detail: null,
  }
}

function buildCompileStage(validation: Record<string, unknown>): PipelineStageInfo {
  const rawCompileOk = asBool(validation.raw_compile_ok)
  const extractedCompileOk = asBool(validation.extracted_compile_ok)
  const details: string[] = []

  if (rawCompileOk === false) {
    return {
      id: 'compile',
      label: 'Compile',
      status: 'failed',
      detail: firstNonEmpty(asString(validation.raw_compile_error)),
    }
  }

  if (rawCompileOk === true) {
    details.push('raw ok')
  }

  if (extractedCompileOk === false) {
    return {
      id: 'compile',
      label: 'Compile',
      status: 'failed',
      detail: firstNonEmpty(asString(validation.extracted_compile_error)),
    }
  }

  if (extractedCompileOk === true) {
    details.push('extracted ok')
  }

  if (rawCompileOk === true || extractedCompileOk === true) {
    return {
      id: 'compile',
      label: 'Compile',
      status: 'passed',
      detail: details.length > 0 ? details.join(' · ') : null,
    }
  }

  return {
    id: 'compile',
    label: 'Compile',
    status: 'unknown',
    detail: null,
  }
}

export function formatInconsistentEvaluation(
  failures: number,
  total: number,
): string {
  return `${failures} failures reported for ${total} evaluation case${total === 1 ? '' : 's'} — inconsistent data`
}

function buildEvaluationStage(metrics: Record<string, unknown>): {
  stage: PipelineStageInfo
  testSummary: string | null
} {
  const totalCases = asInt(metrics.evaluation_total_cases)
  const failureCount = asInt(metrics.evaluation_failure_count)

  if (totalCases === null && failureCount === null) {
    return {
      stage: {
        id: 'evaluation',
        label: 'Evaluation',
        status: 'unknown',
        detail: null,
      },
      testSummary: null,
    }
  }

  if (totalCases !== null && failureCount !== null && failureCount > totalCases) {
    const marker = formatInconsistentEvaluation(failureCount, totalCases)
    return {
      stage: {
        id: 'evaluation',
        label: 'Evaluation',
        status: 'inconsistent',
        statusLabel: 'inconsistent data',
        detail: marker,
      },
      testSummary: marker,
    }
  }

  const total = totalCases ?? 0
  const failures = failureCount ?? 0
  const passed = Math.max(total - failures, 0)
  const testSummary =
    total > 0 ? `${passed}/${total} evaluation case${total === 1 ? '' : 's'} passed` : null

  if (total === 0) {
    return {
      stage: {
        id: 'evaluation',
        label: 'Evaluation',
        status: 'unknown',
        detail: null,
      },
      testSummary,
    }
  }

  if (failures > 0) {
    return {
      stage: {
        id: 'evaluation',
        label: 'Evaluation',
        status: 'failed',
        detail: `${failures}/${total} failed`,
      },
      testSummary,
    }
  }

  return {
    stage: {
      id: 'evaluation',
      label: 'Evaluation',
      status: 'passed',
      detail: testSummary,
    },
    testSummary,
  }
}

function buildScoringStage(detail: PredictionDetail): PipelineStageInfo {
  const status = detail.scoring_status
  if (status === 'scored') {
    return {
      id: 'scoring',
      label: 'Scoring',
      status: 'completed',
      statusLabel: 'scored',
      detail: detail.score === null ? null : `score ${detail.score.toFixed(2)}`,
    }
  }
  if (status === 'score_error' || status === 'scoring_error') {
    return {
      id: 'scoring',
      label: 'Scoring',
      status: 'failed',
      detail: status,
    }
  }
  if (status === 'pending' || status === 'score_pending') {
    return {
      id: 'scoring',
      label: 'Scoring',
      status: 'pending',
      detail: status,
    }
  }
  return {
    id: 'scoring',
    label: 'Scoring',
    status: 'unknown',
    detail: status,
  }
}

function derivePrimaryFailureReason(
  detail: PredictionDetail,
  validation: Record<string, unknown>,
  metrics: Record<string, unknown>,
): string | null {
  const generationReason = firstNonEmpty(
    asString(validation.generation_exception_message),
    asString(validation.generation_failure_class),
  )
  if (generationReason) return generationReason

  const extractionError = asString(validation.extraction_error)
  if (extractionError) return extractionError

  if (asBool(validation.raw_compile_ok) === false) {
    const compileError = asString(validation.raw_compile_error)
    if (compileError) return compileError
    return 'Raw generation failed to compile'
  }

  if (asBool(validation.extracted_compile_ok) === false) {
    const compileError = asString(validation.extracted_compile_error)
    if (compileError) return compileError
    return 'Extracted code failed to compile'
  }

  const scoringReason = firstNonEmpty(
    asString(validation.scoring_exception_message),
    asString(validation.scoring_failure_class),
  )
  if (scoringReason) return scoringReason

  const totalCases = asInt(metrics.evaluation_total_cases)
  const failureCount = asInt(metrics.evaluation_failure_count)
  if (totalCases !== null && failureCount !== null && failureCount > 0) {
    if (failureCount > totalCases) {
      return formatInconsistentEvaluation(failureCount, totalCases)
    }
    return `${failureCount}/${totalCases} evaluation cases failed`
  }

  if (detail.result_state === 'failed') {
    return 'Evaluation failed'
  }

  return null
}

function hasEvaluationMetrics(metrics: Record<string, unknown>): boolean {
  return (
    asInt(metrics.evaluation_total_cases) !== null ||
    asInt(metrics.evaluation_failure_count) !== null ||
    Object.keys(asRecord(metrics.evaluation_status_counts)).length > 0
  )
}

function hasValidationData(validation: Record<string, unknown>): boolean {
  return Object.keys(validation).length > 0
}

function hasVisibleDiagnostics(
  diagnostics: PredictionDiagnostics,
  detail: PredictionDetail,
): boolean {
  if (diagnostics.primaryFailureReason || diagnostics.testSummary) return true
  if (
    detail.result_state === 'failed' ||
    detail.result_state === 'error' ||
    detail.result_state === 'pending'
  ) {
    return true
  }

  const validation = asRecord(detail.validation_json)
  const metrics = asRecord(detail.metrics_json)
  if (hasValidationData(validation) || hasEvaluationMetrics(metrics)) {
    return true
  }

  return diagnostics.pipelineStages.some(
    stage =>
      (stage.id === 'extraction' ||
        stage.id === 'compile' ||
        stage.id === 'evaluation') &&
      stage.status !== 'skipped' &&
      stage.status !== 'unknown',
  )
}

export function buildPredictionDiagnostics(
  detail: PredictionDetail,
): PredictionDiagnostics {
  const validation = asRecord(detail.validation_json)
  const metrics = asRecord(detail.metrics_json)
  const evaluation = buildEvaluationStage(metrics)
  const pipelineStages = [
    buildGenerationStage(detail, validation),
    buildExtractionStage(validation),
    buildCompileStage(validation),
    evaluation.stage,
    buildScoringStage(detail),
  ]
  const primaryFailureReason = derivePrimaryFailureReason(
    detail,
    validation,
    metrics,
  )

  const diagnostics: PredictionDiagnostics = {
    primaryFailureReason,
    pipelineStages,
    testSummary: evaluation.testSummary,
  }

  if (!hasVisibleDiagnostics(diagnostics, detail)) {
    return {
      primaryFailureReason: null,
      pipelineStages,
      testSummary: null,
    }
  }

  return diagnostics
}

export function buildRunConfigFields(detail: PredictionDetail): RunConfigField[] {
  const summary = asRecord(detail.summary_json)
  const fields: RunConfigField[] = []

  const pushField = (label: string, value: unknown) => {
    const formatted = formatConfigValue(value)
    if (formatted) fields.push({ label, value: formatted })
  }

  if (detail.experiment_kind === ENCDEC_KIND) {
    pushField('Encoder model', summary.encoder_model)
    pushField('Decoder model', summary.decoder_model)
    pushField('Encoder temp', summary.encoder_temperature)
    pushField('Decoder temp', summary.decoder_temperature)
    pushField('Budget ratio', summary.budget_ratio)
    pushField('Encoder char budget', summary.encoder_char_budget)
  } else {
    pushField('Temperature', summary.temperature)
  }

  pushField('Repetition seed', summary.repetition_seed)

  const generatedAt = asString(summary.generated_at)
  if (generatedAt) {
    fields.push({ label: 'Generated', value: shortDate(generatedAt) })
  }

  const scoredAt = asString(summary.scored_at)
  if (scoredAt) {
    fields.push({ label: 'Scored', value: shortDate(scoredAt) })
  }

  return fields
}

export function buildReferenceFields(requestJson: unknown): ReferenceFields {
  const request = asRecord(requestJson)
  return {
    canonicalSolution: asString(request.canonical_solution),
    groundTruthCode: asString(request.ground_truth_code),
    test: asString(request.test),
    entryPoint: asString(request.entry_point),
  }
}

export function buildEncdecPipeline(
  detail: PredictionDetail,
): EncdecPipelineData | null {
  if (detail.experiment_kind !== ENCDEC_KIND) return null

  const request = asRecord(detail.request_json)
  const response = asRecord(detail.response_json)

  return {
    prompt: detail.prompt_text ?? detail.input_text,
    encodedDescription: asString(request.encoded_description),
    decodedGeneration: detail.output_text,
    encoderCost: asNumber(response.encoder_provider_cost),
    decoderCost: asNumber(response.decoder_provider_cost),
  }
}

export function buildOutcomeBanner(
  detail: PredictionDetail,
  diagnostics: PredictionDiagnostics,
): OutcomeBanner | null {
  if (detail.result_state === 'error') {
    const reason = diagnostics.primaryFailureReason
    const statusLine = `Generation: ${detail.generation_status ?? 'n/a'} · Scoring: ${detail.scoring_status ?? 'n/a'}`
    return {
      tone: 'error',
      title: 'Prediction errored',
      message: reason ? `${statusLine} · ${reason}` : statusLine,
    }
  }

  if (detail.result_state === 'failed') {
    const reason =
      diagnostics.primaryFailureReason ??
      diagnostics.testSummary ??
      'Evaluation failed'
    return {
      tone: 'warning',
      title: 'Prediction failed',
      message: reason,
    }
  }

  return null
}

export function shouldShowDiagnostics(
  diagnostics: PredictionDiagnostics,
  detail: PredictionDetail,
): boolean {
  return hasVisibleDiagnostics(diagnostics, detail)
}

export function hasReferenceContent(reference: ReferenceFields): boolean {
  return Boolean(
    reference.canonicalSolution ||
      reference.groundTruthCode ||
      reference.test ||
      reference.entryPoint,
  )
}

export function shouldShowGroundTruth(reference: ReferenceFields): boolean {
  if (!reference.groundTruthCode) return false
  if (!reference.canonicalSolution) return true
  return reference.groundTruthCode !== reference.canonicalSolution
}
