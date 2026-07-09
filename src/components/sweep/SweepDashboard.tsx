'use client'

import { useMemo, useState } from 'react'
import { CostBarChart } from '@/components/sweep/CostBarChart'
import { ErrorRateChart } from '@/components/sweep/ErrorRateChart'
import { LatencyRangeChart } from '@/components/sweep/LatencyRangeChart'
import { OutcomeMixChart } from '@/components/sweep/OutcomeMixChart'
import { PassRateStripPlot } from '@/components/sweep/PassRateStripPlot'
import { PerfMeanVarianceChart } from '@/components/sweep/PerfMeanVarianceChart'
import { SweepSummaryStrip } from '@/components/sweep/SweepSummaryStrip'
import { sweepSliceValues } from '@/components/sweep/sweep-chart-utils'
import { SECTION_LABEL } from '@/components/primitives'
import type { SweepMetricsRow } from '@/fixtures'

type SweepDashboardProps = {
  /** makeSweepMetricsRows({ groupBy: ['model'] }) or the matching SQL rows. */
  perModel: SweepMetricsRow[]
  /** makeSweepMetricsRows({ groupBy: ['task_id'] }). */
  perTask: SweepMetricsRow[]
  /** makeSweepMetricsRows({ groupBy: ['model', 'task_id'] }). */
  perModelTask: SweepMetricsRow[]
}

const SELECT_CLASS =
  'rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1.5 font-mono text-[12px] text-[var(--text-primary)]'

/**
 * Composes the sweep-metrics charts and owns the model/task slice state.
 * Slicing never re-aggregates: it selects which pre-grouped rows feed each
 * chart (perModel / perTask by default, filtered perModelTask when sliced).
 */
export function SweepDashboard({ perModel, perTask, perModelTask }: SweepDashboardProps) {
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedTask, setSelectedTask] = useState('')

  const modelOptions = useMemo(() => sweepSliceValues(perModel, 'model'), [perModel])
  const taskOptions = useMemo(() => sweepSliceValues(perTask, 'task_id'), [perTask])

  const hasData = perModel.length > 0 || perTask.length > 0 || perModelTask.length > 0
  if (!hasData) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
        No sweep data to summarize.
      </div>
    )
  }

  const modelChartRows = selectedTask
    ? perModelTask.filter(row => row.task_id === selectedTask)
    : perModel
  const taskChartRows = selectedModel
    ? perModelTask.filter(row => row.model === selectedModel)
    : perTask
  const summaryRows =
    selectedModel || selectedTask
      ? perModelTask.filter(
          row =>
            (!selectedModel || row.model === selectedModel) &&
            (!selectedTask || row.task_id === selectedTask),
        )
      : perModel

  const modelBandSuffix = selectedTask ? ` on ${selectedTask}` : ''
  const taskBandSuffix = selectedModel ? ` for ${selectedModel}` : ''

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
            Sweep health
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
            Are any tasks or models broken? Slice by model or task — every chart
            re-reads the matching pre-grouped rows, nothing is re-aggregated.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className={SECTION_LABEL}>Model</span>
            <select
              value={selectedModel}
              onChange={event => setSelectedModel(event.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">All models</option>
              {modelOptions.map(model => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={SECTION_LABEL}>Task</span>
            <select
              value={selectedTask}
              onChange={event => setSelectedTask(event.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">All tasks</option>
              {taskOptions.map(taskId => (
                <option key={taskId} value={taskId}>
                  {taskId}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <SweepSummaryStrip rows={summaryRows} />

      <section aria-label="Which tasks and models look broken" className="flex flex-col gap-3">
        <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
          Which tasks and models look broken
        </h3>
        <div className="grid gap-4 xl:grid-cols-2">
          <PassRateStripPlot rows={perModelTask} highlightTaskId={selectedTask || null} />
          <OutcomeMixChart
            rows={taskChartRows}
            groupKey="task_id"
            title="How runs end, by task"
            highlightValue={selectedTask || null}
          />
        </div>
      </section>

      <section aria-label="Model health" className="flex flex-col gap-3">
        <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
          Model health{modelBandSuffix}
        </h3>
        <div className="grid gap-4 xl:grid-cols-2">
          <PerfMeanVarianceChart
            rows={modelChartRows}
            groupKey="model"
            title="Score mean ± stddev by model"
            highlightValue={selectedModel || null}
          />
          <ErrorRateChart
            rows={modelChartRows}
            groupKey="model"
            title="Where errors and rate limits cluster"
            highlightValue={selectedModel || null}
          />
          <LatencyRangeChart
            rows={modelChartRows}
            groupKey="model"
            title="Latency avg → p95 by model"
            highlightValue={selectedModel || null}
          />
          <CostBarChart
            rows={modelChartRows}
            groupKey="model"
            title="Average cost by model"
            highlightValue={selectedModel || null}
          />
        </div>
      </section>

      <section aria-label="Task health" className="flex flex-col gap-3">
        <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
          Task health{taskBandSuffix}
        </h3>
        <div className="grid gap-4 xl:grid-cols-2">
          <PerfMeanVarianceChart
            rows={taskChartRows}
            groupKey="task_id"
            title="Score mean ± stddev by task"
            highlightValue={selectedTask || null}
          />
          <CostBarChart
            rows={taskChartRows}
            groupKey="task_id"
            title="Average cost by task"
            highlightValue={selectedTask || null}
          />
        </div>
      </section>
    </div>
  )
}
