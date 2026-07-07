import { SECTION_LABEL, Tag } from '@/components/primitives'
import {
  charFlowLabel,
  failureClassTone,
  formatDurationMs,
  stageRetryStory,
  stageToneClass,
} from '@/components/pipeline-flow/pipeline-flow-view'
import type { PipelineStage, StageStatus } from '@/fixtures/pipeline'
import type { StageRetryStory } from '@/components/pipeline-flow/pipeline-flow-view'
import { cn } from '@/lib/cn'
import { formatCost, shortDate } from '@/lib/format'

const STATUS_CHIP: Record<StageStatus, string> = {
  success: 'bg-[var(--green-bg)] text-[var(--green)]',
  error: 'bg-[var(--red-bg)] text-[var(--red)]',
  skipped: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]',
}

function StageStatusChip({ status }: { status: StageStatus }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] leading-none font-semibold',
        STATUS_CHIP[status],
      )}
    >
      {status}
    </span>
  )
}

type MetricRow = {
  label: string
  value: string
  mono?: boolean
  muted?: boolean
}

/** Rows for non-null fields only — measurement stages never render `none` rows. */
function stageMetricRows(stage: PipelineStage): MetricRow[] {
  const rows: MetricRow[] = []
  if (stage.duration_ms !== null) {
    rows.push({
      label: 'duration',
      value: formatDurationMs(stage.duration_ms),
      mono: true,
    })
  }
  const chars = charFlowLabel(stage.input_char_count, stage.output_char_count)
  if (chars !== null) {
    rows.push({ label: 'chars', value: chars, mono: true })
  }
  if (stage.model !== null) {
    rows.push({ label: 'model', value: stage.model, mono: true })
  }
  const cost = formatCost(stage.provider_cost)
  if (cost !== null) {
    rows.push({ label: 'cost', value: cost, mono: true })
  }
  if (stage.started_at !== null) {
    rows.push({ label: 'started', value: shortDate(stage.started_at), muted: true })
  }
  return rows
}

function RetryAffordance({ retry }: { retry: StageRetryStory }) {
  if (retry.kind === 'none') return null
  if (retry.kind === 'recovered') {
    const { failure } = retry
    return (
      <div className="flex flex-col gap-1">
        <Tag tone="yellow" className="self-start">
          retried ×{retry.attempts}
        </Tag>
        <p className="text-[11px] leading-snug text-[var(--text-muted)]">
          {failure.failure_class !== null && (
            <span
              className={cn(
                'font-semibold',
                failureClassTone(failure.failure_class) === 'yellow'
                  ? 'text-[var(--yellow)]'
                  : 'text-[var(--red)]',
              )}
            >
              {failure.failure_class}{' '}
            </span>
          )}
          <span className="font-mono">{failure.error_type}</span>
          {' — '}
          {failure.message}
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1 rounded-md border border-[var(--red-border)] bg-[var(--bg-primary)] px-2.5 py-2">
      {retry.attempts > 0 && (
        <span className="text-[11px] font-semibold text-[var(--red)]">
          failed after {retry.attempts + 1} attempts
        </span>
      )}
      {retry.failure !== null ? (
        <>
          <span className="font-mono text-[12px] font-medium text-[var(--red)]">
            {retry.failure.error_type}
          </span>
          <span className="text-[11px] leading-snug text-[var(--text-secondary)]">
            {retry.failure.message}
          </span>
          {retry.failure.failure_class !== null && (
            <Tag
              tone={failureClassTone(retry.failure.failure_class)}
              className="self-start"
            >
              {retry.failure.failure_class}
            </Tag>
          )}
        </>
      ) : (
        <span className="text-[11px] text-[var(--red)]">
          failed (no failure metadata)
        </span>
      )}
    </div>
  )
}

type PipelineStageNodeProps = {
  stage: PipelineStage
}

export function PipelineStageNode({ stage }: PipelineStageNodeProps) {
  const retry = stageRetryStory(stage)
  const rows = stageMetricRows(stage)
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-2.5 rounded-xl border border-t-2 px-3 py-2.5',
        stageToneClass(stage.status),
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className={SECTION_LABEL}>{stage.stage.replaceAll('_', ' ')}</span>
        <div className="flex items-center gap-1.5">
          {stage.node_id !== null && <Tag mono>{stage.node_id}</Tag>}
          <StageStatusChip status={stage.status} />
        </div>
      </div>

      <RetryAffordance retry={retry} />

      {rows.length > 0 && (
        <dl className="flex flex-col gap-1">
          {rows.map(row => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-3 text-[12px]"
            >
              <dt className="shrink-0 text-[var(--text-muted)]">{row.label}</dt>
              <dd
                className={cn(
                  'min-w-0 text-right break-all',
                  row.mono && 'font-mono',
                  row.muted
                    ? 'text-[var(--text-muted)]'
                    : 'text-[var(--text-primary)]',
                )}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {stage.output_excerpt !== null && (
        <div className="mt-auto line-clamp-3 rounded-md bg-[var(--bg-tertiary)] px-2.5 py-1.5 font-mono text-[11.5px] leading-snug whitespace-pre-wrap text-[var(--text-secondary)]">
          {stage.output_excerpt}
        </div>
      )}
    </div>
  )
}
