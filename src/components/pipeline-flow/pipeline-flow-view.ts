/**
 * Pure view-model helpers for the pipeline-flow visualizer (R4, REL-5).
 *
 * Consumes the frozen PipelineTrace/PipelineStage fixture contract
 * (src/fixtures/pipeline.ts); plan: docs/planning/viz-components/v0/workstreams/r4-pipeline-flow.md.
 */

import type { FailureClass } from '@/fixtures/primitives'
import type {
  PipelineStage,
  PipelineStageName,
  StageFailure,
  StageStatus,
} from '@/fixtures/pipeline'

/** LLM stages carry model/cost/timestamps; measurement stages carry only char counts. */
export type StageKind = 'llm' | 'measurement' | 'tests'

export function stageKind(stage: PipelineStageName): StageKind {
  switch (stage) {
    case 'encode':
    case 'decode':
    case 'generate':
      return 'llm'
    case 'compress':
    case 'decompress':
      return 'measurement'
    case 'run_tests':
      return 'tests'
    default: {
      const _exhaustive: never = stage
      throw new Error(`unhandled pipeline stage: ${_exhaustive}`)
    }
  }
}

/** Discriminated union so retry-and-recovered can never be confused with a final failure. */
export type StageRetryStory =
  | { kind: 'none' }
  | { kind: 'recovered'; attempts: number; failure: StageFailure }
  | { kind: 'failed'; attempts: number; failure: StageFailure | null }

/**
 * status reflects the final attempt; a stage keeps its last failure even when
 * a retry succeeded (fixture contract), so success + failure = recovered retry.
 * A recorded failure on a successful stage implies at least one retry, so
 * attempts is clamped to >= 1 for the recovered story.
 */
export function stageRetryStory(stage: PipelineStage): StageRetryStory {
  if (stage.status === 'error') {
    return {
      kind: 'failed',
      attempts: stage.attempt_index,
      failure: stage.failure,
    }
  }
  if (stage.status === 'success' && stage.failure !== null) {
    return {
      kind: 'recovered',
      attempts: Math.max(stage.attempt_index, 1),
      failure: stage.failure,
    }
  }
  return { kind: 'none' }
}

const STAGE_TONE: Record<StageStatus, string> = {
  success:
    'border-[var(--border-subtle)] border-t-[var(--green)] bg-[var(--bg-primary)]',
  error: 'border-[var(--red-border)] border-t-[var(--red)] bg-[var(--red-bg)]',
  skipped:
    'border-dashed border-[var(--border-subtle)] border-t-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-muted)]',
}

/** Border/background tone for a stage card; owns border colors + background. */
export function stageToneClass(status: StageStatus): string {
  return STAGE_TONE[status]
}

/** Tag tone for a failure class: rate limits are yellow, hard failures red. */
export function failureClassTone(
  failureClass: FailureClass | null,
): 'yellow' | 'red' | 'neutral' {
  if (failureClass === null) return 'neutral'
  return failureClass === 'rate_limited' ? 'yellow' : 'red'
}

const MS_PER_SECOND = 1_000
const MS_PER_MINUTE = 60_000

/** 850 ms · 6.2 s · 1.1 min */
export function formatDurationMs(ms: number): string {
  if (ms < MS_PER_SECOND) return `${Math.round(ms)} ms`
  if (ms < MS_PER_MINUTE) return `${(ms / MS_PER_SECOND).toFixed(1)} s`
  return `${(ms / MS_PER_MINUTE).toFixed(1)} min`
}

/** "192 → 89 ch (0.46×)"; degrades to one side when the other is null; null when both are. */
export function charFlowLabel(
  input: number | null,
  output: number | null,
): string | null {
  if (input === null && output === null) return null
  if (input === null) return `${output} ch out`
  if (output === null) return `${input} ch in`
  const ratio = input > 0 ? ` (${(output / input).toFixed(2)}×)` : ''
  return `${input} → ${output} ch${ratio}`
}
