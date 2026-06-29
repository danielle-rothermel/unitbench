'use client'

import { cn } from '@/lib/cn'

type IdChipProps = {
  label: string
  value: string | number | null | undefined
  display?: string | null
  copied?: string | null
  onCopy?: (value: string) => void
  className?: string
}

export function IdChip({
  label,
  value,
  display,
  copied,
  onCopy,
  className,
}: IdChipProps) {
  if (value === null || value === undefined || value === '') return null
  const stringValue = String(value)
  const isCopied = copied === stringValue
  const displayValue = display ?? stringValue
  const handleCopy = () => {
    if (onCopy) {
      onCopy(stringValue)
      return
    }
    void navigator.clipboard?.writeText(stringValue)
  }

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-baseline gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2 py-1 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]',
        className,
      )}
      aria-label={`${label}: ${isCopied ? 'copied' : displayValue}`}
      title={`${label}: ${stringValue} (click to copy)`}
      onClick={handleCopy}
    >
      <span className="text-[10px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase">
        {label}
      </span>
      <span className="max-w-[18rem] truncate font-mono text-[12px] text-[var(--text-primary)]">
        {isCopied ? 'copied ✓' : displayValue}
      </span>
    </button>
  )
}
