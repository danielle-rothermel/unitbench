import { Tag } from '@/components/primitives'
import { GraphViewer } from './GraphViewer'

export default function GraphViewerPage() {
  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <Tag>dr-graph GraphSpec</Tag>
          <Tag tone="blue">pure frontend</Tag>
        </div>
        <h1 className="font-display text-[30px] leading-tight font-bold text-[var(--text-primary)]">
          Graph viewer
        </h1>
        <p className="mt-1.5 max-w-[72ch] text-[15px] text-[var(--text-secondary)]">
          Paste or upload a GraphSpec JSON document, validate it against the
          dr-graph schema, and see the DAG: nodes, input bindings, external
          inputs, and the terminal node. Click a node to inspect its full
          spec.
        </p>
      </header>
      <GraphViewer />
    </div>
  )
}
