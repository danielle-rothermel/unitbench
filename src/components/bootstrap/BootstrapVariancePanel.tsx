'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import type { BootstrapSampleRow } from '@/fixtures/bootstrap'
import { BootstrapControls } from '@/components/bootstrap/BootstrapControls'
import { CiIntervalChart } from '@/components/bootstrap/CiIntervalChart'
import {
  CiWidthVsNChart,
  DEFAULT_WIDTH_THRESHOLD,
} from '@/components/bootstrap/CiWidthVsNChart'
import { cn } from '@/lib/cn'
import {
  DEFAULT_BOOTSTRAP_CONFIG,
  computeBootstrapCis,
  computeCisAcrossN,
  observeGroups,
  type BootstrapCiConfig,
  type BootstrapGrouping,
} from '@/lib/bootstrap-ci'

type BootstrapVariancePanelProps = {
  rows: BootstrapSampleRow[]
  initialConfig?: Partial<BootstrapCiConfig>
  initialGrouping?: BootstrapGrouping
}

/** Fixed compare-across-N ladder (kept out of the controls to avoid knob overload). */
const DEFAULT_N_LADDER = [2, 3, 5, 8, 12, 20, 32, 50] as const

const GROUPING_TITLES: Record<BootstrapGrouping, string> = {
  model: 'per model',
  task: 'per task',
  model_task: 'per model × task',
  overall: 'overall',
}

export function BootstrapVariancePanel({
  rows,
  initialConfig,
  initialGrouping = 'model',
}: BootstrapVariancePanelProps) {
  const [grouping, setGrouping] = useState<BootstrapGrouping>(initialGrouping)
  const [config, setConfig] = useState<BootstrapCiConfig>({
    ...DEFAULT_BOOTSTRAP_CONFIG,
    ...initialConfig,
  })
  const [thresholdWidth, setThresholdWidth] = useState(DEFAULT_WIDTH_THRESHOLD)

  // Deferred inputs keep the controls snappy while the memos recompute.
  const deferredGrouping = useDeferredValue(grouping)
  const deferredConfig = useDeferredValue(config)
  const isStale = deferredGrouping !== grouping || deferredConfig !== config

  const observations = useMemo(
    () => observeGroups(rows, deferredGrouping),
    [rows, deferredGrouping],
  )
  const summaries = useMemo(
    () => computeBootstrapCis(rows, deferredGrouping, deferredConfig),
    [rows, deferredGrouping, deferredConfig],
  )
  const ciByN = useMemo(
    () =>
      computeCisAcrossN(
        rows,
        deferredGrouping,
        {
          seed: deferredConfig.seed,
          n_resamples: deferredConfig.n_resamples,
          confidence_level: deferredConfig.confidence_level,
        },
        DEFAULT_N_LADDER,
      ),
    [
      rows,
      deferredGrouping,
      deferredConfig.seed,
      deferredConfig.n_resamples,
      deferredConfig.confidence_level,
    ],
  )
  const maxAvailableN = useMemo(
    () =>
      observations.reduce(
        (largest, observation) => Math.max(largest, observation.n_available),
        0,
      ),
    [observations],
  )

  if (rows.length === 0) {
    return (
      <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
        No bootstrap samples for this scenario.
      </div>
    )
  }

  return (
    <div className="mb-8 space-y-6">
      <BootstrapControls
        grouping={grouping}
        config={config}
        maxAvailableN={maxAvailableN}
        onGroupingChange={setGrouping}
        onConfigChange={setConfig}
      />
      <div className={cn('space-y-6', isStale && 'opacity-60')}>
        <CiIntervalChart
          summaries={summaries}
          observations={observations}
          title={`Pass-rate CIs ${GROUPING_TITLES[deferredGrouping]}`}
        />
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
            Width threshold
            <input
              type="number"
              step={0.01}
              min={0.01}
              max={1}
              value={thresholdWidth}
              onChange={event => {
                const parsed = Number(event.target.value)
                if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1) {
                  setThresholdWidth(parsed)
                }
              }}
              className="w-20 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1 font-mono text-[12px] text-[var(--text-primary)]"
            />
          </label>
          <CiWidthVsNChart
            ciByN={ciByN}
            observations={observations}
            thresholdWidth={thresholdWidth}
          />
        </div>
      </div>
    </div>
  )
}
