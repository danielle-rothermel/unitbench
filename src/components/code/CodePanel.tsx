import { CodeBlock } from '@dr-code/viewer'
import { SECTION_LABEL } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { codeStats, formatBytes } from '@/lib/format'

type CodePanelProps = {
  label: string
  value: string | null | undefined
  language?: string | null
  badge?: string | null
  accent?: boolean
  className?: string
}

export function CodePanel({
  label,
  value,
  language,
  badge,
  accent,
  className,
}: CodePanelProps) {
  if (!value) return null
  const stats = codeStats(value)

  return (
    <section
      className={cn(
        'flex min-w-0 flex-col self-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]',
        className,
      )}
    >
      <header className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2.5">
        <span
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            accent ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]',
          )}
          aria-hidden="true"
        />
        <h3 className={SECTION_LABEL}>{label}</h3>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {[
            `${stats.lines.toLocaleString()} lines`,
            `${stats.chars.toLocaleString()} chars`,
            formatBytes(stats.bytes),
          ].map(text => (
            <span
              key={text}
              className="rounded bg-[var(--bg-tertiary)] px-[7px] py-0.5 font-mono text-[11px] whitespace-nowrap text-[var(--text-muted)]"
            >
              {text}
            </span>
          ))}
          {badge && (
            <span className="rounded bg-[var(--accent-bg)] px-[7px] py-0.5 font-mono text-[11px] whitespace-nowrap text-[var(--accent)]">
              {badge}
            </span>
          )}
        </div>
      </header>
      <div className="flex-1 overflow-hidden bg-[var(--bg-code)] text-[12.5px] leading-relaxed text-[var(--text-primary)]">
        <CodeBlock code={value} lang={language ?? undefined} />
      </div>
    </section>
  )
}
