import type { BootstrapCiSummary } from '@/fixtures/bootstrap'
import { cn } from '@/lib/cn'
import {
  bootstrapGroupKey,
  bootstrapGroupLabel,
  formatPassRate,
  type GroupObservation,
} from '@/lib/bootstrap-ci'

type CiIntervalChartProps = {
  summaries: BootstrapCiSummary[]
  /** Available-n annotations; n_available 0 groups render as "no samples" rows. */
  observations: GroupObservation[]
  title: string
}

const AXIS_TICKS = [0, 0.25, 0.5, 0.75, 1] as const
/** SVG track coordinate system: x in [0, 100] = pass rate [0, 1]. */
const TRACK_WIDTH = 100
const TRACK_HEIGHT = 20
const MARKER_WIDTH = 1.4
const MARKER_HEIGHT = 10

function degenerateTag(observedPassRate: number): string {
  if (observedPassRate === 1) return 'degenerate (all pass)'
  if (observedPassRate === 0) return 'degenerate (all fail)'
  return 'degenerate'
}

function confidencePercent(confidenceLevel: number): string {
  return `${Math.round(confidenceLevel * 100)}%`
}

type IntervalRow = {
  key: string
  label: string
  summary: BootstrapCiSummary
  nAvailable: number | null
  extrapolated: boolean
}

function buildIntervalRows(
  summaries: BootstrapCiSummary[],
  observations: GroupObservation[],
): IntervalRow[] {
  const availableByKey = new Map(
    observations.map(observation => [
      bootstrapGroupKey(observation.model, observation.task_id),
      observation.n_available,
    ]),
  )
  const rows = summaries.map(summary => {
    const key = bootstrapGroupKey(summary.model, summary.task_id)
    const nAvailable = availableByKey.get(key) ?? null
    return {
      key,
      label: bootstrapGroupLabel(summary.model, summary.task_id),
      summary,
      nAvailable,
      extrapolated: nAvailable !== null && summary.n_samples > nAvailable,
    }
  })
  // Ranking story reads top-down: observed rate desc, stable label tiebreak
  return rows.sort(
    (a, b) =>
      b.summary.observed_pass_rate - a.summary.observed_pass_rate ||
      a.label.localeCompare(b.label),
  )
}

