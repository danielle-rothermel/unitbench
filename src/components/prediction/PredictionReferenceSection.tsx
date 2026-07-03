import { CodePane } from '@/components/code/CodePane'
import { SECTION_LABEL, Tag } from '@/components/primitives'
import type { ReferenceFields } from '@/lib/prediction-diagnostics'
import {
  hasReferenceContent,
  shouldShowGroundTruth,
} from '@/lib/prediction-diagnostics'

type PredictionReferenceSectionProps = {
  reference: ReferenceFields
}

export function PredictionReferenceSection({
  reference,
}: PredictionReferenceSectionProps) {
  if (!hasReferenceContent(reference)) return null

  return (
    <section className="mb-8 flex max-w-[1280px] flex-col gap-2.5">
      <span className={SECTION_LABEL}>Reference</span>
      {reference.entryPoint && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-[var(--text-muted)] uppercase">
            Entry point
          </span>
          <Tag mono>{reference.entryPoint}</Tag>
        </div>
      )}
      <div className="grid grid-cols-2 items-start gap-4 max-lg:grid-cols-1">
        <CodePane
          label="Canonical solution"
          value={reference.canonicalSolution}
          language="python"
        />
        {shouldShowGroundTruth(reference) && (
          <CodePane
            label="Ground truth code"
            value={reference.groundTruthCode}
            language="python"
          />
        )}
        <CodePane
          label="Test harness"
          value={reference.test}
          language="python"
          accent
        />
      </div>
    </section>
  )
}
