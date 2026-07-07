import { PipelineStageNode } from '@/components/pipeline-flow/PipelineStageNode'
import { formatDurationMs } from '@/components/pipeline-flow/pipeline-flow-view'
import { Dot, ResultBadge, Tag } from '@/components/primitives'
import { StatCell } from '@/components/stats/StatCell'
import type { PipelineTrace } from '@/fixtures/pipeline'
import { cn } from '@/lib/cn'
import { formatCost } from '@/lib/format'

type StageConnectorProps = {
  /** Char handoff from the upstream stage; null renders an arrow with no count. */
  charCount: number | null
  /** Downstream stage was never reached — dashed/dimmed, no count. */
  intoSkipped: boolean
}

function StageConnector({ charCount, intoSkipped }: StageConnectorProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex shrink-0 flex-col items-center justify-center gap-0.5 self-center px-2 max-lg:py-1.5',
        intoSkipped ? 'text-[var(--text-muted)]' : 'text-[var(--text-secondary)]',
      )}
    >
      {intoSkipped ? (
        <span className="w-5 border-t border-dashed border-current opacity-70" />
      ) : (
        charCount !== null && (
          <span className="font-mono text-[10px] leading-none">
            {charCount} ch
          </span>
        )
      )}
      <span
        className={cn(
          'font-mono text-[13px] leading-none max-lg:rotate-90',
          intoSkipped && 'opacity-70',
        )}
      >
        {'->'}
      </span>
    </div>
  )
}

type PipelineFlowProps = {
  trace: PipelineTrace
  className?: string
}

export function PipelineFlow({ trace, className }: PipelineFlowProps) {
  return (
    <section className={cn('flex max-w-[1280px] flex-col gap-4', className)}>
      <header className="flex items-start justify-between gap-4 max-md:flex-col">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-[13px] text-[var(--text-secondary)]">
          <Tag tone={trace.graph_layout === 'encdec' ? 'accent' : 'neutral'}>
            {trace.graph_layout}
          </Tag>
          <Tag>{trace.identity.experiment_kind}</Tag>
          <Dot />
          <span className="font-mono">{trace.identity.task_id}</span>
          <Dot />
          <span>sample #{trace.identity.sample_index}</span>
          <Dot />
          <span className="font-mono break-all">
            {trace.identity.prediction_id}
          </span>
        </div>
        <ResultBadge state={trace.result_state} size="sm" />
      </header>

      <div className="grid grid-cols-3 gap-px border-y border-[var(--border)] bg-[var(--border-subtle)] max-md:grid-cols-1">
        <StatCell label="Model" value={trace.identity.model} mono />
        <StatCell
          label="Total cost"
          value={formatCost(trace.total_provider_cost)}
          mono
        />
        <StatCell
          label="Total duration"
          value={
            trace.total_duration_ms === null
              ? null
              : formatDurationMs(trace.total_duration_ms)
          }
          mono
        />
      </div>

      <ol className="flex flex-row items-stretch max-lg:flex-col">
        {trace.stages.map((stage, index) => {
          const upstream = index > 0 ? trace.stages[index - 1] : null
          const intoSkipped = stage.status === 'skipped'
          return (
            <li
              key={stage.stage}
              aria-label={`${stage.stage}: ${stage.status}`}
              className="flex min-w-0 flex-1 items-stretch max-lg:flex-col"
            >
              {upstream && (
                <StageConnector
                  charCount={intoSkipped ? null : upstream.output_char_count}
                  intoSkipped={intoSkipped}
                />
              )}
              <PipelineStageNode stage={stage} />
            </li>
          )
        })}
      </ol>
    </section>
  )
}
