type ErrorSectionProps = {
  title: string
  message: string
  tone?: 'error' | 'setup'
}

export function ErrorSection({
  title,
  message,
  tone = 'error',
}: ErrorSectionProps) {
  const isError = tone === 'error'
  return (
    <div
      className={
        isError
          ? 'flex items-start gap-4 rounded-xl border border-[var(--red-border)] bg-[var(--red-bg)] p-5'
          : 'flex items-start gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5'
      }
    >
      <span
        className={
          isError
            ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--red)] text-sm font-bold text-white'
            : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white'
        }
      >
        !
      </span>
      <div>
        <p
          className={
            isError
              ? 'mb-1 font-semibold text-[var(--red)]'
              : 'mb-1 font-semibold text-[var(--text-primary)]'
          }
        >
          {title}
        </p>
        <p className="text-[13px] text-[var(--text-secondary)]">{message}</p>
      </div>
    </div>
  )
}
