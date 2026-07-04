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

function ChartIcon() {
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
      <path d="M2.5 12.5V8.5" />
      <path d="M6.5 12.5V5.5" />
      <path d="M10.5 12.5V3.5" />
      <path d="M14.5 12.5V7.5" />
      <path d="M2 12.5H14.5" />
    </svg>
  )
}

function NavGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-5 px-3 first:mt-0">
      <span className="mb-1.5 block px-2 text-[11px] font-semibold tracking-[0.08em] text-[var(--text-muted)] uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

function NavLink({
  href,
  active,
  icon,
  label,
}: {
  href: string
  active: boolean
  icon: ReactNode
  label: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  )
}

function PlannedLane() {
  return (
    <span className="block px-3 py-1.5 text-[12px] text-[var(--text-muted)] italic">
      planned
    </span>
  )
}

function CodeIcon() {
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
      <path d="M5.5 4.5L2 8L5.5 11.5" />
      <path d="M10.5 4.5L14 8L10.5 11.5" />
    </svg>
  )
}

function GraphIcon() {
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
      <circle cx="3.5" cy="8" r="1.8" />
      <circle cx="12.5" cy="3.5" r="1.8" />
      <circle cx="12.5" cy="12.5" r="1.8" />
      <path d="M5.2 7.2L10.8 4.3" />
      <path d="M5.2 8.8L10.8 11.7" />
    </svg>
  )
}

function FlaskIcon() {
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
      <path d="M6.5 2.5H9.5" />
      <path d="M7 2.5V6L3.5 12.2C3 13.1 3.6 14 4.6 14H11.4C12.4 14 13 13.1 12.5 12.2L9 6V2.5" />
      <path d="M5 10.5H11" />
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
            <span className="block font-display text-xl font-bold text-[var(--accent)]">
              Unitbench
            </span>
            <span className="ml-0.5 text-[11px] font-medium tracking-[0.12em] text-[var(--text-muted)] uppercase">
              experiment viewer
            </span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavGroup label="Data">
            {tables.map(table => {
              const href = `/tables/${table.id}`
              return (
                <NavLink
                  key={table.id}
                  href={href}
                  active={isActive(pathname, href)}
                  icon={<TableIcon />}
                  label={table.label}
                />
              )
            })}
            <NavLink
              href="/aggregate/heatmap"
              active={isActive(pathname, '/aggregate/heatmap')}
              icon={<ChartIcon />}
              label="Heatmap"
            />
            <NavLink
              href="/aggregate"
              active={pathname === '/aggregate'}
              icon={<ChartIcon />}
              label="Aggregation"
            />
          </NavGroup>
          <NavGroup label="Replay">
            <PlannedLane />
          </NavGroup>
          <NavGroup label="Playgrounds">
            <NavLink
              href="/playgrounds/parser"
              active={isActive(pathname, '/playgrounds/parser')}
              icon={<CodeIcon />}
              label="Parser"
            />
            <NavLink
              href="/playgrounds/provider"
              active={isActive(pathname, '/playgrounds/provider')}
              icon={<ChartIcon />}
              label="Provider"
            />
          </NavGroup>
          <NavGroup label="Design">
            <NavLink
              href="/design/graph"
              active={isActive(pathname, '/design/graph')}
              icon={<GraphIcon />}
              label="Graph viewer"
            />
          </NavGroup>
          <NavGroup label="Lab">
            <NavLink
              href="/lab"
              active={isActive(pathname, '/lab')}
              icon={<FlaskIcon />}
              label="Experiments"
            />
          </NavGroup>
        </div>
      </nav>
      <main className="min-h-screen flex-1 px-5 py-6 md:ml-64 md:px-10 md:py-8">
        {children}
      </main>
    </div>
  )
}
