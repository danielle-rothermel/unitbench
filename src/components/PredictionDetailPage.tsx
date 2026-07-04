'use client'

import Link from 'next/link'
import { IdChip } from '@/components/chips/IdChip'
import { CodePane } from '@/components/code/CodePane'
import { PredictionDiagnosticsPanel } from '@/components/prediction/PredictionDiagnosticsPanel'
import { PredictionEncdecPipeline } from '@/components/prediction/PredictionEncdecPipeline'
import { PredictionOutcomeBanner } from '@/components/prediction/PredictionOutcomeBanner'
import { PredictionReferenceSection } from '@/components/prediction/PredictionReferenceSection'
import { PredictionRunConfigStrip } from '@/components/prediction/PredictionRunConfigStrip'
import { TextPanel } from '@/components/panels/TextPanel'
import { Dot, ResultBadge, SECTION_LABEL, Tag } from '@/components/primitives'
import { StatCell } from '@/components/stats/StatCell'
import { useCopy } from '@/hooks/useCopy'
import { formatCost, prettyJson, shortDate } from '@/lib/format'
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
  const [copied, copy] = useCopy()
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
          <span aria-hidden="true">&lt;-</span> Back to predictions
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

      <section className="mb-7 grid max-w-[1280px] grid-cols-4 gap-px border-y border-[var(--border)] bg-[var(--border-subtle)] max-md:grid-cols-2">
        <StatCell label="Model" value={detail.model} mono />
        <StatCell label="Score" value={formatScore(detail.score)} mono />
        <StatCell
          label="Provider cost"
          value={formatCost(detail.provider_cost)}
          mono
        />
        <StatCell label="Created" value={shortDate(detail.created_at)} />
      </section>

      <PredictionRunConfigStrip fields={runConfigFields} />

      <PredictionDiagnosticsPanel detail={detail} diagnostics={diagnostics} />

      <section className="mb-8 flex max-w-[1280px] flex-col gap-2.5">
        <span className={SECTION_LABEL}>Provenance</span>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
            {detail.source}
          </span>
          <span className="rounded border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
            {detail.experiment_kind}
          </span>
        </div>
        <div className="group flex w-full items-baseline gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-3 py-2 text-left transition-colors hover:border-[var(--border-strong)]">
          <span className="shrink-0 text-[10px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase">
            Experiment
          </span>
          <Link
            href={experimentHref}
            className="[overflow-wrap:anywhere] font-mono text-[12.5px] text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            {detail.experiment_id}
          </Link>
        </div>
        <div className="-ml-1.5 flex flex-wrap items-center gap-x-1 gap-y-1">
          <IdChip
            label="prediction"
            value={detail.prediction_id}
            copied={copied}
            onCopy={copy}
          />
          <IdChip
            label="experiment"
            value={detail.experiment_id}
            copied={copied}
            onCopy={copy}
          />
          <IdChip
            label="task"
            value={detail.task_id}
            copied={copied}
            onCopy={copy}
          />
          <IdChip
            label="sample"
            value={detail.sample_index}
            copied={copied}
            onCopy={copy}
          />
          <IdChip
            label="generation"
            value={detail.generation_status}
            copied={copied}
            onCopy={copy}
          />
          <IdChip
            label="scoring"
            value={detail.scoring_status}
            copied={copied}
            onCopy={copy}
          />
          <IdChip
            label="updated"
            value={detail.updated_at}
            display={shortDate(detail.updated_at)}
            copied={copied}
            onCopy={copy}
          />
        </div>
      </section>

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
              <CodePane label="Prompt" value={detail.prompt_text} />
              <CodePane
                label="Code"
                value={detail.code_text}
                language="python"
                accent
              />
              <CodePane label="Raw generation" value={detail.raw_generation} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <span className={SECTION_LABEL}>Debug payloads</span>
          <div className="grid grid-cols-2 items-start gap-4 max-lg:grid-cols-1">
            {jsonPanels.map(panel => (
              <CodePane
                key={panel.label}
                label={panel.label}
                value={prettyJson(panel.value)}
                language="json"
                badge="json"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
