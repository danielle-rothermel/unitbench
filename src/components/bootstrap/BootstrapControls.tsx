'use client'

import { SECTION_LABEL } from '@/components/primitives'
import { cn } from '@/lib/cn'
import {
  BOOTSTRAP_GROUPINGS,
  type BootstrapCiConfig,
  type BootstrapGrouping,
} from '@/lib/bootstrap-ci'

type BootstrapControlsProps = {
  grouping: BootstrapGrouping
  config: BootstrapCiConfig
  /** Largest observed per-group sample count; bounds/annotates the N slider. */
  maxAvailableN: number
  onGroupingChange: (grouping: BootstrapGrouping) => void
  onConfigChange: (config: BootstrapCiConfig) => void
}

const GROUPING_LABELS: Record<BootstrapGrouping, string> = {
  model: 'model',
  task: 'task',
  model_task: 'model × task',
  overall: 'overall',
}

const RESAMPLE_OPTIONS = [500, 1000, 2000, 5000] as const
const CONFIDENCE_OPTIONS = [0.8, 0.9, 0.95, 0.99] as const
const MIN_N_SLIDER_MAX = 50

const CONTROL_FIELD = 'flex flex-col gap-1.5'
const CONTROL_INPUT =
  'rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1 font-mono text-[13px] text-[var(--text-primary)]'

export function BootstrapControls({
  grouping,
  config,
  maxAvailableN,
  onGroupingChange,
  onConfigChange,
}: BootstrapControlsProps) {
  const sliderMax = Math.max(maxAvailableN, MIN_N_SLIDER_MAX)
  const sliderValue = config.n_per_group ?? maxAvailableN

  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3">
      <div className={CONTROL_FIELD}>
        <span className={SECTION_LABEL}>Grouping</span>
        <div className="flex overflow-hidden rounded-md border border-[var(--border)]">
          {BOOTSTRAP_GROUPINGS.map(option => (
            <button
              key={option}
              type="button"
              aria-pressed={grouping === option}
              onClick={() => onGroupingChange(option)}
              className={cn(
                'px-3 py-1.5 text-[13px] whitespace-nowrap',
                grouping === option
                  ? 'bg-[var(--accent-bg)] font-medium text-[var(--accent)]'
                  : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
              )}
            >
              {GROUPING_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <div className={CONTROL_FIELD}>
        <label htmlFor="bootstrap-seed" className={SECTION_LABEL}>
          Seed
        </label>
        <div className="flex items-center gap-2">
          <input
            id="bootstrap-seed"
            type="number"
            value={config.seed}
            onChange={event => {
              const parsed = Number(event.target.value)
              // Keep the invalid-config throw unreachable from the UI
              if (Number.isInteger(parsed)) {
                onConfigChange({ ...config, seed: parsed })
              }
            }}
            className={cn(CONTROL_INPUT, 'w-20')}
          />
          <button
            type="button"
            onClick={() => onConfigChange({ ...config, seed: config.seed + 1 })}
            className="rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-1 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            title="Increment the seed — same seed always reproduces the exact same chart."
          >
            Reroll
          </button>
        </div>
      </div>

      <div className={CONTROL_FIELD}>
        <label htmlFor="bootstrap-resamples" className={SECTION_LABEL}>
          Resamples
        </label>
        <select
          id="bootstrap-resamples"
          value={config.n_resamples}
          onChange={event =>
            onConfigChange({ ...config, n_resamples: Number(event.target.value) })
          }
          className={CONTROL_INPUT}
        >
          {RESAMPLE_OPTIONS.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className={CONTROL_FIELD}>
        <label htmlFor="bootstrap-confidence" className={SECTION_LABEL}>
          Confidence
        </label>
        <select
          id="bootstrap-confidence"
          value={config.confidence_level}
          onChange={event =>
            onConfigChange({ ...config, confidence_level: Number(event.target.value) })
          }
          className={CONTROL_INPUT}
        >
          {CONFIDENCE_OPTIONS.map(option => (
            <option key={option} value={option}>
              {option.toFixed(2)}
            </option>
          ))}
        </select>
      </div>

      <div className={cn(CONTROL_FIELD, 'min-w-[220px]')}>
        <label htmlFor="bootstrap-n" className={SECTION_LABEL}>
          N per group
        </label>
        <div className="flex items-center gap-2">
          <input
            id="bootstrap-n"
            type="range"
            min={1}
            max={sliderMax}
            value={sliderValue}
            onChange={event =>
              onConfigChange({ ...config, n_per_group: Number(event.target.value) })
            }
            className="accent-[var(--accent)]"
          />
          <span className="font-mono text-[12px] whitespace-nowrap text-[var(--text-secondary)]">
            {config.n_per_group === null
              ? `all available (≤ ${maxAvailableN})`
              : `N=${config.n_per_group}${config.n_per_group > maxAvailableN ? ' (extrapolated)' : ''}`}
          </span>
          {config.n_per_group !== null && (
            <button
              type="button"
              onClick={() => onConfigChange({ ...config, n_per_group: null })}
              className="text-[12px] text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Use all available
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
