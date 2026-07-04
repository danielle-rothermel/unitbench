'use client'

import Link from 'next/link'
import { IdChip } from '@/components/chips/IdChip'
import { CodePane } from '@/components/code/CodePane'
import { SECTION_LABEL } from '@/components/primitives'
import { useCopy } from '@/hooks/useCopy'
import { prettyJson } from '@/lib/format'

export type InspectorLink = {
  label: string
  value: string
  href: string
}

export type InspectorId = {
  label: string
  value: string | number | null | undefined
  display?: string | null
}

export type InspectorPayload = {
  label: string
  value: unknown
  defaultOpen?: boolean
}

type InspectorProps = {
  provenanceLabel?: string
  payloadsLabel?: string
  links?: InspectorLink[]
  ids?: InspectorId[]
  payloads?: InspectorPayload[]
}

/**
 * The shared "inspect anything" block: provenance (navigable links +
 * copyable id chips) plus structured payloads rendered as collapsible
 * JSON code panes. Replay, playgrounds, and detail pages all compose
 * this instead of building their own payload/provenance sections.
 */
export function Inspector({
  provenanceLabel = 'Provenance',
  payloadsLabel = 'Payloads',
  links = [],
  ids = [],
  payloads = [],
}: InspectorProps) {
  const [copied, copy] = useCopy()
  const hasProvenance = links.length > 0 || ids.length > 0
  if (!hasProvenance && payloads.length === 0) return null

  return (
    <div className="flex flex-col gap-5">
      {hasProvenance && (
        <section className="flex max-w-[1280px] flex-col gap-2.5">
          <span className={SECTION_LABEL}>{provenanceLabel}</span>
          {links.map(link => (
            <div
              key={`${link.label}:${link.value}`}
              className="group flex w-full items-baseline gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-3 py-2 text-left transition-colors hover:border-[var(--border-strong)]"
            >
              <span className="shrink-0 text-[10px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase">
                {link.label}
              </span>
              <Link
                href={link.href}
                className="[overflow-wrap:anywhere] font-mono text-[12.5px] text-[var(--accent)] hover:text-[var(--accent-hover)]"
              >
                {link.value}
              </Link>
            </div>
          ))}
          {ids.length > 0 && (
            <div className="-ml-1.5 flex flex-wrap items-center gap-x-1 gap-y-1">
              {ids.map(id => (
                <IdChip
                  key={id.label}
                  label={id.label}
                  value={id.value}
                  display={id.display}
                  copied={copied}
                  onCopy={copy}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {payloads.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <span className={SECTION_LABEL}>{payloadsLabel}</span>
          <div className="grid grid-cols-2 items-start gap-4 max-lg:grid-cols-1">
            {payloads.map(payload => (
              <CodePane
                key={payload.label}
                label={payload.label}
                value={prettyJson(payload.value)}
                language="json"
                badge="json"
                collapsible
                defaultOpen={payload.defaultOpen ?? false}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