function IntervalTrack({ row }: { row: IntervalRow }) {
  const { summary, label, extrapolated } = row
  const low = summary.ci_low * TRACK_WIDTH
  const high = summary.ci_high * TRACK_WIDTH
  const observed = summary.observed_pass_rate * TRACK_WIDTH
  const degenerate = summary.ci_low === summary.ci_high
  const stroke = extrapolated ? 'var(--text-muted)' : 'var(--accent)'
  return (
    <svg
      role="img"
      aria-label={`${label}: ${formatPassRate(summary.observed_pass_rate)}, ${confidencePercent(summary.confidence_level)} CI ${formatPassRate(summary.ci_low)} to ${formatPassRate(summary.ci_high)}${extrapolated ? ' (extrapolated)' : ''}${degenerate ? ' (degenerate)' : ''}`}
      viewBox={`0 0 ${TRACK_WIDTH} ${TRACK_HEIGHT}`}
      preserveAspectRatio="none"
      className="h-5 w-full"
    >
      {AXIS_TICKS.map(tick => (
        <line
          key={tick}
          x1={tick * TRACK_WIDTH}
          x2={tick * TRACK_WIDTH}
          y1={0}
          y2={TRACK_HEIGHT}
          stroke="var(--border-subtle)"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {!degenerate && (
        <line
          data-ci-segment
          x1={low}
          x2={high}
          y1={TRACK_HEIGHT / 2}
          y2={TRACK_HEIGHT / 2}
          stroke={stroke}
          strokeWidth={2}
          strokeDasharray={extrapolated ? '3 3' : undefined}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <rect
        data-ci-observed
        x={observed - MARKER_WIDTH / 2}
        y={(TRACK_HEIGHT - MARKER_HEIGHT) / 2}
        width={MARKER_WIDTH}
        height={MARKER_HEIGHT}
        fill={extrapolated ? 'var(--bg-primary)' : stroke}
        stroke={stroke}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/** Forest-style CI interval plot on a fixed [0, 1] pass-rate axis. */
export function CiIntervalChart({ summaries, observations, title }: CiIntervalChartProps) {
  const rows = buildIntervalRows(summaries, observations)
  const emptyGroups = observations.filter(observation => observation.n_available === 0)

  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
        {title}
      </h2>
      <p className="mt-1 mb-3 text-sm text-[var(--text-secondary)]">
        One row per group: segment = percentile-bootstrap CI, marker = observed
        pass rate. Shared [0, 1] axis, so widths are comparable across rows.
        Dashed/hollow rows are extrapolated (N beyond available samples).
      </p>
      <div className="max-h-[480px] overflow-y-auto rounded-xl border border-[var(--border)]">
        <div className="min-w-[560px]">
          <div className="sticky top-0 grid grid-cols-[minmax(180px,1.1fr)_minmax(220px,2fr)_minmax(220px,auto)] items-center gap-x-4 border-b border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2">
            <span className="font-display text-[11px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase">
              Group
            </span>
            <div className="flex justify-between font-mono text-[10px] text-[var(--text-muted)]">
              {AXIS_TICKS.map(tick => (
                <span key={tick}>{tick}</span>
              ))}
            </div>
            <span className="text-right font-display text-[11px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase">
              rate [low, high] · n
            </span>
          </div>
          {rows.map(row => {
            const { summary } = row
            const degenerate = summary.ci_low === summary.ci_high
            return (
              <div
                key={row.key}
                data-ci-row
                className="grid grid-cols-[minmax(180px,1.1fr)_minmax(220px,2fr)_minmax(220px,auto)] items-center gap-x-4 border-b border-[var(--border-subtle)] px-3 py-1.5 last:border-b-0"
              >
                <span
                  className="truncate font-mono text-[12px] text-[var(--text-secondary)]"
                  title={row.label}
                >
                  {row.label}
                </span>
                <IntervalTrack row={row} />
                <span className="flex items-center justify-end gap-2 text-right font-mono text-[12px] text-[var(--text-primary)]">
                  {degenerate && (
                    <span
                      className="rounded-sm bg-[var(--yellow-bg)] px-1.5 py-0.5 font-sans text-[10px] text-[var(--yellow)]"
                      title="Every replicate resamples the same outcome — the bootstrap sees no variance at this N."
                    >
                      {degenerateTag(summary.observed_pass_rate)}
                    </span>
                  )}
                  {row.extrapolated && (
                    <span
                      className="rounded-sm bg-[var(--blue-bg)] px-1.5 py-0.5 font-sans text-[10px] text-[var(--blue)]"
                      title={`N=${summary.n_samples} exceeds the ${row.nAvailable} available samples; the resample treats the observed rate as truth, understating uncertainty about the rate itself.`}
                    >
                      extrapolated
                    </span>
                  )}
                  {formatPassRate(summary.observed_pass_rate)} [
                  {formatPassRate(summary.ci_low)}, {formatPassRate(summary.ci_high)}]
                  {' · '}n={summary.n_samples} (×{summary.n_resamples})
                </span>
              </div>
            )
          })}
          {emptyGroups.map(observation => (
            <div
              key={bootstrapGroupKey(observation.model, observation.task_id)}
              data-ci-empty-row
              className={cn(
                'grid grid-cols-[minmax(180px,1.1fr)_minmax(220px,2fr)_minmax(220px,auto)] items-center gap-x-4',
                'border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5 opacity-70 last:border-b-0',
              )}
            >
              <span
                className="truncate font-mono text-[12px] text-[var(--text-muted)]"
                title={bootstrapGroupLabel(observation.model, observation.task_id)}
              >
                {bootstrapGroupLabel(observation.model, observation.task_id)}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] italic">
                no samples
              </span>
              <span aria-hidden />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
