import { describe, expect, it } from 'vitest'
import directGraph from '@/lib/design/fixtures/direct-graph.json'
import encdecGraph from '@/lib/design/fixtures/encdec-graph.json'
import { layoutGraphSpec, parseGraphSpec } from '@/lib/graph-spec'

describe('parseGraphSpec', () => {
  it('accepts both repo fixture specs', () => {
    for (const fixture of [directGraph, encdecGraph]) {
      const result = parseGraphSpec(JSON.stringify(fixture))
      expect(result.ok, JSON.stringify(result)).toBe(true)
    }
  })

  it('rejects invalid JSON with a parse error', () => {
    const result = parseGraphSpec('{not json')
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) {
      expect(result.errors[0]).toContain('not valid JSON')
    }
  })

  it('rejects specs missing required fields with a schema pointer', () => {
    const result = parseGraphSpec(JSON.stringify({ nodes: [] }))
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('terminal_node_id')
    }
  })

  it('rejects a terminal_node_id that is not a node', () => {
    const spec = { ...directGraph, terminal_node_id: 'missing' }
    const result = parseGraphSpec(JSON.stringify(spec))
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) {
      expect(result.errors[0]).toContain('missing')
    }
  })
})

describe('layoutGraphSpec', () => {
  it('layers the enc-dec graph with encoder before decoder', () => {
    const parsed = parseGraphSpec(JSON.stringify(encdecGraph))
    if (!parsed.ok) throw new Error('fixture must parse')
    const layout = layoutGraphSpec(parsed.spec)

    const encoder = layout.nodes.find(node => node.id === 'encoder')
    const decoder = layout.nodes.find(node => node.id === 'decoder')
    expect(encoder?.depth).toBe(1)
    expect(decoder?.depth).toBe(2)
    expect(decoder?.isTerminal).toBe(true)
    expect(layout.externalNamespaces).toEqual(['task'])

    const crossEdge = layout.edges.find(
      edge => edge.source.kind === 'node' && edge.targetNodeId === 'decoder',
    )
    expect(crossEdge?.source).toEqual({
      kind: 'node',
      nodeId: 'encoder',
      field: 'description',
    })
  })

  it('lays out the direct graph as one terminal node fed by task', () => {
    const parsed = parseGraphSpec(JSON.stringify(directGraph))
    if (!parsed.ok) throw new Error('fixture must parse')
    const layout = layoutGraphSpec(parsed.spec)

    expect(layout.nodes).toHaveLength(1)
    expect(layout.nodes[0]).toMatchObject({
      id: 'direct',
      isTerminal: true,
      depth: 1,
    })
    expect(layout.edges).toHaveLength(1)
    expect(layout.edges[0]?.source.kind).toBe('external')
  })
})
