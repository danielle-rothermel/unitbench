const EMPTY_CELL_COLOR = 'var(--bg-secondary)'
/** 12% floor keeps single-task cells visible against the empty-cell color. */
const MIN_RAMP_PERCENT = 12
const MAX_RAMP_PERCENT = 100
/** First stop is just above zero so the bar starts at the visible-count floor. */
const LEGEND_GRADIENT_STOPS = [1e-6, 0.25, 0.5, 0.75, 1]

/**
 * Sequential single-hue count ramp on the theme accent. count 0 gets a
 * distinct empty color so "no tasks" never reads as "few tasks".
 */
export function countColor(count: number, max: number): string {
  if (count <= 0 || max <= 0) return EMPTY_CELL_COLOR
  const t = Math.min(1, count / max)
  const percent =
    Math.round((MIN_RAMP_PERCENT + (MAX_RAMP_PERCENT - MIN_RAMP_PERCENT) * t) * 100) /
    100
  return `color-mix(in oklab, var(--accent) ${percent}%, var(--bg-primary))`
}

type HeadroomColorLegendProps = {
  max: number
}

export function HeadroomColorLegend({ max }: HeadroomColorLegendProps) {
  const stops = LEGEND_GRADIENT_STOPS.map(t => countColor(t * max, max))
  return (
    <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
      <span>tasks per cell</span>
      <span
        aria-hidden="true"
        className="h-3 w-3 rounded-sm border border-[var(--border)]"
        style={{ backgroundColor: EMPTY_CELL_COLOR }}
        title="Empty cell (no tasks)"
      />
      <span className="font-mono">0</span>
      <div
        className="h-3 w-24 rounded-sm border border-[var(--border)]"
        style={{ background: `linear-gradient(to right, ${stops.join(', ')})` }}
      />
      <span className="font-mono">{max}</span>
    </div>
  )
}
