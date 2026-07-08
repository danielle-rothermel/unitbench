import { SECTION_LABEL } from '@/components/primitives'
import { cn } from '@/lib/cn'
import type { PredictionDetail } from '@/lib/prediction-detail'
import type {
  PipelineStageInfo,
  PredictionDiagnostics,
  StageStatus,
} from '@/lib/prediction-diagnostics'
import { shouldShowDiagnostics } from '@/lib/prediction-diagnostics'

const STAGE_STATUS_CLASS: Record<StageStatus, string> = {
  passed: 'bg-[var(--green-bg)] text-[var(--green)]',
  failed: 'bg-[var(--red-bg)] text-[var(--red)]',
  pending: 'bg-[var(--yellow-bg)] text-[var(--yellow)]',
  skipped: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]',
  unknown: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
  completed: 'bg-[var(--blue-bg)] text-[var(--blue)]',
  inconsistent: 'bg-[var(--yellow-bg)] text-[var(--yellow)]',
}

type PredictionDiagnosticsPanelProps = {
  detail: PredictionDetail
  diagnostics: PredictionDiagnostics
}

function StagePill({ stage }: { stage: PipelineStageInfo }) {
  return (
    <div
      className={cn(
        'inline-flex min-w-0 flex-col gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold',
            STAGE_STATUS_CLASS[stage.status],
          )}
        >
          <span
            className="h-[5px] w-[5px] shrink-0 rounded-full bg-current"
            aria-hidden="true"
          />
          {stage.label}
        </span>
        <span className="text-[11px] text-[var(--text-muted)] capitalize">
          {stage.statusLabel ?? stage.status}
        </span>
      </div>
      {stage.detail && (
        <p className="font-mono text-[11px] break-all text-[var(--text-secondary)]">
          {stage.detail}
        </p>
      )}
    </div>
  )
}

export function PredictionDiagnosticsPanel({
  detail,
  diagnostics,
}: PredictionDiagnosticsPanelProps) {
  if (!shouldShowDiagnostics(diagnostics, detail)) return null

  return (
    <section className="mb-8 flex max-w-[1280px] flex-col gap-3">
      <span className={SECTION_LABEL}>Diagnostics</span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {diagnostics.pipelineStages.map(stage => (
          <StagePill key={stage.id} stage={stage} />
        ))}
      </div>
      {(diagnostics.primaryFailureReason ||
        diagnostics.testSummary ||
        diagnostics.harnessFailureSummary) && (
        <div className="flex flex-col gap-1 text-[13px] text-[var(--text-secondary)]">
          {diagnostics.primaryFailureReason && (
            <p>
              <span className="font-semibold text-[var(--text-primary)]">
                Failure reason:
              </span>{' '}
              {diagnostics.primaryFailureReason}
            </p>
          )}
          {diagnostics.testSummary && (
            <p>
              <span className="font-semibold text-[var(--text-primary)]">
                Tests:
              </span>{' '}
              {diagnostics.testSummary}
            </p>
          )}
          {diagnostics.harnessFailureSummary && (
            <p>
              <span className="font-semibold text-[var(--text-primary)]">
                Harness:
              </span>{' '}
              {diagnostics.harnessFailureSummary}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
