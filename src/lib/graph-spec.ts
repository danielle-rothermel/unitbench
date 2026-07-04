import { Ajv2020, type ErrorObject } from 'ajv/dist/2020'
import graphSpecSchema from '@/lib/api/graph-spec-schema.json'

const EXTERNAL_NAMESPACE = 'task'
const REF_SEPARATOR = '.'

export type GraphFieldSpec = {
  name: string
  role: string
  type_name: string
  description?: string | null
}

export type GraphBindingRef = {
  source: string
  field?: string | null
  node_id?: string | null
  namespace?: string | null
}

export type GraphNodeSpec = {
  id: string
  op: string
  config: {
    fields: GraphFieldSpec[]
    input_bindings: Record<string, string | GraphBindingRef>
    metadata: Record<string, unknown>
    output_field: string
    parameters: Record<string, unknown>
  }
}

export type GraphSpec = {
  nodes: GraphNodeSpec[]
  terminal_node_id: string
}

export type GraphSpecParseResult =
  | { ok: true; spec: GraphSpec }
  | { ok: false; errors: string[] }

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validateGraphSpec = ajv.compile<GraphSpec>(graphSpecSchema)

function formatSchemaError(error: ErrorObject): string {
  const where = error.instancePath || '(root)'
  return `${where} ${error.message ?? 'is invalid'}`
}

export function parseGraphSpec(text: string): GraphSpecParseResult {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, errors: [`not valid JSON: ${message}`] }
  }
  if (!validateGraphSpec(value)) {
    const errors = (validateGraphSpec.errors ?? []).map(formatSchemaError)
    return {
      ok: false,
      errors: errors.length > 0 ? errors : ['does not match GraphSpec schema'],
    }
  }
  const spec = value as GraphSpec
  const nodeIds = new Set(spec.nodes.map(node => node.id))
  if (!nodeIds.has(spec.terminal_node_id)) {
    return {
      ok: false,
      errors: [
        `terminal_node_id ${JSON.stringify(spec.terminal_node_id)} is not a node id`,
      ],
    }
  }
  return { ok: true, spec }
}

export type GraphEdgeSource =
  | { kind: 'node'; nodeId: string; field: string | null }
  | { kind: 'external'; namespace: string; field: string | null }

export type GraphEdge = {
  source: GraphEdgeSource
  targetNodeId: string
  targetInput: string
}

export type GraphLayoutNode = {
  id: string
  op: string
  outputField: string
  inputs: string[]
  isTerminal: boolean
  depth: number
  row: number
}

export type GraphLayout = {
  nodes: GraphLayoutNode[]
  edges: GraphEdge[]
  externalNamespaces: string[]
  maxDepth: number
}

function bindingSource(
  binding: string | GraphBindingRef,
  nodeIds: Set<string>,
): GraphEdgeSource {
  if (typeof binding !== 'string') {
    if (binding.node_id) {
      return { kind: 'node', nodeId: binding.node_id, field: binding.field ?? null }
    }
    return {
      kind: 'external',
      namespace: binding.namespace ?? EXTERNAL_NAMESPACE,
      field: binding.field ?? null,
    }
  }
  const separatorIndex = binding.indexOf(REF_SEPARATOR)
  if (separatorIndex === -1) {
    return { kind: 'node', nodeId: binding, field: null }
  }
  const head = binding.slice(0, separatorIndex)
  const tail = binding.slice(separatorIndex + 1)
  if (nodeIds.has(head)) {
    return { kind: 'node', nodeId: head, field: tail }
  }
  return { kind: 'external', namespace: head, field: tail }
}

export function layoutGraphSpec(spec: GraphSpec): GraphLayout {
  const nodeIds = new Set(spec.nodes.map(node => node.id))
  const edges: GraphEdge[] = []
  const externals = new Set<string>()

  for (const node of spec.nodes) {
    for (const [input, binding] of Object.entries(node.config.input_bindings)) {
      const source = bindingSource(binding, nodeIds)
      if (source.kind === 'external') externals.add(source.namespace)
      edges.push({ source, targetNodeId: node.id, targetInput: input })
    }
  }

  // Nodes are laid out in dependency layers: externals at depth 0, each
  // node one past its deepest upstream node. Graphs are validated DAGs;
  // the pass count bound guards against pathological input.
  const depths = new Map<string, number>(
    spec.nodes.map(node => [node.id, 1]),
  )
  for (let pass = 0; pass < spec.nodes.length; pass += 1) {
    let changed = false
    for (const edge of edges) {
      if (edge.source.kind !== 'node') continue
      const sourceDepth = depths.get(edge.source.nodeId)
      const targetDepth = depths.get(edge.targetNodeId)
      if (sourceDepth === undefined || targetDepth === undefined) continue
      if (targetDepth < sourceDepth + 1) {
        depths.set(edge.targetNodeId, sourceDepth + 1)
        changed = true
      }
    }
    if (!changed) break
  }

  const rowsPerDepth = new Map<number, number>()
  const nodes: GraphLayoutNode[] = spec.nodes
    .slice()
    .sort((a, b) => (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0))
    .map(node => {
      const depth = depths.get(node.id) ?? 1
      const row = rowsPerDepth.get(depth) ?? 0
      rowsPerDepth.set(depth, row + 1)
      return {
        id: node.id,
        op: node.op,
        outputField: node.config.output_field,
        inputs: Object.keys(node.config.input_bindings),
        isTerminal: node.id === spec.terminal_node_id,
        depth,
        row,
      }
    })

  return {
    nodes,
    edges,
    externalNamespaces: [...externals].sort(),
    maxDepth: Math.max(0, ...nodes.map(node => node.depth)),
  }
}
