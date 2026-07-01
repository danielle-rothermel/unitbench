'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useTransition, type ReactNode } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table'
import { ResultBadge } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { formatCellValue, formatNumber, shortDate } from '@/lib/format'
import { experimentPredictionsHref } from '@/lib/predictions-nav'
import {
  allTableColumns,
  type TableColumn,
  type TableConfig,
} from '@/lib/table-config'
import type { TableRow } from '@/lib/table-data'
import { buildTableQuery, tableHref, type TableState } from '@/lib/table-params'

type GenericTableProps = {
  config: TableConfig
  state: TableState
  rows: TableRow[]
  total: number
  totalPages: number
  hrefBuilder?: (state: TableState) => string
  getCellHref?: (row: TableRow, columnKey: string) => string | null
}

function predictionDetailHref(
  predictionId: string,
  returnQuery: string,
): string {
  const encoded = predictionId.split('/').map(encodeURIComponent).join('/')
  const base = `/predictions/${encoded}`
  return returnQuery ? `${base}?return=${encodeURIComponent(returnQuery)}` : base
}

function cellContent(value: unknown, column: TableColumn): ReactNode {
  if (column.kind === 'status') {
    return <ResultBadge state={formatCellValue(value)} size="sm" />
  }
  if (column.kind === 'date') return shortDate(formatCellValue(value))
  if (column.kind === 'number') return formatNumber(value)
  if (column.kind === 'json') {
    return (
      <code className="font-mono text-[12px] text-[var(--text-secondary)]">
        {formatCellValue(value)}
      </code>
    )
  }
  return formatCellValue(value)
}

function sortGlyph(sorted: false | 'asc' | 'desc'): string {
  if (sorted === 'asc') return '▲'
  if (sorted === 'desc') return '▼'
  return '↕'
}

