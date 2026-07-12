'use client'

import Link from 'next/link'
import { CodePane } from '@/components/code/CodePane'
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
import type { BundleIdentity } from '@/lib/bundle-view'
import type { DetailProvenance, PredictionDetail } from '@/lib/prediction-detail'
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
  provenance?: readonly DetailProvenance[]
  bundle?: BundleIdentity
  backHref: string
}

function formatScore(score: number | null): string | null {
  return score === null ? null : score.toFixed(2)
}

export function PredictionDetailPage({
  detail,
  provenance = [],
  bundle = { bundle_id: 'fixture-detail-bundle', snapshot_seq: 0 },
  backHref,
}: PredictionDetailPageProps) {
  const diagnostics = buildPredictionDiagnostics(detail)
  const outcomeBanner = buildOutcomeBanner(detail, diagnostics)
  const runConfigFields = buildRunConfigFields(detail)
  const reference = buildReferenceFields(detail.request_json)
  const encdecPipeline = buildEncdecPipeline(detail)
  const experimentHref = `/tables/experiments?experiment_id=${encodeURIComponent(detail.experiment_id)}`
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

      <section className="mb-7 max-w-[1280px] rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3" aria-label="Pinned detail version">
        <p className={SECTION_LABEL}>Pinned Detail bundle</p>
        <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">{bundle.bundle_id} · snapshot {bundle.snapshot_seq}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">This page is a fixed root-cascade view, not the current operational record.</p>
      </section>

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

      <section className="mb-8 max-w-[1280px]" aria-labelledby="provenance-heading">
        <h2 id="provenance-heading" className={SECTION_LABEL}>Pinned provenance</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Generation, scoring, harness, and platform attempts are selected from this prediction’s one Detail bundle.</p>
        <div className="mt-3 grid grid-cols-5 gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] max-lg:grid-cols-2 max-sm:grid-cols-1">
          {provenance.map(item => <div key={item.member} className="bg-[var(--bg-primary)] px-3 py-2.5"><p className="font-mono text-[11px] text-[var(--text-secondary)]">{item.member.replaceAll('_', ' ')}</p><p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{item.rows.length}</p></div>)}
        </div>
      </section>

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

        <Inspector payloadsLabel="Debug payloads" payloads={jsonPanels} />
      </div>
    </div>
  )
}
