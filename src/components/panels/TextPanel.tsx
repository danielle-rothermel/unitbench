import { SECTION_LABEL } from '@/components/primitives'
import { cn } from '@/lib/cn'

type TextPanelProps = {
  label: string
  value: string | null | undefined
  className?: string
}

export function TextPanel({ label, value, className }: TextPanelProps) {
  if (!value) return null
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]',
        className,
      )}
    >
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2.5">
        <h3 className={SECTION_LABEL}>{label}</h3>
      </header>
      <div className="px-4 py-3 text-[13px] whitespace-pre-wrap text-[var(--text-secondary)]">
        {value}
      </div>
    </section>
  )
}
