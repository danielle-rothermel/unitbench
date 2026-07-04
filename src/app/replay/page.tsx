import { Tag } from '@/components/primitives'
import { listReplayRuns } from '@/lib/replay/replay-data'
import { ReplayViewer } from './ReplayViewer'

export default function ReplayPage() {
  const runs = listReplayRuns()
  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <Tag>fixture runs</Tag>
          <Tag mono>graph_digest {runs[0]?.graph_digest}</Tag>
        </div>
        <h1 className="font-display text-[30px] leading-tight font-bold text-[var(--text-primary)]">
          Replay viewer
        </h1>
        <p className="mt-1.5 max-w-[72ch] text-[15px] text-[var(--text-secondary)]">
          Step through one generation run node attempt by node attempt, with
          resolved inputs and outputs in the inspector — or compare two runs
          that share a graph digest side by side. Fixture-driven until the
          replay projection publishes real node attempts.
        </p>
      </header>
      <ReplayViewer runs={runs} />
    </div>
  )
}
