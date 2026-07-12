import Link from 'next/link'
import { CodePanel } from '@/components/code/CodePanel'
import { Inspector } from '@/components/inspector/Inspector'
import { PredictionDiagnosticsPanel } from '@/components/prediction/PredictionDiagnosticsPanel'
import { PredictionEncdecPipeline } from '@/components/prediction/PredictionEncdecPipeline'
import { PredictionOutcomeBanner } from '@/components/prediction/PredictionOutcomeBanner'
import { PredictionReferenceSection } from '@/components/prediction/PredictionReferenceSection'
import { PredictionRunConfigStrip } from '@/components/prediction/PredictionRunConfigStrip'
import { TextPanel } from '@/components/panels/TextPanel'
import { Dot, ResultBadge, SECTION_LABEL, Tag } from '@/components/primitives'
import { StatCell } from '@/components/stats/StatCell'
import { formatCost, shortDate } from '@/lib/format'
import type { PredictionDetail } from '@/lib/prediction-detail'
import {
  buildEncdecPipeline,
  buildOutcomeBanner,
  buildPredictionDiagnostics,
  buildReferenceFields,
  buildRunConfigFields,
  truncateFailureReason,
} from '@/lib/prediction-diagnostics'

type PredictionDetailPageProps = {
  detail: PredictionDetail
  backHref: string
}

function formatScore(score: number | null): string | null {
  return score === null ? null : score.toFixed(2)
}

export function PredictionDetailPage({
  detail,
  backHref,
}: PredictionDetailPageProps) {
  const diagnostics = buildPredictionDiagnostics(detail)
  const outcomeBanner = buildOutcomeBanner(detail, diagnostics)
  const runConfigFields = buildRunConfigFields(detail)
  const reference = buildReferenceFields(detail.request_json)
  const encdecPipeline = buildEncdecPipeline(detail)
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
      <div className="mb-6 max-w-[1280px]">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          <span aria-hidden="true">←</span> Back to predictions
        </Link>
      </div>

      <header className="mb-8 flex max-w-[1280px] items-start justify-between gap-6 max-md:flex-col">
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
          <h1 className="font-mono text-[26px] leading-tight font-semibold break-all text-[var(--text-primary)]">
            {detail.prediction_id}
          </h1>
        </div>
        <ResultBadge
          state={detail.result_state}
          failure={truncateFailureReason(diagnostics.primaryFailureReason)}
        />
      </header>

      {outcomeBanner && <PredictionOutcomeBanner banner={outcomeBanner} />}

      <section className="mb-7 grid max-w-[1280px] grid-cols-5 gap-px border-y border-[var(--border)] bg-[var(--border-subtle)] max-lg:grid-cols-3 max-md:grid-cols-2">
        <StatCell label="Model" value={detail.model} mono />
        <StatCell label="Score" value={formatScore(detail.score)} mono />
        <StatCell
          label="Harness failures"
          value={detail.harness_failure_count}
          mono
        />
        <StatCell
          label="Provider cost"
          value={formatCost(detail.provider_cost)}
          mono
        />
        <StatCell label="Created" value={shortDate(detail.created_at)} />
      </section>

      <PredictionRunConfigStrip fields={runConfigFields} />

      <PredictionDiagnosticsPanel detail={detail} diagnostics={diagnostics} />

      <div className="mb-8">
        <Inspector
          links={[
            {
              label: 'Experiment',
              value: detail.experiment_id,
              href: experimentHref,
            },
          ]}
          ids={[
            { label: 'prediction', value: detail.prediction_id },
            { label: 'experiment', value: detail.experiment_id },
            { label: 'task', value: detail.task_id },
            { label: 'sample', value: detail.sample_index },
            { label: 'generation', value: detail.generation_status },
            { label: 'scoring', value: detail.scoring_status },
            {
              label: 'updated',
              value: detail.updated_at,
              display: shortDate(detail.updated_at),
            },
          ]}
        />
      </div>

      <PredictionReferenceSection reference={reference} />

      <div className="flex flex-col gap-5">
        {!encdecPipeline && (
          <div className="flex max-w-[1280px] flex-col gap-5">
            <div className="grid grid-cols-2 items-start gap-x-5 gap-y-5 max-lg:grid-cols-1">
              <TextPanel
                label={detail.input_kind ?? 'Input'}
                value={detail.input_text}
              />
              <TextPanel
                label={detail.output_kind ?? 'Output'}
                value={detail.output_text}
              />
            </div>
          </div>
        )}

        {encdecPipeline && <PredictionEncdecPipeline pipeline={encdecPipeline} />}

        {(detail.prompt_text || detail.code_text || detail.raw_generation) && (
          <div className="flex flex-col gap-2.5">
            <span className={SECTION_LABEL}>Generation · prompt → output</span>
            <div className="grid grid-cols-2 items-start gap-4 max-lg:grid-cols-1">
              <CodePanel
                label="Prompt"
                value={detail.prompt_text}
                language="text"
              />
              <CodePanel
                label="Code"
                value={detail.code_text}
                language="python"
                accent
              />
              <CodePanel
                label="Raw generation"
                value={detail.raw_generation}
                language="text"
              />
            </div>
          </div>
        )}

        <Inspector payloadsLabel="Debug payloads" payloads={jsonPanels} />
      </div>
    </div>
  )
}
