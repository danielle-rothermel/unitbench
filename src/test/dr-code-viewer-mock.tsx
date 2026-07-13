export type ExtractionTrace = {
  rationale?: string
}

export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <pre data-testid="viewer-code-block" data-language={lang}>
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
