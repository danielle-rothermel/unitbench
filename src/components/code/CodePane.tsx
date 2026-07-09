'use client'

import { useMemo } from 'react'
import hljs from 'highlight.js/lib/core'
import type { LanguageFn } from 'highlight.js'
import bash from 'highlight.js/lib/languages/bash'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import { cn } from '@/lib/cn'
import { codeStats, formatBytes } from '@/lib/format'

const LANGUAGES: Record<string, LanguageFn> = {
  bash,
  javascript,
  json,
  python,
  sql,
  typescript,
}

for (const [name, fn] of Object.entries(LANGUAGES)) {
  hljs.registerLanguage(name, fn)
}

function highlightCode(
  value: string,
  language: string | null | undefined,
): string | null {
  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(value, { language }).value
    }
    return hljs.highlightAuto(value).value
  } catch {
    return null
  }
}

type CodePaneProps = {
  label: string
  value: string | null | undefined
  language?: string | null
  badge?: string | null
  accent?: boolean
  className?: string
  collapsible?: boolean
  defaultOpen?: boolean
}

const PANE_CLASS =
  'flex min-w-0 flex-col self-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]'
const PANE_HEADER_CLASS =
  'flex items-center gap-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2.5'

type PaneHeaderContentProps = {
  label: string
  accent?: boolean
  badge?: string | null
  stats: { lines: number; chars: number; bytes: number }
}

function PaneHeaderContent({
  label,
  accent,
  badge,
  stats,
}: PaneHeaderContentProps) {
  return (
    <>
      <span
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          accent ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]',
        )}
        aria-hidden="true"
      />
      <h3 className="text-[12px] font-semibold tracking-[0.04em] text-[var(--text-primary)] uppercase">
        {label}
      </h3>
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
    </>
  )
}

export function CodePane({
  label,
  value,
  language,
  badge,
  accent,
  className,
  collapsible,
  defaultOpen,
}: CodePaneProps) {
  const html = useMemo(
    () => (value ? highlightCode(value, language) : ''),
    [value, language],
  )
  const stats = useMemo(() => (value ? codeStats(value) : null), [value])
  if (!value || !stats) return null

  const body = (
    <pre className="m-0 flex-1 overflow-auto bg-[var(--bg-code)] p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre text-[var(--text-primary)]">
      {html === null ? (
        <code>{value}</code>
      ) : (
        <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </pre>
  )

  if (collapsible) {
    return (
      <details
        open={defaultOpen}
        className={cn('group', PANE_CLASS, className)}
      >
        <summary
          className={cn(
            PANE_HEADER_CLASS,
            'cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden',
          )}
        >
          <span
            aria-hidden="true"
            className="shrink-0 text-[10px] text-[var(--text-muted)] transition-transform group-open:rotate-90"
          >
            ▶
          </span>
          <PaneHeaderContent
            label={label}
            accent={accent}
            badge={badge}
            stats={stats}
          />
        </summary>
        {body}
      </details>
    )
  }

  return (
    <section className={cn(PANE_CLASS, className)}>
      <header className={PANE_HEADER_CLASS}>
        <PaneHeaderContent
          label={label}
          accent={accent}
          badge={badge}
          stats={stats}
        />
      </header>
      {body}
    </section>
  )
}
