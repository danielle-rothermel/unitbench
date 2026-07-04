'use client'

import { useState, type ChangeEvent } from 'react'
import { Inspector } from '@/components/inspector/Inspector'
import { ErrorSection } from '@/components/panels/ErrorSection'
import { SECTION_LABEL, Tag } from '@/components/primitives'
import directGraph from '@/lib/design/fixtures/direct-graph.json'
import encdecGraph from '@/lib/design/fixtures/encdec-graph.json'
import {
  layoutGraphSpec,
  parseGraphSpec,
  type GraphLayout,
  type GraphSpec,
} from '@/lib/graph-spec'

const NODE_WIDTH = 210
const NODE_HEIGHT = 92
const COLUMN_GAP = 120
const ROW_GAP = 44
const CANVAS_PAD = 24

const SAMPLES = [
  { label: 'Direct sample', spec: directGraph },
  { label: 'Enc-dec sample', spec: encdecGraph },
]

type Rendered = {
  spec: GraphSpec
  layout: GraphLayout
}

function nodeX(depth: number): number {
  return CANVAS_PAD + depth * (NODE_WIDTH + COLUMN_GAP)
}

function nodeY(row: number): number {
  return CANVAS_PAD + row * (NODE_HEIGHT + ROW_GAP)
}

function edgePath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): string {
  const bend = (toX - fromX) / 2
  return `M ${fromX} ${fromY} C ${fromX + bend} ${fromY}, ${toX - bend} ${toY}, ${toX} ${toY}`
}

