import { CodePane } from '@/components/code/CodePane'
import { FunctionSelectionList } from '@/components/extraction-flow/FunctionSelectionList'
import { buildFlowNotice } from '@/components/extraction-flow/flow-notice'
import { PerTestResultsTable } from '@/components/extraction-flow/PerTestResultsTable'
import { ErrorSection } from '@/components/panels/ErrorSection'
import { Dot, SECTION_LABEL, Tag } from '@/components/primitives'
import type { ExtractionFlowSample } from '@/fixtures/extraction'
import type { GeneratedCodeOutcome } from '@/fixtures/primitives'

const STAGE_CODE_HEADER = '1 · Code — prompt → raw generation → extracted code'
const STAGE_SELECTION_HEADER = '2 · Function selection'
const STAGE_TESTS_HEADER = '3 · Test results'
const NO_OUTCOME_LABEL = 'no outcome'

const OUTCOME_TONE: Record<GeneratedCodeOutcome, 'green' | 'red' | 'yellow'> = {
  passed: 'green',
  tests_failed: 'red',
  evaluation_incomplete: 'yellow',
  empty_generation: 'yellow',
  extraction_failed: 'yellow',
  no_top_level_functions: 'yellow',
}

type PanelSlotProps = {
  label: string
  value: string | null
  language?: string | null
  badge?: string | null
  accent?: boolean
}

/**
 * CodePane returns null for empty values, which would silently collapse the
 * flow; a dashed placeholder keeps every stage visible so the gap itself is
 * the information.
 */
function PanelSlot({ label, value, language, badge, accent }: PanelSlotProps) {
  if (!value) {
    return (
      <section
        aria-label={`${label} placeholder`}
        className="flex min-h-[120px] items-center justify-center self-stretch rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-primary)] p-4"
      >
        <p className="text-[13px] text-[var(--text-muted)]">
          {label.toLowerCase()} — none
        </p>
      </section>
    )
  }
  return (
    <CodePane
      label={label}
      value={value}
      language={language}
      badge={badge}
      accent={accent}
    />
  )
}

function OutcomeTag({ outcome }: { outcome: GeneratedCodeOutcome | null }) {
  if (outcome === null) return <Tag>{NO_OUTCOME_LABEL}</Tag>
  return <Tag tone={OUTCOME_TONE[outcome]}>{outcome.replaceAll('_', ' ')}</Tag>
}

type ExtractionFlowViewProps = {
  sample: ExtractionFlowSample
}

export function ExtractionFlowView({ sample }: ExtractionFlowViewProps) {
  const notice = buildFlowNotice(sample)
  return (
    <div className="flex max-w-[1280px] flex-col gap-7">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-secondary)]">
          <Tag tone="accent">{sample.identity.experiment_kind}</Tag>
          <span className="font-mono">{sample.identity.task_id}</span>
          <Dot />
          <span className="font-mono">{sample.identity.model}</span>
          <Dot />
          <span>sample #{sample.identity.sample_index}</span>
        </div>
        <h1 className="font-mono text-[22px] leading-tight font-semibold break-all text-[var(--text-primary)]">
          {sample.identity.prediction_id}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <OutcomeTag outcome={sample.generated_code_outcome} />
          {sample.extraction_method !== null && (
            <Tag mono>{sample.extraction_method}</Tag>
          )}
          <Tag mono>entry_point: {sample.entry_point}</Tag>
        </div>
      </header>

      {notice && (
        <ErrorSection
          tone={notice.tone}
          title={notice.title}
          message={notice.message}
        />
      )}

      <section aria-label="Stage 1: code" className="flex flex-col gap-2.5">
        <h2 className={SECTION_LABEL}>{STAGE_CODE_HEADER}</h2>
        <div className="grid grid-cols-3 items-start gap-4 max-lg:grid-cols-1">
          <PanelSlot label="Prompt" value={sample.prompt_text} language="python" />
          <PanelSlot label="Raw generation" value={sample.raw_generation} />
          <PanelSlot
            label="Extracted code"
            value={sample.extracted_code}
            language="python"
            badge={sample.extraction_method}
            accent
          />
        </div>
      </section>

      <section
        aria-label="Stage 2: function selection"
        className="flex flex-col gap-2.5"
      >
        <h2 className={SECTION_LABEL}>{STAGE_SELECTION_HEADER}</h2>
        <FunctionSelectionList
          parsed_functions={sample.parsed_functions}
          best_function_name={sample.best_function_name}
          entry_point={sample.entry_point}
        />
      </section>

      <section
        aria-label="Stage 3: test results"
        className="flex flex-col gap-2.5"
      >
        <h2 className={SECTION_LABEL}>{STAGE_TESTS_HEADER}</h2>
        <PerTestResultsTable
          per_test_results={sample.per_test_results}
          status_counts={sample.status_counts}
        />
      </section>
    </div>
  )
}
