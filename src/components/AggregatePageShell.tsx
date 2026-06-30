import Link from 'next/link'
import type { ReactNode } from 'react'
import { Dot, Tag } from '@/components/primitives'

type AggregatePageShellProps = {
  title: string
  description: string
  crossLink?: { href: string; label: string }
  children: ReactNode
}

export function AggregatePageShell({
  title,
  description,
  crossLink,
  children,
}: AggregatePageShellProps) {
  return (
    <div className="w-full">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          <span aria-hidden="true">&lt;-</span> Back to tables
        </Link>
      </div>

      <header className="mb-7 max-w-[980px]">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-secondary)]">
          <Tag mono>published_predictions</Tag>
          <Dot />
          <span>Analysis</span>
        </div>
        <h1 className="font-display text-[28px] leading-tight font-bold text-[var(--text-primary)]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
        {crossLink && (
          <p className="mt-2 text-[13px]">
            <Link
              href={crossLink.href}
              className="font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              {crossLink.label}
            </Link>
          </p>
        )}
      </header>

      {children}
    </div>
  )
}
