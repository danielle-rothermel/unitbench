import { cn } from '@/lib/cn'

type ErrorSectionProps = {
  title: string
  message: string
  tone?: 'error' | 'setup'
  className?: string
}

export function ErrorSection({
  title,
  message,
  tone = 'error',
  className,
}: ErrorSectionProps) {
  const isError = tone === 'error'
  return (
    <div
      className={cn(
        'flex items-start gap-4 rounded-xl border p-5',
        isError
          ? 'border-[var(--red-border)] bg-[var(--red-bg)]'
          : 'border-[var(--border)] bg-[var(--bg-secondary)]',
        className,
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
          isError
            ? 'bg-[var(--red)]'
            : 'bg-[var(--accent)]',
        )}
      >
        !
      </span>
      <div>
        <p
          className={cn(
            'mb-1 font-semibold',
            isError
              ? 'text-[var(--red)]'
              : 'text-[var(--text-primary)]',
          )}
        >
          {title}
        </p>
        <p className="text-[13px] text-[var(--text-secondary)]">{message}</p>
      </div>
    </div>
  )
}
