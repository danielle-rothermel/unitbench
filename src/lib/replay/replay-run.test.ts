import { describe, expect, it } from 'vitest'
import { parseGraphSpec } from '@/lib/graph-spec'
import { getReplayRun, listReplayRuns } from '@/lib/replay/replay-data'
import { compareRuns } from '@/lib/replay/replay-run'

describe('replay fixtures', () => {
  it('provides two runs sharing a graph digest with valid snapshots', () => {
    const runs = listReplayRuns()
    expect(runs).toHaveLength(2)
    expect(new Set(runs.map(run => run.graph_digest)).size).toBe(1)
    for (const run of runs) {
      const parsed = parseGraphSpec(JSON.stringify(run.graph_snapshot))
      expect(parsed.ok, run.generation_run_id).toBe(true)
      expect(run.node_attempts.length).toBeGreaterThan(0)
    }
  })

  it('looks up runs by id', () => {
    expect(getReplayRun('fixture-run-passed')?.status).toBe('completed')
    expect(getReplayRun('missing')).toBeNull()
  })
})

describe('compareRuns', () => {
  it('diffs the latest attempts per node and flags differing outputs', () => {
    const [passed, failed] = listReplayRuns()
    const comparison = compareRuns(passed, failed)

    const encoder = comparison.find(entry => entry.nodeId === 'encoder')
    expect(encoder?.differs).toBe(true)
    expect(encoder?.differingKeys).toEqual(['description'])

    const decoder = comparison.find(entry => entry.nodeId === 'decoder')
    expect(decoder?.differs).toBe(true)
    expect(decoder?.differingKeys).toEqual(['code'])
    // Latest decoder attempt on the failed run is the retry (index 1).
    expect(decoder?.rightAttempt?.attempt_index).toBe(1)
  })

  it('refuses to compare runs with different digests', () => {
    const [passed, failed] = listReplayRuns()
    const foreign = { ...failed, graph_digest: 'other' }
    expect(() => compareRuns(passed, foreign)).toThrow('graph digest')
  })
})
