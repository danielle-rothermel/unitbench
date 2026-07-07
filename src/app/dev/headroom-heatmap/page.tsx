import Link from 'next/link'
import { HeadroomHeatmap } from '@/components/headroom/HeadroomHeatmap'
import { makeHeadroomPoints, type HeadroomPoint } from '@/fixtures/heatmap'
import { FIXTURE_MODELS, fixtureTaskIds } from '@/fixtures/primitives'
import { createRng, floatBetween, round } from '@/fixtures/rng'
import type { SearchParamsRecord } from '@/lib/aggregate-filters'
import { cn } from '@/lib/cn'
import {
  headroomHeatmapHref,
  parseHeadroomHeatmapState,
} from '@/lib/headroom-heatmap-params'

const SEED_LINKS = [1, 21, 99]
const DIRECT_BASELINE_TASK_COUNT = 6
const DIRECT_BASELINE_SAMPLES = 3
/** Offsets the encdec fixture's RNG stream so baselines do not mirror it. */
const DIRECT_BASELINE_SEED_OFFSET = 7919

/**
 * Deterministic direct-baseline points (Shape 6's null-target case): the
 * fixture generator only emits encdec points, so the demo hand-rolls a few
 * direct runs clustering near ratio 1.0 with high pass rates.
 */
function makeDirectBaselinePoints(seed: number): HeadroomPoint[] {
  const rng = createRng(seed + DIRECT_BASELINE_SEED_OFFSET)
  const points: HeadroomPoint[] = []
  for (const model of FIXTURE_MODELS) {
    for (const task_id of fixtureTaskIds(DIRECT_BASELINE_TASK_COUNT)) {
      points.push({
        model,
        task_id,
        experiment_kind: 'humaneval_direct',
        target_compression_ratio: null,
        achieved_compression_ratio: round(floatBetween(rng, 0.9, 1.15), 4),
        mean_pass_rate: round(floatBetween(rng, 0.5, 1), 4),
        n_samples: DIRECT_BASELINE_SAMPLES,
      })
    }
  }
  return points
}

type PageProps = {
  searchParams: Promise<SearchParamsRecord>
}

export default async function Page({ searchParams }: PageProps) {
  const state = parseHeadroomHeatmapState(await searchParams)
  const points = [
    ...makeHeadroomPoints({ seed: state.seed }),
    ...makeDirectBaselinePoints(state.seed),
  ]

  return (
    <div className="w-full">
      <header className="mb-6 max-w-[980px]">
        <h1 className="font-display text-[28px] leading-tight font-bold text-[var(--text-primary)]">
          Headroom heatmap (dev)
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          X = achieved-compression-ratio bins, Y = per-task mean-pass-rate bins, color =
          task count per cell. Drag facet headers to reorder panels; the layout persists
          in the URL, so the link is shareable.
        </p>
        <p className="mt-2 flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
          <span>Seed:</span>
          {SEED_LINKS.map(seed => (
            <Link
              key={seed}
              href={headroomHeatmapHref({ ...state, seed })}
              className={cn(
                'font-mono font-medium',
                seed === state.seed
                  ? 'text-[var(--text-primary)] underline underline-offset-2'
                  : 'text-[var(--accent)] hover:text-[var(--accent-hover)]',
              )}
            >
              {seed}
            </Link>
          ))}
        </p>
      </header>

      <HeadroomHeatmap points={points} state={state} />

      <p className="mt-6 text-[11px] text-[var(--text-muted)]">
        Fake data: makeHeadroomPoints fixture output plus a few hand-rolled direct
        baseline points (null target, near ratio 1.0).
      </p>
    </div>
  )
}