function GraphCanvas({
  rendered,
  selectedNodeId,
  onSelectNode,
}: {
  rendered: Rendered
  selectedNodeId: string | null
  onSelectNode: (nodeId: string) => void
}) {
  const { layout } = rendered
  const externalRows = new Map(
    layout.externalNamespaces.map((namespace, index) => [namespace, index]),
  )
  const nodePositions = new Map(
    layout.nodes.map(node => [
      node.id,
      { x: nodeX(node.depth), y: nodeY(node.row) },
    ]),
  )
  const rowCount = Math.max(
    layout.externalNamespaces.length,
    ...Array.from(
      layout.nodes.reduce((rows, node) => {
        rows.set(node.depth, (rows.get(node.depth) ?? 0) + 1)
        return rows
      }, new Map<number, number>()),
      ([, count]) => count,
    ),
    1,
  )
  const width = nodeX(layout.maxDepth) + NODE_WIDTH + CANVAS_PAD
  const height = nodeY(rowCount - 1) + NODE_HEIGHT + CANVAS_PAD

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Graph spec DAG"
        data-testid="graph-canvas"
      >
        <defs>
          <marker
            id="graph-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--border-strong)" />
          </marker>
        </defs>

        {layout.edges.map(edge => {
          const target = nodePositions.get(edge.targetNodeId)
          if (!target) return null
          const from =
            edge.source.kind === 'node'
              ? nodePositions.get(edge.source.nodeId)
              : {
                  x: nodeX(0),
                  y: nodeY(externalRows.get(edge.source.namespace) ?? 0),
                }
          if (!from) return null
          const key = `${edge.source.kind === 'node' ? edge.source.nodeId : edge.source.namespace}->${edge.targetNodeId}.${edge.targetInput}`
          const fromX = from.x + NODE_WIDTH
          const fromY = from.y + NODE_HEIGHT / 2
          const toX = target.x
          const toY = target.y + NODE_HEIGHT / 2
          return (
            <g key={key}>
              <path
                d={edgePath(fromX, fromY, toX, toY)}
                fill="none"
                stroke="var(--border-strong)"
                strokeWidth={1.5}
                markerEnd="url(#graph-arrow)"
              />
              <text
                x={(fromX + toX) / 2}
                y={(fromY + toY) / 2 - 6}
                textAnchor="middle"
                fontSize={10}
                fontFamily="var(--font-mono)"
                fill="var(--text-muted)"
              >
                {edge.source.field ?? ''} → {edge.targetInput}
              </text>
            </g>
          )
        })}

        {layout.externalNamespaces.map(namespace => {
          const y = nodeY(externalRows.get(namespace) ?? 0)
          return (
            <g key={namespace} data-testid="graph-external">
              <rect
                x={nodeX(0)}
                y={y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={10}
                fill="var(--bg-tertiary)"
                stroke="var(--border)"
                strokeDasharray="5 4"
              />
              <text
                x={nodeX(0) + NODE_WIDTH / 2}
                y={y + NODE_HEIGHT / 2 - 6}
                textAnchor="middle"
                fontSize={13}
                fontFamily="var(--font-mono)"
                fill="var(--text-secondary)"
              >
                {namespace}
              </text>
              <text
                x={nodeX(0) + NODE_WIDTH / 2}
                y={y + NODE_HEIGHT / 2 + 12}
                textAnchor="middle"
                fontSize={10}
                fill="var(--text-muted)"
              >
                external inputs
              </text>
            </g>
          )
        })}

        {layout.nodes.map(node => {
          const position = nodePositions.get(node.id)
          if (!position) return null
          const isSelected = node.id === selectedNodeId
          return (
            <g
              key={node.id}
              data-testid="graph-node"
              onClick={() => onSelectNode(node.id)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={position.x}
                y={position.y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={10}
                fill={node.isTerminal ? 'var(--accent-bg)' : 'var(--bg-secondary)'}
                stroke={
                  isSelected
                    ? 'var(--accent)'
                    : node.isTerminal
                      ? 'var(--accent)'
                      : 'var(--border-strong)'
                }
                strokeWidth={isSelected ? 2.5 : node.isTerminal ? 2 : 1.5}
              />
              <text
                x={position.x + 14}
                y={position.y + 26}
                fontSize={14}
                fontWeight={600}
                fontFamily="var(--font-mono)"
                fill="var(--text-primary)"
              >
                {node.id}
              </text>
              <text
                x={position.x + 14}
                y={position.y + 46}
                fontSize={11}
                fontFamily="var(--font-mono)"
                fill="var(--text-muted)"
              >
                op: {node.op}
              </text>
              <text
                x={position.x + 14}
                y={position.y + 64}
                fontSize={11}
                fontFamily="var(--font-mono)"
                fill="var(--text-secondary)"
              >
                {node.inputs.join(', ')} → {node.outputField}
              </text>
              {node.isTerminal && (
                <text
                  x={position.x + 14}
                  y={position.y + 82}
                  fontSize={10}
                  fontWeight={600}
                  fill="var(--accent)"
                >
                  TERMINAL
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function GraphViewer() {
  const [text, setText] = useState('')
  const [rendered, setRendered] = useState<Rendered | null>(null)
  const [errors, setErrors] = useState<string[] | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const renderSpec = (specText: string) => {
    const result = parseGraphSpec(specText)
    if (!result.ok) {
      setRendered(null)
      setErrors(result.errors)
      return
    }
    setErrors(null)
    setSelectedNodeId(null)
    setRendered({ spec: result.spec, layout: layoutGraphSpec(result.spec) })
  }

  const loadSample = (spec: unknown) => {
    const specText = JSON.stringify(spec, null, 2)
    setText(specText)
    renderSpec(specText)
  }

  const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const contents = await file.text()
    setText(contents)
    renderSpec(contents)
  }

  const selectedNode =
    rendered?.spec.nodes.find(node => node.id === selectedNodeId) ?? null

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={SECTION_LABEL}>GraphSpec JSON</span>
          <textarea
            value={text}
            onChange={event => setText(event.target.value)}
            rows={8}
            placeholder="Paste a GraphSpec JSON document…"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-code)] p-4 font-mono text-[12.5px] leading-relaxed text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            data-testid="graph-input"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {SAMPLES.map(sample => (
            <button
              key={sample.label}
              type="button"
              onClick={() => loadSample(sample.spec)}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            >
              {sample.label}
            </button>
          ))}
          <label className="cursor-pointer rounded-md border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
            Upload JSON…
            <input
              type="file"
              accept="application/json,.json"
              onChange={onUpload}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={() => renderSpec(text)}
            disabled={text.trim().length === 0}
            className="ml-auto rounded-md bg-[var(--accent)] px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Render
          </button>
        </div>
      </section>

      {errors && (
        <ErrorSection
          tone="warning"
          title="Spec does not validate against the GraphSpec schema"
          message={errors.join(' · ')}
        />
      )}

      {rendered && (
        <div className="flex flex-col gap-5" data-testid="graph-rendered">
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="accent" mono>
              terminal: {rendered.spec.terminal_node_id}
            </Tag>
            <Tag mono>{rendered.spec.nodes.length} nodes</Tag>
            {rendered.layout.externalNamespaces.map(namespace => (
              <Tag key={namespace} mono>
                external: {namespace}
              </Tag>
            ))}
          </div>
          <GraphCanvas
            rendered={rendered}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
          {selectedNode && (
            <Inspector
              payloadsLabel={`Node ${selectedNode.id}`}
              payloads={[
                {
                  label: selectedNode.id,
                  value: selectedNode,
                  defaultOpen: true,
                },
              ]}
            />
          )}
        </div>
      )}
    </div>
  )
}
