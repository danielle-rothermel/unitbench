'use client'

import { useState } from 'react'
import { EXTRACTION_FLOW_SCENARIOS } from '@/components/extraction-flow/demo-scenarios'
import { ExtractionFlowView } from '@/components/extraction-flow/ExtractionFlowView'
import { cn } from '@/lib/cn'

export function ExtractionFlowDemo() {
  const [scenarioId, setScenarioId] = useState<string>(
    EXTRACTION_FLOW_SCENARIOS[0].id,
  )
  const scenario =
    EXTRACTION_FLOW_SCENARIOS.find(entry => entry.id === scenarioId) ??
    EXTRACTION_FLOW_SCENARIOS[0]
  return (
    <div className="flex max-w-[1280px] flex-col gap-5">
      <nav aria-label="Scenario picker" className="flex flex-wrap gap-1.5">
        {EXTRACTION_FLOW_SCENARIOS.map(entry => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={entry.id === scenario.id}
            onClick={() => setScenarioId(entry.id)}
            className={cn(
              'rounded border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors',
              entry.id === scenario.id
                ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
            )}
          >
            {entry.label}
          </button>
        ))}
      </nav>
      <p className="text-[13px] text-[var(--text-secondary)]">
        {scenario.description}
      </p>
      <ExtractionFlowView sample={scenario.sample} />
    </div>
  )
}
