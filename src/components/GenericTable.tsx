import Link from 'next/link'
import { ResultBadge } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { formatCellValue, shortDate } from '@/lib/format'
import type { TableConfig, TableColumn } from '@/lib/table-config'
import type { TableRow } from '@/lib/table-data'

type GenericTableProps = {
  config: TableConfig
  rows: TableRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function valueFor(row: TableRow, column: TableColumn): unknown {
  return row[column.key]
}

function renderCell(row: TableRow, column: TableColumn) {
  const value = valueFor(row, column)
  if (column.kind === 'status') {
    return <ResultBadge state={formatCellValue(value)} size="sm" />
  }
  if (column.kind === 'date') {
    return shortDate(formatCellValue(value))
  }
  if (column.kind === 'json') {
    return (
      <code className="font-mono text-[12px] text-[var(--text-secondary)]">
        {formatCellValue(value)}
      </code>
    )
  }
  return formatCellValue(value)
}

export function GenericTable({
  config,
  rows,
  total,
  page,
  pageSize,
  totalPages,
}: GenericTableProps) {
  const previousHref =
    page > 1
      ? `/tables/${config.id}?page=${page - 1}&pageSize=${pageSize}`
      : null
  const nextHref =
    page < totalPages
      ? `/tables/${config.id}?page=${page + 1}&pageSize=${pageSize}`
      : null

  return (
    <div className="w-full">
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2.5 text-[13px]">
          <span className="font-medium text-[var(--text-secondary)]">
            <span className="font-mono text-[var(--text-primary)]">
              {total.toLocaleString()}
            </span>{' '}
            rows
          </span>
          <span className="font-mono text-[12px] text-[var(--text-muted)]">
            Page {page} of {totalPages}
          </span>
        </div>
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr>
              {config.columns.map(column => (
                <th
                  key={column.key}
                  className="sticky top-0 z-[1] border-b border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-2.5 text-left align-middle font-display text-[11px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={config.columns.length}
                  className="px-4 py-12 text-center align-middle"
                >
                  <p className="text-sm font-medium text-[var(--text-secondary)]">
                    No rows found
                  </p>
                </td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr
                key={formatCellValue(row[config.primaryKey]) || index}
                className="transition-colors last:[&>td]:border-b-0 hover:bg-[var(--bg-hover)]"
              >
                {config.columns.map(column => (
                  <td
                    key={column.key}
                    className={cn(
                      'border-b border-[var(--border-subtle)] px-4 py-2.5 align-middle text-[13px] text-[var(--text-secondary)]',
                      column.kind === 'mono' && 'font-mono',
                      column.kind === 'number' && 'font-mono text-right',
                      column.truncate && 'max-w-[260px] truncate',
                    )}
                    title={formatCellValue(valueFor(row, column))}
                  >
                    {renderCell(row, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        {previousHref ? (
          <Link
            href={previousHref}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            Previous
          </Link>
        ) : (
          <span className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-muted)] opacity-45">
            Previous
          </span>
        )}
        {nextHref ? (
          <Link
            href={nextHref}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            Next
          </Link>
        ) : (
          <span className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-muted)] opacity-45">
            Next
          </span>
        )}
      </div>
    </div>
  )
}
