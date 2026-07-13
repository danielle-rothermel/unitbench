'use client'

import { useEffect, useMemo, useState } from 'react'
import { SECTION_LABEL, Tag } from '@/components/primitives'
import { cn } from '@/lib/cn'
import type { components } from '@/lib/api/dr-code'

const DR_CODE_API_BASE_URL =
  process.env.NEXT_PUBLIC_DR_CODE_API_BASE_URL ?? 'http://127.0.0.1:8321'
const DEFAULT_PROFILE_ID = 'humaneval-best-effort'
const DEFAULT_PARSER_VERSION = 'v1'
const DEFAULT_TEXT = `Here is the answer:

\`\`\`python
def add(a, b):
    return a + b
\`\`\`
`
const FACADE_HINT =
  'Facade: uv --directory ../dr-code run python -m dr_code.serve serve (port 8321).'

type ExtractionTrace = components['schemas']['ExtractionTrace']
type ExtractionTraceNode = components['schemas']['ExtractionTraceNode']
type CandidateSelectionTrace =
  components['schemas']['CandidateSelectionTrace']
type ProfilesResponse = components['schemas']['ProfilesResponse']

type RequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; trace: ExtractionTrace }
  | { status: 'error'; message: string }

function labelFromValue(value: string): string {
  return value.replaceAll('_', ' ')
}

function hasTextDiff(node: ExtractionTraceNode): boolean {
  return Boolean(node.before_text || node.after_text)
}

function verdictTone(verdict: string | null | undefined): 'green' | 'red' | 'neutral' {
  if (verdict === 'pass') return 'green'
  if (verdict === 'fail') return 'red'
  return 'neutral'
}

function statusTone(status: string): 'green' | 'red' | 'blue' | 'neutral' {
  if (status === 'selected') return 'green'
  if (status === 'rejected') return 'red'
  if (status === 'not_reached') return 'blue'
  return 'neutral'
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = await response.text()
  if (!body) return `${response.status} ${response.statusText}`

  try {
    const parsed = JSON.parse(body) as unknown
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'detail' in parsed
    ) {
      const detail = parsed.detail
      return typeof detail === 'string' ? detail : JSON.stringify(detail)
    }
  } catch {
    return body
  }

  return body
}

function CodeBlock({ value }: { value: string | null | undefined }) {
  return (
    <pre className="min-h-[96px] overflow-auto rounded-md border border-[var(--border-subtle)] bg-[var(--bg-code)] p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-[var(--text-primary)]">
      {value || 'empty'}
    </pre>
  )
}

function TextDiff({ node }: { node: ExtractionTraceNode }) {
  if (!hasTextDiff(node)) return null

  return (
    <div className="mt-3 grid grid-cols-2 gap-3 max-lg:grid-cols-1">
      <div>
        <div className="mb-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase">
          Before
        </div>
        <CodeBlock value={node.before_text} />
      </div>
      <div>
        <div className="mb-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase">
          After
        </div>
        <CodeBlock value={node.after_text} />
      </div>
    </div>
  )
}

