import type { ReactNode } from 'react'
import { SECTION_LABEL } from '@/components/primitives'

type ChartPanelProps = {
  title: string
  subtitle?: string
  children: ReactNode
}

/**
 * Bordered panel wrapper shared by every sweep chart. `aria-label` on the
 * section exposes each chart as a landmark region so tests (and screen
 * readers) can find charts by name.
 */
export function ChartPanel({ title, subtitle, children }: ChartPanelProps) {
  return (
    <section
      aria-label={title}
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-4"
    >
      <h3 className={SECTION_LABEL}>{title}</h3>
      {subtitle && (
        <p className="mt-1 text-xs text-[var(--text-muted)]">{subtitle}</p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  )
}

type EmptyChartStateProps = {
  message?: string
}

/** The heatmap's bordered "No data" idiom, sized for a chart panel. */
export function EmptyChartState({
  message = 'No data for the current slice.',
}: EmptyChartStateProps) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-6 text-center text-sm text-[var(--text-secondary)]">
      {message}
    </div>
  )
}
