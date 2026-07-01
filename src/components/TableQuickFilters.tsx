'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { cn } from '@/lib/cn'
import { tableHref, type TableState } from '@/lib/table-params'

type TableQuickFiltersProps = {
  tableId: string
  state: TableState
}

type QuickFilterPreset = {
  label: string
  apply: (state: TableState) => TableState
}

const PREDICTIONS_PRESETS: QuickFilterPreset[] = [
  {
    label: 'Failed',
    apply: state => ({
      ...state,
      page: 1,
      filterIn: { ...state.filterIn, result_state: ['failed'] },
    }),
  },
  {
    label: 'Errors',
    apply: state => ({
      ...state,
      page: 1,
      filterIn: { ...state.filterIn, result_state: ['error'] },
    }),
  },
  {
    label: 'Enc-dec',
    apply: state => ({
      ...state,
      page: 1,
      filterIn: {
        ...state.filterIn,
        experiment_kind: ['humaneval_encdec'],
      },
    }),
  },
  {
    label: 'Low score',
    apply: state => ({
      ...state,
      page: 1,
      sort: 'score',
      dir: 'asc',
    }),
  },
]

const EXPERIMENTS_PRESETS: QuickFilterPreset[] = [
  {
    label: 'Lowest pass rate',
    apply: state => ({
      ...state,
      page: 1,
      sort: 'pass_rate',
      dir: 'asc',
    }),
  },
  {
    label: 'Most errors',
    apply: state => ({
      ...state,
      page: 1,
      sort: 'error_count',
      dir: 'desc',
    }),
  },
]

const PRESETS_BY_TABLE: Record<string, QuickFilterPreset[]> = {
  'published-predictions': PREDICTIONS_PRESETS,
  'published-experiments': EXPERIMENTS_PRESETS,
}

const CHIP_CLASS =
  'rounded-md border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'

export function TableQuickFilters({ tableId, state }: TableQuickFiltersProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const presets = PRESETS_BY_TABLE[tableId]
  if (!presets) return null

  const applyPreset = (preset: QuickFilterPreset) => {
    startTransition(() => router.push(tableHref(tableId, preset.apply(state))))
  }

  return (
    <div
      className={cn(
        'mb-3 flex flex-wrap items-center gap-2',
        isPending && 'opacity-60',
      )}
    >
      <span className="text-[11px] font-medium tracking-[0.06em] text-[var(--text-muted)] uppercase">
        Quick filters
      </span>
      {presets.map(preset => (
        <button
          key={preset.label}
          type="button"
          onClick={() => applyPreset(preset)}
          className={CHIP_CLASS}
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}
