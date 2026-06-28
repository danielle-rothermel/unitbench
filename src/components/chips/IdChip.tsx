'use client'

type IdChipProps = {
  label: string
  value: string | null | undefined
}

export function IdChip({ label, value }: IdChipProps) {
  if (!value) return null
  return (
    <button
      type="button"
      className="inline-flex items-baseline gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2 py-1 text-left"
      title={`${label}: ${value}`}
      onClick={() => void navigator.clipboard?.writeText(value)}
    >
      <span className="text-[10px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase">
        {label}
      </span>
      <span className="max-w-[18rem] truncate font-mono text-[12px] text-[var(--text-primary)]">
        {value}
      </span>
    </button>
  )
}
