export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <pre data-testid="viewer-code-block" data-language={lang}>
      <code>{code}</code>
    </pre>
  )
}
