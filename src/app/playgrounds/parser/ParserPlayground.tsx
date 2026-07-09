'use client'

import { useState } from 'react'
import { CodePane } from '@/components/code/CodePane'
import { Inspector } from '@/components/inspector/Inspector'
import { ErrorSection } from '@/components/panels/ErrorSection'
import { SECTION_LABEL, Tag } from '@/components/primitives'
import { cn } from '@/lib/cn'
import {
  DR_CODE_SERVE_URL,
  drCodeClient,
  type CandidateExplanation,
  type ExplainStage,
  type ExtractionExplanation,
} from '@/lib/api/dr-code-client'

const PARSER_VERSION = 'v1'
const CODE_FIELD = 'code'

const PARSER_PROFILES = [
  { id: 'humaneval-best-effort', label: 'Best effort' },
  { id: 'humaneval-field-marker', label: 'Strict field marker' },
] as const

const EXPLAIN_STAGES: { id: ExplainStage; label: string }[] = [
  { id: 'unwrap', label: 'Unwrap' },
  { id: 'candidates', label: 'Candidates' },
  { id: 'selection', label: 'Selection' },
  { id: 'result', label: 'Result' },
]

const SAMPLE_TEXT = `Here is my solution:

\`\`\`python
def broken(:
\`\`\`

Wait, let me fix that:

\`\`\`python
def add(a, b):
    return a + b
\`\`\`
`

const FACADE_HINT = `Start it with: uv run python -m dr_code.serve serve (dr-code serve branch, port 8321; override with NEXT_PUBLIC_DR_CODE_SERVE_URL)`

const CANDIDATE_TONE: Record<
  CandidateExplanation['status'],
  'green' | 'red' | 'neutral'
> = {
  selected: 'green',
  rejected: 'red',
  not_reached: 'neutral',
}

function CandidateCard({ candidate }: { candidate: CandidateExplanation }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border p-3',
        candidate.status === 'selected'
          ? 'border-[var(--green)] bg-[var(--green-bg)]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)]',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[12px] text-[var(--text-secondary)]">
          #{candidate.index}
        </span>
        <Tag tone={CANDIDATE_TONE[candidate.status]}>
          {candidate.status.replaceAll('_', ' ')}
        </Tag>
        <Tag tone={candidate.compile_ok ? 'neutral' : 'yellow'} mono>
          {candidate.compile_ok ? 'compiles' : 'no compile'}
        </Tag>
      </div>
      {candidate.rejection_reason && (
        <p className="font-mono text-[12px] text-[var(--red)]">
          {candidate.rejection_reason}
        </p>
      )}
      <CodePane
        label={`Candidate ${candidate.index}`}
        value={candidate.source}
        language="python"
        collapsible
        defaultOpen={candidate.status === 'selected'}
      />
    </div>
  )
}

export function ParserPlayground() {
  const [text, setText] = useState('')
  const [profileId, setProfileId] = useState<string>(PARSER_PROFILES[0].id)
  const [stages, setStages] = useState<Set<ExplainStage>>(
    () => new Set(EXPLAIN_STAGES.map(stage => stage.id)),
  )
  const [explanation, setExplanation] = useState<ExtractionExplanation | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const toggleStage = (stage: ExplainStage) => {
    setStages(previous => {
      const next = new Set(previous)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }

  const explain = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await drCodeClient.POST('/explain', {
        body: {
          text,
          profile_id: profileId,
          parser_version: PARSER_VERSION,
          code_field: CODE_FIELD,
          stages: [...stages],
        },
      })
      if (response.error) {
        setExplanation(null)
        setError(
          typeof response.error.detail === 'string'
            ? response.error.detail
            : `Facade returned an error (${JSON.stringify(response.error.detail)})`,
        )
        return
      }
      setExplanation(response.data ?? null)
    } catch {
      setExplanation(null)
      setError(`Could not reach the dr-code facade at ${DR_CODE_SERVE_URL}.`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={SECTION_LABEL}>Raw generation text</span>
          <textarea
            value={text}
            onChange={event => setText(event.target.value)}
            rows={10}
            placeholder="Paste a raw model generation…"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-code)] p-4 font-mono text-[12.5px] leading-relaxed text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            data-testid="parser-input"
          />
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span className={SECTION_LABEL}>Profile</span>
            <select
              value={profileId}
              onChange={event => setProfileId(event.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-1.5 font-mono text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            >
              {PARSER_PROFILES.map(profile => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <span className={SECTION_LABEL}>Stages</span>
            {EXPLAIN_STAGES.map(stage => (
              <label
                key={stage.id}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium',
                  stages.has(stage.id)
                    ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
                )}
              >
                <input
                  type="checkbox"
                  checked={stages.has(stage.id)}
                  onChange={() => toggleStage(stage.id)}
                  className="accent-[var(--accent)]"
                />
                {stage.label}
              </label>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setText(SAMPLE_TEXT)}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            >
              Load sample
            </button>
            <button
              type="button"
              onClick={explain}
              disabled={isLoading || text.trim().length === 0}
              className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Explaining…' : 'Explain'}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <ErrorSection
          tone="setup"
          title="Facade unreachable or rejected the request"
          message={`${error} ${FACADE_HINT}`}
        />
      )}

      {explanation && (
        <div className="flex flex-col gap-6" data-testid="parser-explanation">
          {explanation.unwrap && (
            <section className="flex flex-col gap-2.5">
              <span className={SECTION_LABEL}>Unwrap</span>
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone={explanation.unwrap.method ? 'blue' : 'neutral'} mono>
                  {explanation.unwrap.method ?? 'passthrough'}
                </Tag>
                {Object.entries(explanation.unwrap.metadata ?? {}).map(
                  ([key, value]) => (
                    <Tag key={key} mono>
                      {key}={String(value)}
                    </Tag>
                  ),
                )}
              </div>
            </section>
          )}

          {explanation.candidates && (
            <section className="flex flex-col gap-2.5">
              <span className={SECTION_LABEL}>
                Candidates ({explanation.candidates.length})
              </span>
              <div className="flex flex-col gap-3">
                {explanation.candidates.map(candidate => (
                  <CandidateCard key={candidate.index} candidate={candidate} />
                ))}
              </div>
            </section>
          )}

          {explanation.selection && (
            <section className="flex flex-col gap-2.5">
              <span className={SECTION_LABEL}>Selection</span>
              <div className="flex flex-wrap items-center gap-2">
                {explanation.selection.method && (
                  <Tag tone="accent" mono>
                    {explanation.selection.method}
                  </Tag>
                )}
                <p
                  className="text-[13px] text-[var(--text-secondary)]"
                  data-testid="winner-rationale"
                >
                  {explanation.selection.rationale}
                </p>
              </div>
            </section>
          )}

          {explanation.result?.extracted_code && (
            <CodePane
              label="Extracted code"
              value={explanation.result.extracted_code}
              language="python"
              accent
            />
          )}

          <Inspector
            payloadsLabel="Raw explanation"
            payloads={[{ label: 'Explanation', value: explanation }]}
          />
        </div>
      )}
    </div>
  )
}
