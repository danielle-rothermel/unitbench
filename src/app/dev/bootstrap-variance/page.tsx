import Link from 'next/link'
import { AggregatePageShell } from '@/components/AggregatePageShell'
import { BootstrapVariancePanel } from '@/components/bootstrap/BootstrapVariancePanel'
import { makeBootstrapSampleRows, type BootstrapSampleRow } from '@/fixtures/bootstrap'
import { cn } from '@/lib/cn'

export const dynamic = 'force-dynamic'

const SCENARIOS = ['default', 'high-rep', 'degenerate', 'empty'] as const
type Scenario = (typeof SCENARIOS)[number]

const DEFAULT_SCENARIO: Scenario = 'default'
const DEFAULT_FIXTURE_SEED = 1
const HIGH_REP_SAMPLES_PER_TASK = 20

const SCENARIO_DESCRIPTIONS: Record<Scenario, string> = {
  default: '4 models × 24 tasks × 3 samples',
  'high-rep': '20 samples/task — depth for the N ladder',
  degenerate: 'default + handcrafted all-pass / all-fail / single-sample / empty-group rows',
  empty: 'no rows — exercises the empty state',
}

function isScenario(value: string): value is Scenario {
  return (SCENARIOS as readonly string[]).includes(value)
}

function parseScenario(value: string | string[] | undefined): Scenario {
  return typeof value === 'string' && isScenario(value) ? value : DEFAULT_SCENARIO
}

function parseSeed(value: string | string[] | undefined): number {
  if (typeof value !== 'string') return DEFAULT_FIXTURE_SEED
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : DEFAULT_FIXTURE_SEED
}

const HANDCRAFTED_EXPERIMENT_ID = 'dr-dspy-v1/encdec/degenerate-handcrafted'
/** Task ids outside the generated range so the handcrafted groups stand alone. */
const ALL_PASS_TASK = 'HumanEval/900'
const ALL_FAIL_TASK = 'HumanEval/901'
const SINGLE_SAMPLE_TASK = 'HumanEval/902'
const EDGE_MODEL = 'handcrafted/edge-model'
/** Has rows only for ALL_PASS_TASK — its other combos are empty model×task groups. */
const SPARSE_MODEL = 'handcrafted/sparse-model'

function handcraftedRow(
  model: string,
  task_id: string,
  sample_index: number,
  passed: boolean,
): BootstrapSampleRow {
  return {
    experiment_id: HANDCRAFTED_EXPERIMENT_ID,
    experiment_kind: 'humaneval_encdec',
    model,
    task_id,
    sample_index,
    passed,
    score: passed ? 1.0 : 0.0,
  }
}

const DEGENERATE_ROWS: BootstrapSampleRow[] = [
  handcraftedRow(EDGE_MODEL, ALL_PASS_TASK, 0, true),
  handcraftedRow(EDGE_MODEL, ALL_PASS_TASK, 1, true),
  handcraftedRow(EDGE_MODEL, ALL_PASS_TASK, 2, true),
  handcraftedRow(EDGE_MODEL, ALL_FAIL_TASK, 0, false),
  handcraftedRow(EDGE_MODEL, ALL_FAIL_TASK, 1, false),
  handcraftedRow(EDGE_MODEL, ALL_FAIL_TASK, 2, false),
  handcraftedRow(EDGE_MODEL, SINGLE_SAMPLE_TASK, 0, true),
  handcraftedRow(SPARSE_MODEL, ALL_PASS_TASK, 0, true),
  handcraftedRow(SPARSE_MODEL, ALL_PASS_TASK, 1, false),
]

function rowsForScenario(scenario: Scenario, seed: number): BootstrapSampleRow[] {
  switch (scenario) {
    case 'default':
      return makeBootstrapSampleRows({ seed })
    case 'high-rep':
      return makeBootstrapSampleRows({ seed, samplesPerTask: HIGH_REP_SAMPLES_PER_TASK })
    case 'degenerate':
      return [...makeBootstrapSampleRows({ seed }), ...DEGENERATE_ROWS]
    case 'empty':
      return []
  }
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function Page({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams
  const scenario = parseScenario(resolvedSearchParams.scenario)
  const seed = parseSeed(resolvedSearchParams.seed)
  const rows = rowsForScenario(scenario, seed)

  return (
    <AggregatePageShell
      title="Bootstrap variance + confidence bounds (dev)"
      description="Seeded percentile-bootstrap CIs on pass-rate estimates over fixture data. Pick a grouping, then use the N slider and the CI-width-vs-N view to judge how many repetitions the real sweep needs. Same seed always reproduces the exact same chart."
    >
      <div className="mb-5 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-[var(--text-muted)]">Scenario:</span>
        {SCENARIOS.map(option => (
          <Link
            key={option}
            href={`/dev/bootstrap-variance?scenario=${option}&seed=${seed}`}
            title={SCENARIO_DESCRIPTIONS[option]}
            className={cn(
              'rounded-md border px-2.5 py-1 font-mono text-[12px]',
              option === scenario
                ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]'
                : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
            )}
          >
            {option}
          </Link>
        ))}
        <span className="ml-2 text-[var(--text-muted)]">
          fixture seed {seed} (set ?seed=&lt;int&gt;)
        </span>
      </div>
      <BootstrapVariancePanel rows={rows} />
    </AggregatePageShell>
  )
}
