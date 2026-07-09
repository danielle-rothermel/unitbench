import type { CompressionResultRow } from '@/fixtures/compression'
import { formatNumber } from '@/lib/format'

const STAGE_LABEL =
  'font-display text-[11px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase'

type CharCountFlowProps = Pick<
  CompressionResultRow,
  | 'ground_truth_char_count'
  | 'encoded_char_count'
  | 'generated_char_count'
  | 'encoder_char_budget'
>

type StageBarProps = {
  label: string
  count: number | null
  maxCount: number
  barClass: string
  budgetTick?: number | null
  note?: string | null
}

function stagePercent(value: number, maxCount: number): number {
  if (maxCount <= 0) return 0
  return Math.min(100, Math.max(0, (value / maxCount) * 100))
}

function StageBar({ label, count, maxCount, barClass, budgetTick, note }: StageBarProps) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-28 shrink-0 ${STAGE_LABEL}`}>{label}</span>
      <div className="relative h-4 flex-1 rounded-sm bg-[var(--bg-tertiary)]">
        {count !== null ? (
          <div
            data-testid={`stage-bar-${label}`}
            className={`absolute inset-y-0 left-0 rounded-sm ${barClass}`}
            style={{ width: `${stagePercent(count, maxCount)}%` }}
          />
        ) : (
          <span className="absolute inset-y-0 flex items-center pl-2 text-[11px] text-[var(--text-muted)] italic">
            not produced
          </span>
        )}
        {budgetTick !== null && budgetTick !== undefined && (
          <div
            data-testid="budget-tick"
            title={`budget ${formatNumber(budgetTick)}`}
            className="absolute -inset-y-1 w-[2px] bg-[var(--accent)]"
            style={{ left: `${stagePercent(budgetTick, maxCount)}%` }}
          />
        )}
      </div>
      <span className="w-24 shrink-0 text-right font-mono text-[12px] text-[var(--text-primary)]">
        {count !== null ? `${formatNumber(count)} chars` : '—'}
      </span>
      {note && (
        <span className="text-[11px] text-[var(--text-muted)] italic max-lg:hidden">
          {note}
        </span>
      )}
    </div>
  )
}

export function CharCountFlow({
  ground_truth_char_count,
  encoded_char_count,
  generated_char_count,
  encoder_char_budget,
}: CharCountFlowProps) {
  // Budget counts toward the scale so the tick always lands inside the track,
  // even when the encoder undershoots it.
  const maxCount = Math.max(
    ground_truth_char_count,
    encoded_char_count ?? 0,
    generated_char_count ?? 0,
    encoder_char_budget ?? 0,
  )
  const generatedExceedsGroundTruth =
    generated_char_count !== null && generated_char_count > ground_truth_char_count

  return (
    <div className="flex flex-col gap-2">
      <StageBar
        label="ground truth"
        count={ground_truth_char_count}
        maxCount={maxCount}
        barClass="bg-[var(--text-muted)]"
      />
      <StageBar
        label="encoded IR"
        count={encoded_char_count}
        maxCount={maxCount}
        barClass="bg-[var(--accent)]"
        budgetTick={encoder_char_budget}
      />
      <StageBar
        label="generated"
        count={generated_char_count}
        maxCount={maxCount}
        barClass="bg-[var(--blue)]"
        note={
          generatedExceedsGroundTruth
            ? 'exceeds ground truth (normal for reconstruction)'
            : null
        }
      />
      {encoder_char_budget !== null && (
        <span className="text-[11px] text-[var(--text-muted)]">
          encoder budget {formatNumber(encoder_char_budget)} chars (tick on encoded IR)
        </span>
      )}
    </div>
  )
}
