import { Tag } from '@/components/primitives'
import type { EvaluationCaseStatus } from '@/fixtures/primitives'

/**
 * Own status → tone map: shared ResultBadge's STATE_BADGE has no
 * 'timeout'/'error' entries and primitives.tsx is not edited here.
 * Tones match the STATE_BADGE additions landing in the R3 PR
 * (error red, timeout yellow) so adjacent pages agree.
 */
export const TEST_STATUS_TONE: Record<
  EvaluationCaseStatus,
  'green' | 'red' | 'yellow' | 'blue'
> = {
  passed: 'green',
  failed: 'red',
  error: 'red',
  timeout: 'yellow',
}

type TestStatusTagProps = {
  status: EvaluationCaseStatus
  /** When set, renders the "passed × 4" summary-chip form. */
  count?: number
}

export function TestStatusTag({ status, count }: TestStatusTagProps) {
  return (
    <Tag tone={TEST_STATUS_TONE[status]}>
      {count === undefined ? status : `${status} × ${count}`}
    </Tag>
  )
}
