'use client'

import { SECTION_LABEL } from '@/components/primitives'
import { cn } from '@/lib/cn'
import type {
  HeadroomHeatmapState,
  HeadroomViewMode,
} from '@/lib/headroom-heatmap-params'

const CONTROL_CLASS =
  'rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none'

const BIN_COUNT_OPTIONS = [5, 10, 15, 20, 25]
const VIEW_MODES: { mode: HeadroomViewMode; label: string }[] = [
  { mode: 'facets', label: 'Facets' },
  { mode: 'overlay', label: 'Overlay' },
]
const AUTO_DOMAIN_VALUE = 'auto'
/** 0–2 matches the fixture's max target ratio; fixed domains give round bin edges. */
const X_DOMAIN_PRESETS: { value: string; label: string; domain?: [number, number] }[] = [
  { value: AUTO_DOMAIN_VALUE, label: 'Auto (data extent)' },
  { value: '0:1', label: '0 – 1', domain: [0, 1] },
  { value: '0:2', label: '0 – 2', domain: [0, 2] },
]

type HeadroomHeatmapControlsProps = {
  state: HeadroomHeatmapState
  onCommit: (next: HeadroomHeatmapState) => void
  showResetOrder: boolean
}

function binOptions(current: number): number[] {
  return BIN_COUNT_OPTIONS.includes(current)
    ? BIN_COUNT_OPTIONS
    : [...BIN_COUNT_OPTIONS, current].sort((left, right) => left - right)
}

function domainValue(domain: [number, number] | undefined): string {
  return domain ? domain.join(':') : AUTO_DOMAIN_VALUE
}

export function HeadroomHeatmapControls({
  state,
  onCommit,
  showResetOrder,
}: HeadroomHeatmapControlsProps) {
  const currentDomainValue = domainValue(state.x_domain)
  const domainOptions = X_DOMAIN_PRESETS.some(
    option => option.value === currentDomainValue,
  )
    ? X_DOMAIN_PRESETS
    : [
        ...X_DOMAIN_PRESETS,
        {
          value: currentDomainValue,
          label: state.x_domain ? `${state.x_domain[0]} – ${state.x_domain[1]}` : '',
          domain: state.x_domain,
        },
      ]

  const handleDomainChange = (value: string) => {
    const domain = domainOptions.find(option => option.value === value)?.domain
    onCommit({ ...state, x_domain: domain })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <span className={SECTION_LABEL}>View</span>
        <div className="inline-flex overflow-hidden rounded-md border border-[var(--border)]">
          {VIEW_MODES.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              aria-pressed={state.view === mode}
              onClick={() => {
                if (state.view !== mode) onCommit({ ...state, view: mode })
              }}
              className={cn(
                'px-2.5 py-1.5 text-[13px]',
                state.view === mode
                  ? 'bg-[var(--accent-bg)] font-medium text-[var(--accent)]'
                  : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className={SECTION_LABEL}>X bins</span>
        <select
          value={state.x_bin_count}
          onChange={event =>
            onCommit({ ...state, x_bin_count: Number(event.target.value) })
          }
          className={CONTROL_CLASS}
        >
          {binOptions(state.x_bin_count).map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={SECTION_LABEL}>Y bins</span>
        <select
          value={state.y_bin_count}
          onChange={event =>
            onCommit({ ...state, y_bin_count: Number(event.target.value) })
          }
          className={CONTROL_CLASS}
        >
          {binOptions(state.y_bin_count).map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={SECTION_LABEL}>X domain</span>
        <select
          value={currentDomainValue}
          onChange={event => handleDomainChange(event.target.value)}
          className={CONTROL_CLASS}
        >
          {domainOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {showResetOrder && (
        <button
          type="button"
          onClick={() => onCommit({ ...state, facetOrder: undefined })}
          className="pb-1.5 text-[12px] text-[var(--accent)] underline-offset-2 hover:underline"
        >
          Reset order
        </button>
      )}
    </div>
  )
}