function TraceNodeCard({
  node,
  depth = 0,
}: {
  node: ExtractionTraceNode
  depth?: number
}) {
  const children = node.children ?? []

  return (
    <li
      className={cn(
        'rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3',
        depth > 0 && 'ml-4 border-l-2',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={node.kind === 'fork' ? 'blue' : 'neutral'}>
          {labelFromValue(node.kind)}
        </Tag>
        <span className="font-display text-[14px] font-semibold text-[var(--text-primary)]">
          {labelFromValue(node.name)}
        </span>
        {node.verdict && (
          <Tag tone={verdictTone(node.verdict)}>
            {labelFromValue(node.verdict)}
          </Tag>
        )}
      </div>
      {node.reason && (
        <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
          {node.reason}
        </p>
      )}
      <TextDiff node={node} />
      {children.length > 0 && (
        <ol className="mt-3 space-y-3">
          {children.map((child, index) => (
            <TraceNodeCard
              key={`${child.kind}-${child.name}-${index}`}
              node={child}
              depth={depth + 1}
            />
          ))}
        </ol>
      )}
    </li>
  )
}

function CheckList({ checks }: { checks: ExtractionTraceNode[] }) {
  if (checks.length === 0) {
    return (
      <p className="text-[13px] text-[var(--text-muted)]">
        No checks were run for this candidate.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {checks.map((check, index) => (
        <li
          key={`${check.name}-${index}`}
          className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] text-[var(--text-primary)]">
              {check.check_name ?? check.name}
            </span>
            <Tag tone={verdictTone(check.verdict)}>{check.verdict ?? 'n/a'}</Tag>
          </div>
          {check.reason && (
            <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
              {check.reason}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

function CandidateCard({ candidate }: { candidate: CandidateSelectionTrace }) {
  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-display text-[15px] font-semibold text-[var(--text-primary)]">
          Candidate {candidate.index}
        </span>
        <Tag tone={statusTone(candidate.status)}>
          {labelFromValue(candidate.status)}
        </Tag>
        {candidate.compile_ok !== null && candidate.compile_ok !== undefined && (
          <Tag tone={candidate.compile_ok ? 'green' : 'red'}>
            compile {candidate.compile_ok ? 'ok' : 'failed'}
          </Tag>
        )}
      </div>
      {candidate.rejection_reason && (
        <p className="mb-3 text-[13px] text-[var(--red)]">
          {candidate.rejection_reason}
        </p>
      )}
      <CodeBlock value={candidate.source} />
      <div className="mt-3">
        <CheckList checks={candidate.checks ?? []} />
      </div>
    </article>
  )
}

function TraceResult({ trace }: { trace: ExtractionTrace }) {
  return (
    <div className="space-y-5" data-testid="trace-result">
      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="accent">{trace.profile.profile_id}</Tag>
          <Tag mono>{trace.profile.version}</Tag>
          {trace.extraction_method && (
            <Tag tone="green">{labelFromValue(trace.extraction_method)}</Tag>
          )}
          {trace.extraction_error && (
            <Tag tone="red">{trace.extraction_error}</Tag>
          )}
        </div>
        <p className="mt-3 text-[15px] text-[var(--text-primary)]">
          {trace.rationale}
        </p>
      </section>

      <section>
        <h2 className={SECTION_LABEL}>Candidate lineage</h2>
        <ol className="mt-3 space-y-3">
          {trace.roots.map((node, index) => (
            <TraceNodeCard key={`${node.kind}-${node.name}-${index}`} node={node} />
          ))}
        </ol>
      </section>

      <section>
        <h2 className={SECTION_LABEL}>Check verdicts</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 max-xl:grid-cols-1">
          {trace.candidates.map(candidate => (
            <CandidateCard key={candidate.index} candidate={candidate} />
          ))}
        </div>
      </section>

      <section>
        <h2 className={SECTION_LABEL}>Selection walk</h2>
        <ol className="mt-3 space-y-2">
          {trace.candidates.map(candidate => (
            <li
              key={candidate.index}
              className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[13px]"
            >
              <span className="font-mono text-[var(--text-primary)]">
                #{candidate.index}
              </span>
              <Tag tone={statusTone(candidate.status)}>
                {labelFromValue(candidate.status)}
              </Tag>
              <span className="text-[var(--text-secondary)]">
                {candidate.rejection_reason ??
                  (candidate.status === 'selected'
                    ? 'first candidate passing parser checks'
                    : 'not evaluated after selection')}
              </span>
            </li>
          ))}
        </ol>
        {trace.selected_candidate_index !== null &&
          trace.selected_candidate_index !== undefined && (
            <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
              Selected candidate {trace.selected_candidate_index}.
            </p>
          )}
      </section>
    </div>
  )
}

export default function ParserPlayground() {
  const [text, setText] = useState(DEFAULT_TEXT)
  const [profileId, setProfileId] = useState(DEFAULT_PROFILE_ID)
  const [parserVersion, setParserVersion] = useState(DEFAULT_PARSER_VERSION)
  const [profileIds, setProfileIds] = useState<string[]>([DEFAULT_PROFILE_ID])
  const [requestState, setRequestState] = useState<RequestState>({
    status: 'idle',
  })

  useEffect(() => {
    const controller = new AbortController()
    async function loadProfiles() {
      try {
        const response = await fetch(`${DR_CODE_API_BASE_URL}/profiles`, {
          signal: controller.signal,
        })
        if (!response.ok) return
        const profiles = (await response.json()) as ProfilesResponse
        setProfileIds(profiles.profile_ids)
        setParserVersion(profiles.parser_version)
        if (!profiles.profile_ids.includes(profileId)) {
          setProfileId(profiles.profile_ids[0] ?? DEFAULT_PROFILE_ID)
        }
      } catch {
        return
      }
    }

    void loadProfiles()
    return () => controller.abort()
  }, [profileId])

  const canSubmit = useMemo(
    () => requestState.status !== 'loading' && text.trim().length > 0,
    [requestState.status, text],
  )

  async function explain() {
    setRequestState({ status: 'loading' })
    try {
      const response = await fetch(`${DR_CODE_API_BASE_URL}/explain`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text,
          profile_id: profileId,
          parser_version: parserVersion,
        }),
      })
      if (!response.ok) {
        setRequestState({
          status: 'error',
          message: await readErrorMessage(response),
        })
        return
      }
      setRequestState({
        status: 'success',
        trace: (await response.json()) as ExtractionTrace,
      })
    } catch (error) {
      setRequestState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Request failed',
      })
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-[1320px] grid-cols-[minmax(360px,460px)_1fr] gap-5 max-xl:grid-cols-1">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-5">
        <div className="mb-5">
          <Tag tone="blue">dr-code trace</Tag>
          <h1 className="mt-3 font-display text-[26px] leading-tight font-bold text-[var(--text-primary)]">
            Parser playground
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-secondary)]">
            Paste a raw model answer and inspect the lineage tree, candidate
            checks, and selection walk returned by the local facade.
          </p>
          <p className="mt-2 font-mono text-[12px] text-[var(--text-muted)]">
            {FACADE_HINT}
          </p>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className={SECTION_LABEL}>Profile</span>
            <select
              value={profileId}
              onChange={event => setProfileId(event.target.value)}
              className="mt-1.5 w-full rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-[14px] text-[var(--text-primary)]"
            >
              {profileIds.map(id => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={SECTION_LABEL}>Parser version</span>
            <input
              value={parserVersion}
              onChange={event => setParserVersion(event.target.value)}
              className="mt-1.5 w-full rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-[14px] text-[var(--text-primary)]"
            />
          </label>

          <label className="block">
            <span className={SECTION_LABEL}>Raw answer</span>
            <textarea
              value={text}
              onChange={event => setText(event.target.value)}
              rows={18}
              className="mt-1.5 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--bg-code)] px-3 py-2 font-mono text-[13px] leading-relaxed text-[var(--text-primary)]"
            />
          </label>

          <button
            type="button"
            onClick={explain}
            disabled={!canSubmit}
            className="inline-flex w-full items-center justify-center rounded-md bg-[var(--accent)] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {requestState.status === 'loading' ? 'Tracing...' : 'Trace parser'}
          </button>
        </div>
      </section>

      <section className="min-w-0">
        {requestState.status === 'idle' && (
          <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-secondary)] p-6 text-[14px] text-[var(--text-secondary)]">
            Run the parser to render candidate forks, transform before/after
            text, check verdicts, and the selected candidate walk.
          </div>
        )}
        {requestState.status === 'loading' && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6 text-[14px] text-[var(--text-secondary)]">
            Requesting trace from dr-code...
          </div>
        )}
        {requestState.status === 'error' && (
          <div className="rounded-xl border border-[var(--red-border)] bg-[var(--red-bg)] p-6 text-[14px] text-[var(--red)]">
            {requestState.message}
          </div>
        )}
        {requestState.status === 'success' && (
          <TraceResult trace={requestState.trace} />
        )}
      </section>
    </div>
  )
}
