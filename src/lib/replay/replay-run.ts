/**
 * Replay-run types and helpers. Shapes mirror the replay projection
 * sketched in docs/workbench/projections.md (`replay_runs` +
 * `replay_node_attempts`); today the data source is committed
 * fixtures (Neon publishes no node_attempts yet), isolated behind
 * `replay-data.ts` so the projection can swap in.
 */

import type { GraphSpec } from '@/lib/graph-spec'

export type ReplayNodeAttempt = {
  node_id: string
  attempt_index: number
  status: 'completed' | 'failed'
  input_bindings_resolved: Record<string, unknown>
  output: Record<string, unknown> | null
  error: Record<string, unknown> | null
}

export type ReplayRun = {
  generation_run_id: string
  prediction_id: string
  graph_digest: string
  status: 'completed' | 'failed'
  graph_snapshot: GraphSpec
  node_attempts: ReplayNodeAttempt[]
}

export type NodeComparison = {
  nodeId: string
  leftAttempt: ReplayNodeAttempt | null
  rightAttempt: ReplayNodeAttempt | null
  differs: boolean
  differingKeys: string[]
}

function attemptForNode(
  run: ReplayRun,
  nodeId: string,
): ReplayNodeAttempt | null {
  const attempts = run.node_attempts.filter(
    attempt => attempt.node_id === nodeId,
  )
  if (attempts.length === 0) return null
  return attempts.reduce((latest, attempt) =>
    attempt.attempt_index > latest.attempt_index ? attempt : latest,
  )
}

function differingOutputKeys(
  left: ReplayNodeAttempt | null,
  right: ReplayNodeAttempt | null,
): string[] {
  const leftOutput = left?.output ?? {}
  const rightOutput = right?.output ?? {}
  const keys = new Set([
    ...Object.keys(leftOutput),
    ...Object.keys(rightOutput),
  ])
  return [...keys]
    .filter(
      key =>
        JSON.stringify(leftOutput[key]) !== JSON.stringify(rightOutput[key]),
    )
    .sort()
}

/**
 * Per-node side-by-side comparison of two runs sharing a graph digest.
 * Nodes are ordered by each run's attempt order (they share a graph).
 */
export function compareRuns(
  left: ReplayRun,
  right: ReplayRun,
): NodeComparison[] {
  if (left.graph_digest !== right.graph_digest) {
    throw new Error(
      `runs do not share a graph digest: ${left.graph_digest} vs ${right.graph_digest}`,
    )
  }
  const nodeOrder: string[] = []
  for (const attempt of [...left.node_attempts, ...right.node_attempts]) {
    if (!nodeOrder.includes(attempt.node_id)) nodeOrder.push(attempt.node_id)
  }
  return nodeOrder.map(nodeId => {
    const leftAttempt = attemptForNode(left, nodeId)
    const rightAttempt = attemptForNode(right, nodeId)
    const differingKeys = differingOutputKeys(leftAttempt, rightAttempt)
    const statusDiffers = leftAttempt?.status !== rightAttempt?.status
    return {
      nodeId,
      leftAttempt,
      rightAttempt,
      differs: differingKeys.length > 0 || statusDiffers,
      differingKeys,
    }
  })
}
