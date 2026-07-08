export type ExtractionTrace = {
  rationale?: string
}

export function CodeBlock({ code }: { code: string }) {
  return (
    <pre data-testid="viewer-code-block">
      <code>{code}</code>
    </pre>
  )
}

export function ExtractionTraceView({
  trace,
}: {
  trace: ExtractionTrace
}) {
  return (
    <section data-testid="viewer-extraction-trace">
      {trace.rationale ?? 'trace'}
    </section>
  )
}
