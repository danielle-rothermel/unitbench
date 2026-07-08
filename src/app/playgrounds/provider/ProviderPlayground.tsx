'use client'

import { useState } from 'react'
import { CodePane } from '@/components/code/CodePane'
import { Inspector } from '@/components/inspector/Inspector'
import { ErrorSection } from '@/components/panels/ErrorSection'
import { SECTION_LABEL, Tag } from '@/components/primitives'
import { StatCell } from '@/components/stats/StatCell'
import {
  DR_PROVIDERS_SERVE_URL,
  drProvidersClient,
  type ProviderChoice,
  type QueryResult,
  type QuerySpec,
  type ServeProviderKind,
  type VarianceReport,
} from '@/lib/api/dr-providers-client'

const PROVIDER_KINDS: { id: ServeProviderKind; label: string }[] = [
  { id: 'openrouter', label: 'OpenRouter chat' },
  { id: 'openai', label: 'OpenAI chat' },
  { id: 'openai_responses', label: 'OpenAI responses' },
  { id: 'gemini', label: 'Gemini chat' },
]

const FACADE_HINT = `Start it with: uv run python -m dr_providers.serve serve (dr-providers serve branch, port 8322; override with NEXT_PUBLIC_DR_PROVIDERS_SERVE_URL)`

const CONTROL_CLASS =
  'rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-2.5 py-1.5 font-mono text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none'

const BUTTON_CLASS =
  'rounded-md border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50'

const PRIMARY_BUTTON_CLASS =
  'rounded-md bg-[var(--accent)] px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50'

function parseOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

function toJsonl(records: unknown[]): string {
  return records.map(record => JSON.stringify(record)).join('\n')
}

