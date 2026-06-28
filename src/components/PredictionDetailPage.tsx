import Link from 'next/link'
import { IdChip } from '@/components/chips/IdChip'
import { CodePane } from '@/components/code/CodePane'
import { ErrorSection } from '@/components/panels/ErrorSection'
import { TextPanel } from '@/components/panels/TextPanel'
import { Dot, ResultBadge, SECTION_LABEL, Tag } from '@/components/primitives'
import { StatCell } from '@/components/stats/StatCell'
import { prettyJson, shortDate } from '@/lib/format'
import type { PredictionDetail } from '@/lib/prediction-detail'

type PredictionDetailPageProps = {
  detail: PredictionDetail
  backHref: string
}

function formatScore(score: number | null): string | null {
  return score === null ? null : score.toFixed(2)
}

function formatCost(cost: number | null): string | null {
  return cost === null ? null : `$${cost.toFixed(4)}`
}

export function PredictionDetailPage({
  detail,
  backHref,
}: PredictionDetailPageProps) {
  const isError = detail.result_state === 'error'
  const experimentHref = `/tables/published-experiments?experiment_id=${encodeURIComponent(detail.experiment_id)}`
  const jsonPanels: { label: string; value: unknown }[] = [
    { label: 'Metrics', value: detail.metrics_json },
    { label: 'Validation', value: detail.validation_json },
    { label: 'Request', value: detail.request_json },
    { label: 'Response', value: detail.response_json },
    { label: 'Summary', value: detail.summary_json },
  ]

  return (
    <div className="w-full">
      <div className="mb-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          <span aria-hidden="true">&lt;-</span> Back to predictions
        </Link>
      </div>

      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-secondary)]">
            <Tag tone="accent">{detail.source}</Tag>
            <Tag>{detail.experiment_kind}</Tag>
            {detail.task_id && (
              <>
                <Dot />
                <span className="font-mono">{detail.task_id}</span>
              </>
            )}
          </div>
          <h1 className="font-mono text-[20px] leading-tight font-semibold break-all text-[var(--text-primary)]">
            {detail.prediction_id}
          </h1>
        </div>
        <ResultBadge state={detail.result_state} />
      </header>

      {isError && (
        <div className="mb-6">
          <ErrorSection
            title="Prediction errored"
            message={`Generation: ${detail.generation_status ?? 'n/a'} · Scoring: ${detail.scoring_status ?? 'n/a'}`}
          />
        </div>
      )}

      <section className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3 lg:grid-cols-6">
        <StatCell label="Model" value={detail.model} mono />
        <StatCell label="Task" value={detail.task_id} mono />
        <StatCell label="Score" value={formatScore(detail.score)} mono />
        <StatCell label="Provider cost" value={formatCost(detail.provider_cost)} mono />
        <StatCell label="Sample" value={detail.sample_index} mono />
        <StatCell label="Created" value={shortDate(detail.created_at)} />
      </section>

      <section className="mb-6 flex flex-col gap-2">
        <span className={SECTION_LABEL}>Provenance</span>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={experimentHref}>
            <IdChip label="Experiment" value={detail.experiment_id} />
          </Link>
          <IdChip label="Generation" value={detail.generation_status} />
          <IdChip label="Scoring" value={detail.scoring_status} />
          <IdChip label="Updated" value={shortDate(detail.updated_at)} />
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TextPanel label={detail.input_kind ?? 'Input'} value={detail.input_text} />
        <TextPanel
          label={detail.output_kind ?? 'Output'}
          value={detail.output_text}
        />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CodePane label="Prompt" value={detail.prompt_text} />
        <CodePane
          label="Code"
          value={detail.code_text}
          language="python"
          accent
        />
        <CodePane label="Raw generation" value={detail.raw_generation} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {jsonPanels.map(panel => (
          <CodePane
            key={panel.label}
            label={panel.label}
            value={prettyJson(panel.value)}
            language="json"
          />
        ))}
      </section>
    </div>
  )
}
