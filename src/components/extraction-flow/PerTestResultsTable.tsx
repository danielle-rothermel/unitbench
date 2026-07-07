import { TestStatusTag } from '@/components/extraction-flow/TestStatusTag'
import type { PerTestResult } from '@/fixtures/extraction'
import {
  EVALUATION_CASE_STATUSES,
  type EvaluationCaseStatus,
} from '@/fixtures/primitives'
import { cn } from '@/lib/cn'

const COLUMN_LABELS = [
  'status',
  'test_id',
  'function',
  'type',
  'input',
  'expected',
  'actual',
  'message',
] as const

const EMPTY_MESSAGE_PLACEHOLDER = '—'

const HEADER_CELL =
  'border-b border-[var(--border)] px-3 py-2 text-left font-display text-[11px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase'
const BODY_CELL = 'border-b border-[var(--border-subtle)] px-3 py-2 align-top'
const REPR_CELL = 'max-w-[220px] truncate font-mono text-[12px]'

type PerTestResultsTableProps = {
  per_test_results: PerTestResult[]
  status_counts: Partial<Record<EvaluationCaseStatus, number>>
}

function ReprCell({ value, failed }: { value: string; failed: boolean }) {
  return (
    <td className={cn(BODY_CELL)}>
      <code
        title={value}
        className={cn(
          'block',
          REPR_CELL,
          failed ? 'text-[var(--red)]' : 'text-[var(--text-primary)]',
        )}
      >
        {value}
      </code>
    </td>
  )
}

function StatusCountChips({
  status_counts,
}: Pick<PerTestResultsTableProps, 'status_counts'>) {
  const present = EVALUATION_CASE_STATUSES.filter(
    status => status_counts[status] !== undefined,
  )
  if (present.length === 0) return null
  const total = present.reduce(
    (sum, status) => sum + (status_counts[status] ?? 0),
    0,
  )
  const passed = status_counts.passed ?? 0
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {present.map(status => (
        <TestStatusTag
          key={status}
          status={status}
          count={status_counts[status]}
        />
      ))}
      <span className="rounded bg-[var(--bg-tertiary)] px-[7px] py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
        {passed}/{total} passed
      </span>
    </div>
  )
}

export function PerTestResultsTable({
  per_test_results,
  status_counts,
}: PerTestResultsTableProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <StatusCountChips status_counts={status_counts} />
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {COLUMN_LABELS.map(label => (
                <th key={label} scope="col" className={HEADER_CELL}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {per_test_results.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMN_LABELS.length}
                  className="px-3 py-4 text-center text-[13px] text-[var(--text-muted)]"
                >
                  no test results recorded
                </td>
              </tr>
            )}
            {per_test_results.map(result => {
              const failed = result.status !== 'passed'
              return (
                <tr key={result.test_id}>
                  <td className={BODY_CELL}>
                    <TestStatusTag status={result.status} />
                  </td>
                  <td className={cn(BODY_CELL, 'font-mono text-[12px]')}>
                    {result.test_id}
                  </td>
                  <td className={cn(BODY_CELL, 'font-mono text-[12px]')}>
                    {result.function_name}
                  </td>
                  <td className={cn(BODY_CELL, 'font-mono text-[12px]')}>
                    {result.test_type}
                  </td>
                  <ReprCell value={result.input_repr} failed={false} />
                  <ReprCell value={result.expected_output_repr} failed={failed} />
                  <ReprCell value={result.actual_output_repr} failed={failed} />
                  <td className={cn(BODY_CELL, 'text-[var(--text-secondary)]')}>
                    {result.message === ''
                      ? EMPTY_MESSAGE_PLACEHOLDER
                      : result.message}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
