import type { CompressionResultRow } from '@/fixtures/compression'
import { Tag } from '@/components/primitives'
import {
  achievedTone,
  formatRatio,
  ratioPercent,
  type AchievedTone,
} from '@/lib/compression-view'

const ACHIEVED_BAR_TONE: Record<AchievedTone, string> = {
  green: 'bg-[var(--green)]',
  yellow: 'bg-[var(--yellow)]',
  red: 'bg-[var(--red)]',
  neutral: 'bg-[var(--text-muted)]',
}

type CompressionRatioBulletProps = Pick<
  CompressionResultRow,
  'target_compression_ratio' | 'achieved_compression_ratio' | 'best_compression_ratio'
> & { domainMax: number }

function formatDelta(target: number, achieved: number): string {
  const delta = achieved - target
  const sign = delta >= 0 ? '+' : '−'
  return `Δ ${sign}${Math.abs(delta).toFixed(2)}`
}

export function CompressionRatioBullet({
  target_compression_ratio,
  achieved_compression_ratio,
  best_compression_ratio,
  domainMax,
}: CompressionRatioBulletProps) {
  const tone = achievedTone(target_compression_ratio, achieved_compression_ratio)
  const isExpansion =
    achieved_compression_ratio !== null && achieved_compression_ratio > 1

  return (
    <div>
      <div className="relative h-7 overflow-hidden rounded-md bg-[var(--bg-tertiary)]">
        {target_compression_ratio !== null && (
          <>
            <div
              data-testid="budget-band"
              className="absolute inset-y-0 left-0 bg-[var(--accent-bg)]"
              style={{ width: `${ratioPercent(target_compression_ratio, domainMax)}%` }}
            />
            <div
              data-testid="target-marker"
              title={`${formatRatio(target_compression_ratio)} target`}
              className="absolute inset-y-0 w-[2px] bg-[var(--accent)]"
              style={{ left: `${ratioPercent(target_compression_ratio, domainMax)}%` }}
            />
          </>
        )}
        {achieved_compression_ratio !== null && (
          <div
            data-testid="achieved-bar"
            title={`${formatRatio(achieved_compression_ratio)} achieved`}
            className={`absolute top-1/2 left-0 h-2.5 -translate-y-1/2 rounded-r-sm ${ACHIEVED_BAR_TONE[tone]}`}
            style={{
              width: `${ratioPercent(achieved_compression_ratio, domainMax)}%`,
            }}
          />
        )}
        {best_compression_ratio !== null && (
          <div
            data-testid="best-tick"
            title={`best codec ${formatRatio(best_compression_ratio)}`}
            className="absolute top-1/2 h-4 w-[2px] -translate-y-1/2 bg-[var(--text-primary)]"
            style={{ left: `${ratioPercent(best_compression_ratio, domainMax)}%` }}
          />
        )}
        <div
          data-testid="unity-reference"
          title="1.0 = no compression"
          className="absolute inset-y-0 w-0 border-l border-dashed border-[var(--border-strong)]"
          style={{ left: `${ratioPercent(1, domainMax)}%` }}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-secondary)]">
        {target_compression_ratio !== null ? (
          <span>
            <span className="font-semibold text-[var(--accent)]">
              {formatRatio(target_compression_ratio)}
            </span>{' '}
            target
          </span>
        ) : (
          <Tag tone="neutral">no target (direct run)</Tag>
        )}
        {achieved_compression_ratio !== null ? (
          <span>
            <span className="font-semibold text-[var(--text-primary)]">
              {formatRatio(achieved_compression_ratio)}
            </span>{' '}
            achieved
            {target_compression_ratio !== null && (
              <span className="font-mono">
                {' '}
                ({formatDelta(target_compression_ratio, achieved_compression_ratio)})
              </span>
            )}
          </span>
        ) : (
          <span className="text-[var(--text-muted)] italic">not measured</span>
        )}
        {best_compression_ratio !== null && (
          <span>best codec {formatRatio(best_compression_ratio)}</span>
        )}
        {isExpansion && <Tag tone="red">expansion</Tag>}
        <span className="text-[var(--text-muted)]">1.0 = no compression</span>
      </div>
    </div>
  )
}
