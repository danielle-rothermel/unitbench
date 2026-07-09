/**
 * Replay data access — the isolation seam for the replay projection.
 * Neon publishes no `node_attempts`/`graph_snapshot` today (verified
 * 2026-07-04; see docs/workbench/projections.md), so runs come from
 * committed fixtures. When `replay_runs`/`replay_node_attempts` land,
 * only this module changes.
 */

import runFailed from '@/lib/replay/fixtures/run-failed.json'
import runPassed from '@/lib/replay/fixtures/run-passed.json'
import type { ReplayRun } from '@/lib/replay/replay-run'

// JSON imports infer literal unions that fight the Record index
// signature; the replay-run unit test validates the fixtures against
// parseGraphSpec, which is what this cast waives statically.
const FIXTURE_RUNS = [runPassed, runFailed] as unknown as ReplayRun[]

export function listReplayRuns(): ReplayRun[] {
  return FIXTURE_RUNS
}

export function getReplayRun(generationRunId: string): ReplayRun | null {
  return (
    FIXTURE_RUNS.find(run => run.generation_run_id === generationRunId) ?? null
  )
}