function downloadJsonl(records: unknown[], filename: string): void {
  const blob = new Blob([toJsonl(records)], {
    type: 'application/jsonl',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function ProviderPlayground() {
  const [providerKind, setProviderKind] =
    useState<ServeProviderKind>('openrouter')
  const [model, setModel] = useState('openai/gpt-5-nano')
  const [prompt, setPrompt] = useState('')
  const [temperature, setTemperature] = useState('')
  const [tokenLimit, setTokenLimit] = useState('')
  const [fixtureText, setFixtureText] = useState('fixture response')
  const [fixtureTokens, setFixtureTokens] = useState('')

  const [payloadPreview, setPayloadPreview] = useState<{
    endpoint_path: string
    payload: Record<string, unknown>
  } | null>(null)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [variance, setVariance] = useState<VarianceReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const [variancePrompt, setVariancePrompt] = useState('')
  const [varianceModels, setVarianceModels] = useState('model-a, model-b')
  const [varianceSamples, setVarianceSamples] = useState('3')

  const buildSpec = (): QuerySpec => ({
    provider_kind: providerKind,
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: parseOptionalNumber(temperature) ?? null,
    token_limit: parseOptionalNumber(tokenLimit) ?? null,
  })

  const fixtureProvider = (): ProviderChoice => ({
    kind: 'scripted',
    scripted_outcomes: [
      {
        text: fixtureText,
        finish_reason: 'stop',
        completion_tokens: parseOptionalNumber(fixtureTokens) ?? null,
      },
    ],
  })

  const call = async (action: () => Promise<void>) => {
    setIsBusy(true)
    setError(null)
    try {
      await action()
    } catch {
      setError(`Could not reach the dr-providers facade at ${DR_PROVIDERS_SERVE_URL}.`)
    } finally {
      setIsBusy(false)
    }
  }

  const previewPayload = () =>
    call(async () => {
      const response = await drProvidersClient.POST('/build_payload', {
        body: { spec: buildSpec() },
      })
      if (response.error) {
        setPayloadPreview(null)
        setError(JSON.stringify(response.error.detail))
        return
      }
      setPayloadPreview(response.data ?? null)
    })

  const sendQuery = () =>
    call(async () => {
      const response = await drProvidersClient.POST('/query', {
        body: { spec: buildSpec(), provider: fixtureProvider() },
      })
      if (response.error) {
        setResult(null)
        setError(JSON.stringify(response.error.detail))
        return
      }
      setResult(response.data ?? null)
    })

  const runVariance = () =>
    call(async () => {
      const models = varianceModels
        .split(',')
        .map(entry => entry.trim())
        .filter(Boolean)
      const response = await drProvidersClient.POST('/variance', {
        body: {
          prompt: variancePrompt,
          models,
          samples: parseOptionalNumber(varianceSamples) ?? 3,
          provider_kind: providerKind,
          provider: fixtureProvider(),
        },
      })
      if (response.error) {
        setVariance(null)
        setError(JSON.stringify(response.error.detail))
        return
      }
      setVariance(response.data ?? null)
    })

  const warnings = result?.response?.warnings ?? []

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-3">
        <span className={SECTION_LABEL}>Request builder</span>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className={SECTION_LABEL}>Provider</span>
            <select
              value={providerKind}
              onChange={event =>
                setProviderKind(event.target.value as ServeProviderKind)
              }
              className={CONTROL_CLASS}
            >
              {PROVIDER_KINDS.map(kind => (
                <option key={kind.id} value={kind.id}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={SECTION_LABEL}>Model</span>
            <input
              value={model}
              onChange={event => setModel(event.target.value)}
              className={CONTROL_CLASS}
              size={24}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={SECTION_LABEL}>Temperature</span>
            <input
              value={temperature}
              onChange={event => setTemperature(event.target.value)}
              placeholder="—"
              className={CONTROL_CLASS}
              size={6}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={SECTION_LABEL}>Token limit</span>
            <input
              value={tokenLimit}
              onChange={event => setTokenLimit(event.target.value)}
              placeholder="—"
              className={CONTROL_CLASS}
              size={6}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={SECTION_LABEL}>Prompt</span>
          <textarea
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            rows={4}
            placeholder="User message…"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-code)] p-4 font-mono text-[12.5px] leading-relaxed text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            data-testid="provider-prompt"
          />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className={SECTION_LABEL}>Fixture response text</span>
            <input
              value={fixtureText}
              onChange={event => setFixtureText(event.target.value)}
              className={CONTROL_CLASS}
              size={32}
              data-testid="fixture-text"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={SECTION_LABEL}>Fixture completion tokens</span>
            <input
              value={fixtureTokens}
              onChange={event => setFixtureTokens(event.target.value)}
              placeholder="—"
              className={CONTROL_CLASS}
              size={8}
              data-testid="fixture-tokens"
            />
          </label>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={previewPayload}
              disabled={isBusy || prompt.trim().length === 0}
              className={BUTTON_CLASS}
            >
              Preview payload
            </button>
            <button
              type="button"
              onClick={sendQuery}
              disabled={isBusy || prompt.trim().length === 0}
              className={PRIMARY_BUTTON_CLASS}
            >
              Send (fixture)
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

      {payloadPreview && (
        <section className="flex flex-col gap-2.5" data-testid="provider-payload">
          <div className="flex items-center gap-2">
            <span className={SECTION_LABEL}>Wire payload</span>
            <Tag mono>{payloadPreview.endpoint_path}</Tag>
          </div>
          <CodePane
            label="Payload"
            value={JSON.stringify(payloadPreview.payload, null, 2)}
            language="json"
            badge="json"
          />
        </section>
      )}

      {result && (
        <section className="flex flex-col gap-3" data-testid="provider-response">
          <span className={SECTION_LABEL}>Response</span>
          {result.failure && (
            <div className="flex flex-col gap-2 rounded-xl border border-[var(--red-border)] bg-[var(--red-bg)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone="red" mono>
                  {result.failure.code ?? result.failure.failure_class}
                </Tag>
                <Tag mono>{result.failure.failure_class}</Tag>
                {result.failure.retryable && <Tag tone="yellow">retryable</Tag>}
              </div>
              <p className="text-[13px] text-[var(--text-secondary)]">
                {result.failure.message}
              </p>
              <button
                type="button"
                onClick={sendQuery}
                disabled={isBusy}
                className={`${BUTTON_CLASS} self-start`}
              >
                Retry
              </button>
            </div>
          )}
          {result.response && (
            <>
              {warnings.length > 0 && (
                <div
                  className="flex flex-col gap-1.5"
                  data-testid="provider-warnings"
                >
                  {warnings.map(warning => (
                    <div
                      key={warning.code}
                      className="flex flex-wrap items-baseline gap-2 rounded-md border border-[var(--yellow-border)] bg-[var(--yellow-bg)] px-3 py-2"
                    >
                      <Tag tone="yellow" mono>
                        {warning.code}
                      </Tag>
                      <span className="text-[13px] text-[var(--text-secondary)]">
                        {warning.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-4 gap-px border-y border-[var(--border)] bg-[var(--border-subtle)] max-md:grid-cols-2">
                <StatCell
                  label="Finish reason"
                  value={result.response.finish_reason}
                  mono
                />
                <StatCell
                  label="Completion tokens"
                  value={result.response.usage?.completion_tokens ?? null}
                  mono
                />
                <StatCell
                  label="Cost"
                  value={result.response.cost?.total_cost ?? null}
                  mono
                />
                <StatCell label="Model" value={result.response.model} mono />
              </div>
              <CodePane label="Response text" value={result.response.text} accent />
            </>
          )}
          <Inspector
            payloadsLabel="Raw result"
            payloads={[{ label: 'QueryResult', value: result }]}
          />
        </section>
      )}

      <section className="flex flex-col gap-3 border-t border-[var(--border)] pt-6">
        <div className="flex items-center gap-2">
          <span className={SECTION_LABEL}>Variance mode</span>
          <Tag>prompt × model × N</Tag>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className={SECTION_LABEL}>Prompt</span>
            <input
              value={variancePrompt}
              onChange={event => setVariancePrompt(event.target.value)}
              className={CONTROL_CLASS}
              size={40}
              data-testid="variance-prompt"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={SECTION_LABEL}>Models (comma-separated)</span>
            <input
              value={varianceModels}
              onChange={event => setVarianceModels(event.target.value)}
              className={CONTROL_CLASS}
              size={28}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={SECTION_LABEL}>Samples</span>
            <input
              value={varianceSamples}
              onChange={event => setVarianceSamples(event.target.value)}
              className={CONTROL_CLASS}
              size={4}
            />
          </label>
          <button
            type="button"
            onClick={runVariance}
            disabled={isBusy || variancePrompt.trim().length === 0}
            className={PRIMARY_BUTTON_CLASS}
          >
            Run variance
          </button>
        </div>

        {variance && (
          <div className="flex flex-col gap-3" data-testid="variance-report">
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    {[
                      'Model',
                      'Samples',
                      'Failures',
                      'Distinct outputs',
                      'Mean length',
                      'Min',
                      'Max',
                    ].map(headerLabel => (
                      <th
                        key={headerLabel}
                        className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2.5 text-left text-[11px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase"
                      >
                        {headerLabel}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {variance.per_model.map(row => (
                    <tr key={row.model}>
                      <td className="border-b border-[var(--border-subtle)] px-4 py-2 font-mono">
                        {row.model}
                      </td>
                      {[
                        row.samples,
                        row.failures,
                        row.distinct_outputs,
                        row.mean_length?.toFixed(1) ?? '—',
                        row.min_length ?? '—',
                        row.max_length ?? '—',
                      ].map((cell, index) => (
                        <td
                          key={index}
                          className="border-b border-[var(--border-subtle)] px-4 py-2 text-right font-mono tabular-nums"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadJsonl(variance.records, 'variance-records.jsonl')
                }
                className={BUTTON_CLASS}
              >
                Download JSONL ({variance.records.length} records)
              </button>
            </div>
            <Inspector
              payloadsLabel="Variance report"
              payloads={[{ label: 'Report', value: variance }]}
            />
          </div>
        )}
      </section>
    </div>
  )
}
