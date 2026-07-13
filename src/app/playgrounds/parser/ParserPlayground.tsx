'use client'

import { ExtractionTraceView, type ExtractionTrace } from '@dr-code/viewer'
import { useEffect, useMemo, useState } from 'react'
import { SECTION_LABEL, Tag } from '@/components/primitives'
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

type ProfilesResponse = components['schemas']['ProfilesResponse']

type RequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; trace: ExtractionTrace }
  | { status: 'error'; message: string }

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

function TraceResult({ trace }: { trace: ExtractionTrace }) {
  return (
    <div data-testid="trace-result">
      <ExtractionTraceView trace={trace} />
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