export function GenericTable({
  config,
  state,
  rows,
  total,
  totalPages,
  hrefBuilder,
  getCellHref,
}: GenericTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const visibleColumns = useMemo(() => allTableColumns(config), [config])
  const returnQuery = useMemo(() => buildTableQuery(state).toString(), [state])
  const columnByKey = useMemo(
    () => new Map(visibleColumns.map(column => [column.key, column])),
    [visibleColumns],
  )

  const linkToDetail = config.detailRoute === 'prediction'
  const columns = useMemo<ColumnDef<TableRow>[]>(
    () =>
      visibleColumns.map(column => ({
        id: column.key,
        accessorKey: column.key,
        header: column.label,
        enableSorting: Boolean(column.sortable),
        cell: info => {
          const value = info.getValue()
          const row = info.row.original
          if (linkToDetail && column.key === config.primaryKey) {
            const id = formatCellValue(value)
            return (
              <Link
                href={predictionDetailHref(id, returnQuery)}
                className="font-mono text-[var(--accent)] hover:text-[var(--accent-hover)]"
              >
                {id}
              </Link>
            )
          }
          const drillHref = getCellHref?.(row, column.key)
          if (drillHref) {
            return (
              <Link
                href={drillHref}
                className="font-mono text-[var(--accent)] hover:text-[var(--accent-hover)]"
                title="View matching predictions"
              >
                {cellContent(value, column)}
              </Link>
            )
          }
          if (
            config.id === 'published-experiments' &&
            column.key === 'experiment_id'
          ) {
            const id = formatCellValue(value)
            return (
              <Link
                href={experimentPredictionsHref(id)}
                className="font-mono text-[var(--accent)] hover:text-[var(--accent-hover)]"
                title="View predictions for this experiment"
              >
                {id}
              </Link>
            )
          }
          return cellContent(value, column)
        },
      })),
    [config, getCellHref, linkToDetail, returnQuery, visibleColumns],
  )

  const sorting: SortingState = state.sort
    ? [{ id: state.sort, desc: state.dir === 'desc' }]
    : []
  const pagination: PaginationState = {
    pageIndex: state.page - 1,
    pageSize: state.pageSize,
  }

  const buildHref = hrefBuilder ?? ((next: TableState) => tableHref(config.id, next))

  const pushState = (next: TableState) => {
    startTransition(() => router.push(buildHref(next)))
  }

  const onSortingChange: OnChangeFn<SortingState> = updater => {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    const first = next[0]
    pushState({
      ...state,
      page: 1,
      sort: first ? first.id : null,
      dir: first?.desc ? 'desc' : 'asc',
    })
  }

  const onPaginationChange: OnChangeFn<PaginationState> = updater => {
    const next = typeof updater === 'function' ? updater(pagination) : updater
    pushState({ ...state, page: next.pageIndex + 1, pageSize: next.pageSize })
  }

  // React Compiler is disabled (empty next.config.ts), so useReactTable's
  // non-memoizable return is safe; silence the compiler-aware lint rule.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, pagination },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    onSortingChange,
    onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    pageCount: totalPages,
    rowCount: total,
  })

  const headers = table.getHeaderGroups()[0]?.headers ?? []
  const bodyRows = table.getRowModel().rows

  return (
    <div className={cn('w-full', isPending && 'opacity-60')}>
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2.5 text-[13px]">
          <span className="font-medium text-[var(--text-secondary)]">
            <span className="font-mono text-[var(--text-primary)]">
              {total.toLocaleString()}
            </span>{' '}
            rows
          </span>
          <span className="font-mono text-[12px] text-[var(--text-muted)]">
            Page {state.page} of {totalPages}
          </span>
        </div>
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr>
              {headers.map(header => {
                const column = columnByKey.get(header.id)
                const isNumber = column?.kind === 'number'
                const sortable = header.column.getCanSort()
                const sorted = header.column.getIsSorted()
                const label = flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )
                return (
                  <th
                    key={header.id}
                    className={cn(
                      'sticky top-0 z-[1] border-b border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2.5 align-middle font-display text-[11px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase last:border-r-0',
                      isNumber ? 'text-right' : 'text-left',
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          'group inline-flex items-center gap-1 uppercase transition-colors hover:text-[var(--text-primary)]',
                          isNumber && 'w-full justify-end',
                        )}
                      >
                        {label}
                        <span
                          className={cn(
                            'text-[10px]',
                            sorted
                              ? 'text-[var(--accent)]'
                              : 'text-[var(--border-strong)] opacity-0 transition-opacity group-hover:opacity-100',
                          )}
                          aria-hidden="true"
                        >
                          {sortGlyph(sorted)}
                        </span>
                      </button>
                    ) : (
                      label
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {bodyRows.length === 0 && (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  className="px-4 py-12 text-center align-middle"
                >
                  <p className="text-sm font-medium text-[var(--text-secondary)]">
                    No rows found
                  </p>
                </td>
              </tr>
            )}
            {bodyRows.map(row => (
              <tr
                key={row.id}
                className="transition-colors last:[&>td]:border-b-0 hover:bg-[var(--bg-hover)]"
              >
                {row.getVisibleCells().map(cell => {
                  const column = columnByKey.get(cell.column.id)
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        'border-b border-r border-[var(--border-subtle)] px-4 py-2.5 align-middle text-[13px] text-[var(--text-secondary)] last:border-r-0',
                        column?.kind === 'mono' && 'font-mono',
                        column?.kind === 'number' && 'font-mono text-right tabular-nums',
                        column?.truncate && 'max-w-[260px] truncate',
                      )}
                      title={formatCellValue(cell.getValue())}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:cursor-default disabled:text-[var(--text-muted)] disabled:opacity-45 disabled:hover:bg-transparent"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:cursor-default disabled:text-[var(--text-muted)] disabled:opacity-45 disabled:hover:bg-transparent"
        >
          Next
        </button>
      </div>
    </div>
  )
}
