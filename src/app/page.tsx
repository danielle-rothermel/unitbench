import Link from 'next/link'
import { ErrorSection } from '@/components/panels/ErrorSection'
import { Tag } from '@/components/primitives'
import { getConnectionStatus } from '@/lib/neon'
import { getTableConfigs } from '@/lib/table-config'

export const dynamic = 'force-dynamic'

function statusToneClass(tone: 'green' | 'red' | 'yellow') {
  if (tone === 'green') return 'green'
  if (tone === 'red') return 'red'
  return 'yellow'
}

function statusCopy(status: Awaited<ReturnType<typeof getConnectionStatus>>) {
  if (status.status === 'ok') {
    return {
      title: 'Neon connected',
      message: 'Server-side database reads are available.',
      tone: 'green' as const,
    }
  }
  if (status.status === 'missing-url') {
    return {
      title: 'DATABASE_URL not configured',
      message:
        'Set DATABASE_URL locally or in Vercel to read published Unitbench tables.',
      tone: 'yellow' as const,
    }
  }
  return {
    title: 'Neon connection failed',
    message: status.message,
    tone: 'red' as const,
  }
}

export default async function Page() {
  const [tables, connection] = await Promise.all([
    Promise.resolve(getTableConfigs()),
    getConnectionStatus(),
  ])
  const status = statusCopy(connection)

  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <Tag tone={statusToneClass(status.tone)}>{status.title}</Tag>
        </div>
        <h1 className="font-display text-[30px] leading-tight font-bold text-[var(--text-primary)]">
          Unitbench
        </h1>
        <p className="mt-1.5 max-w-[680px] text-[15px] text-[var(--text-secondary)]">
          A lightweight viewer for published benchmark and experiment result
          tables. V1 reads allowlisted Neon tables from server-side Next.js code.
        </p>
      </header>

      {connection.status !== 'ok' && (
        <div className="mb-6">
          <ErrorSection
            tone={connection.status === 'missing-url' ? 'setup' : 'error'}
            title={status.title}
            message={status.message}
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {tables.map(table => (
          <Link
            key={table.id}
            href={`/tables/${table.id}`}
            className="group flex min-h-[178px] flex-col rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-5 transition-colors hover:border-[color-mix(in_oklch,var(--accent)_45%,var(--border))] hover:bg-[var(--bg-hover)]"
          >
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-bg)] text-[var(--accent)]">
              <svg
                aria-hidden="true"
                width="20"
                height="20"
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
            </span>
            <h2 className="font-display text-[17px] font-semibold text-[var(--text-primary)]">
              {table.label}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              {table.description}
            </p>
            <span className="mt-auto pt-4 text-[13px] font-medium text-[var(--accent)]">
              Open table
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
