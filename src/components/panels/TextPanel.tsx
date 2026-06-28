import { SECTION_LABEL } from '@/components/primitives'

type TextPanelProps = {
  label: string
  value: string | null | undefined
}

export function TextPanel({ label, value }: TextPanelProps) {
  if (!value) return null
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]">
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2.5">
        <h3 className={SECTION_LABEL}>{label}</h3>
      </header>
      <div className="px-4 py-3 text-[13px] whitespace-pre-wrap text-[var(--text-secondary)]">
        {value}
      </div>
    </section>
  )
}
