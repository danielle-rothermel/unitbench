'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { TableConfig } from '@/lib/table-config'

type AppShellProps = {
  children: ReactNode
  tables: TableConfig[]
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function TableIcon() {
  return (
    <svg
      aria-hidden="true"
      role="presentation"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 4.5H13.5" />
      <path d="M2.5 8H13.5" />
      <path d="M2.5 11.5H13.5" />
      <path d="M5 2.5V13.5" />
      <path d="M11 2.5V13.5" />
    </svg>
  )
}

export default function AppShell({ children, tables }: AppShellProps) {
  const pathname = usePathname() ?? '/'

  return (
    <div className="min-h-screen md:flex">
      <nav className="z-10 flex flex-col border-b border-[var(--border)] bg-[var(--bg-secondary)] py-5 md:fixed md:inset-y-0 md:left-0 md:w-64 md:border-r md:border-b-0">
        <div className="mb-4 border-b border-[var(--border)] px-5 pb-5">
          <Link href="/" className="inline-block">
            <h1 className="font-display text-xl font-bold text-[var(--accent)]">
              Unitbench
            </h1>
            <span className="ml-0.5 font-display text-[11px] font-medium tracking-[0.12em] text-[var(--text-muted)] uppercase">
              experiment viewer
            </span>
          </Link>
        </div>
        <div className="px-3">
          <span className="mb-1.5 block px-2 font-display text-[11px] font-semibold tracking-[0.08em] text-[var(--text-muted)] uppercase">
            Tables
          </span>
          {tables.map(table => {
            const href = `/tables/${table.id}`
            return (
              <Link
                key={table.id}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive(pathname, href)
                    ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
                )}
              >
                <TableIcon />
                <span className="truncate">{table.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
      <main className="min-h-screen flex-1 px-5 py-6 md:ml-64 md:px-10 md:py-8">
        {children}
      </main>
    </div>
  )
}
