import { SECTION_LABEL } from '@/components/primitives'
import { cn } from '@/lib/cn'

type StatCellProps = {
  label: string
  value: string | number | null | undefined
  sub?: string | null
  mono?: boolean
  className?: string
}

export function StatCell({
  label,
  value,
  sub,
  mono = false,
  className,
}: StatCellProps) {
  return (
    <div className={cn('bg-[var(--bg-primary)] px-4 py-3', className)}>
      <div className={SECTION_LABEL}>{label}</div>
      <div
        className={cn(
          'mt-1 text-[13px] break-all text-[var(--text-primary)]',
          mono && 'font-mono',
        )}
      >
        {value ?? '—'}
      </div>
      {sub && <div className="mt-1 text-xs text-[var(--text-muted)]">{sub}</div>}
    </div>
  )
}
