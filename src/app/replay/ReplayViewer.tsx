'use client'

import { useState } from 'react'
import { CodePane } from '@/components/code/CodePane'
import { Inspector } from '@/components/inspector/Inspector'
import { SECTION_LABEL, Tag } from '@/components/primitives'
import { cn } from '@/lib/cn'
import { compareRuns, type ReplayRun } from '@/lib/replay/replay-run'

const STATUS_TONE = {
  completed: 'green',
  failed: 'red',
} as const

function StepThrough({ run }: { run: ReplayRun }) {
  const [stepIndex, setStepIndex] = useState(0)
  const steps = run.node_attempts
  const step = steps[Math.min(stepIndex, steps.length - 1)]
  if (!step) return null

  return (
    <div className="flex flex-col gap-4" data-testid="replay-steps">
      <div className="flex flex-wrap items-center gap-2">
        <span className={SECTION_LABEL}>
          Step {stepIndex + 1} of {steps.length}
        </span>
        <button
          type="button"
          onClick={() => setStepIndex(index => Math.max(0, index - 1))}
          disabled={stepIndex === 0}
          className="rounded-md border border-[var(--border)] px-3 py-1 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          ← Prev
        </button>
        <button
          type="button"
          onClick={() =>
            setStepIndex(index => Math.min(steps.length - 1, index + 1))
          }
          disabled={stepIndex === steps.length - 1}
          className="rounded-md border border-[var(--border)] px-3 py-1 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next →
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {steps.map((attempt, index) => (
          <button
            key={`${attempt.node_id}-${attempt.attempt_index}`}
            type="button"
            onClick={() => setStepIndex(index)}
            className={cn(
              'rounded-md border px-2.5 py-1 font-mono text-[12px]',
              index === stepIndex
                ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]'
                : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
            )}
          >
            {attempt.node_id}#{attempt.attempt_index}
          </button>
        ))}
      </div>

      <div
        className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4"
        data-testid="replay-current-step"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[15px] font-semibold text-[var(--text-primary)]">
            {step.node_id}
          </span>
          <Tag mono>attempt {step.attempt_index}</Tag>
          <Tag tone={STATUS_TONE[step.status]}>{step.status}</Tag>
        </div>
        <Inspector
          payloadsLabel="Attempt payloads"
          payloads={[
            {
              label: 'Resolved inputs',
              value: step.input_bindings_resolved,
              defaultOpen: true,
            },
            ...(step.output !== null
              ? [{ label: 'Output', value: step.output, defaultOpen: true }]
              : []),
            ...(step.error !== null
              ? [{ label: 'Error', value: step.error, defaultOpen: true }]
              : []),
          ]}
        />
      </div>
    </div>
  )
}

function CompareView({ runs }: { runs: [ReplayRun, ReplayRun] }) {
  const [left, right] = runs
  const comparison = compareRuns(left, right)

  return (
    <div className="flex flex-col gap-4" data-testid="replay-compare">
      <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
        {[left, right].map(run => (
          <div key={run.generation_run_id} className="flex items-center gap-2">
            <span className="font-mono text-[13px] text-[var(--text-primary)]">
              {run.generation_run_id}
            </span>
            <Tag tone={STATUS_TONE[run.status]}>{run.status}</Tag>
          </div>
        ))}
      </div>
      {comparison.map(entry => (
        <div
          key={entry.nodeId}
          className={cn(
            'flex flex-col gap-3 rounded-xl border p-4',
            entry.differs
              ? 'border-[var(--yellow-border)] bg-[var(--yellow-bg)]'
              : 'border-[var(--border)] bg-[var(--bg-secondary)]',
          )}
          data-testid="replay-compare-node"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[14px] font-semibold text-[var(--text-primary)]">
              {entry.nodeId}
            </span>
            {entry.differs ? (
              <>
                <Tag tone="yellow">differs</Tag>
                {entry.differingKeys.map(key => (
                  <Tag key={key} mono>
                    {key}
                  </Tag>
                ))}
              </>
            ) : (
              <Tag tone="green">identical output</Tag>
            )}
          </div>
          <div className="grid grid-cols-2 items-start gap-4 max-lg:grid-cols-1">
            {[entry.leftAttempt, entry.rightAttempt].map((attempt, index) => (
              <div key={index} className="flex flex-col gap-2">
                {attempt ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Tag mono>attempt {attempt.attempt_index}</Tag>
                      <Tag tone={STATUS_TONE[attempt.status]}>
                        {attempt.status}
                      </Tag>
                    </div>
                    <CodePane
                      label={index === 0 ? 'Left output' : 'Right output'}
                      value={JSON.stringify(attempt.output, null, 2)}
                      language="json"
                    />
                  </>
                ) : (
                  <span className="text-[13px] text-[var(--text-muted)]">
                    no attempt
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ReplayViewer({ runs }: { runs: ReplayRun[] }) {
  const [mode, setMode] = useState<'step' | 'compare'>('step')
  const [selectedRunId, setSelectedRunId] = useState(
    runs[0]?.generation_run_id ?? '',
  )
  const selectedRun =
    runs.find(run => run.generation_run_id === selectedRunId) ?? runs[0]
  const canCompare = runs.length >= 2

  if (!selectedRun) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">
        No replay runs available.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          {(['step', 'compare'] as const).map(candidate => (
            <button
              key={candidate}
              type="button"
              onClick={() => setMode(candidate)}
              disabled={candidate === 'compare' && !canCompare}
              className={cn(
                'rounded-md border px-3 py-1.5 text-[13px] font-medium',
                mode === candidate
                  ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
              )}
            >
              {candidate === 'step' ? 'Step-through' : 'Compare runs'}
            </button>
          ))}
        </div>
        {mode === 'step' && (
          <label className="flex items-center gap-2">
            <span className={SECTION_LABEL}>Run</span>
            <select
              value={selectedRun.generation_run_id}
              onChange={event => setSelectedRunId(event.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-1.5 font-mono text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            >
              {runs.map(run => (
                <option
                  key={run.generation_run_id}
                  value={run.generation_run_id}
                >
                  {run.generation_run_id} ({run.status})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {mode === 'step' ? (
        <StepThrough
          key={selectedRun.generation_run_id}
          run={selectedRun}
        />
      ) : (
        <CompareView runs={[runs[0], runs[1]] as [ReplayRun, ReplayRun]} />
      )}
    </div>
  )
}
