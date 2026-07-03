import { StatCell } from '@/components/stats/StatCell'
import { cn } from '@/lib/cn'
import type { RunConfigField } from '@/lib/prediction-diagnostics'

type PredictionRunConfigStripProps = {
  fields: RunConfigField[]
}

function gridClass(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-2'
  if (count === 3) return 'grid-cols-3'
  return 'grid-cols-4'
}

export function PredictionRunConfigStrip({
  fields,
}: PredictionRunConfigStripProps) {
  if (fields.length === 0) return null

  return (
    <section
      className={cn(
        'mb-7 grid max-w-[1280px] gap-px border-y border-[var(--border)] bg-[var(--border-subtle)] max-md:grid-cols-2',
        gridClass(fields.length),
      )}
    >
      {fields.map(field => (
        <StatCell
          key={field.label}
          label={field.label}
          value={field.value}
          mono
        />
      ))}
    </section>
  )
}
