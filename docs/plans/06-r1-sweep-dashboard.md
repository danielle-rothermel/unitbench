# R1 — Core sweep-metrics dashboard (REL-2)

Status: PLAN — implementation follows this document.

Purpose: answer "are any tasks or models broken?" and support choosing the first-eval
model subset. All plots render from the frozen `SweepMetricsRow` fixture
(`src/fixtures/sweep.ts`); the fixture contract is authoritative and is not modified
by this work. The D3 real-data swap replaces only the demo page's data source (fixture
generator → SQL rows), because every prop is typed as the fixture row.

---

## 1. Data flow and slicing model

`SweepMetricsRow` is a grouped aggregate, not per-sample data. Slicing therefore never
re-aggregates on the client — it selects which pre-grouped rows feed each chart:

| Slice state          | Per-model charts read…                              | Per-task charts read…                               |
| -------------------- | --------------------------------------------------- | --------------------------------------------------- |
| none (default)       | `perModel` rows (`groupBy: ['model']`)              | `perTask` rows (`groupBy: ['task_id']`)             |
| task `T` selected    | `perModelTask` rows filtered to `task_id === T`     | `perTask` rows (highlight `T`)                      |
| model `M` selected   | `perModel` rows (highlight `M`)                     | `perModelTask` rows filtered to `model === M`       |

This is exactly how the real SQL will work (`GROUP BY model`, `GROUP BY task_id`,
`GROUP BY model, task_id` — the same `MEASURE_EXPRESSIONS` family as
`src/lib/aggregate-data.ts:130-136`), so no measure is ever recomputed client-side.

Slice state is component-local `useState` inside `SweepDashboard` (two `<select>`
controls: model, task). URL persistence à la `heatmap-params.ts` is deliberately out of
scope for R1 — see morning notes.

## 2. Component API

Everything consumed from `@/fixtures` (all frozen, no changes):

- `SweepMetricsRow` — the row type; every chart prop is `SweepMetricsRow[]`.
- `SweepGroupKey` / `SWEEP_GROUP_KEYS` — source of the slice-key subtype.
- `makeSweepMetricsRows`, `SweepFixtureOptions` — demo page + tests only.
- (Indirectly) `ExperimentKind` via `SweepMetricsRow.experiment_kind`.

```ts
import type { SweepMetricsRow, SweepGroupKey } from '@/fixtures'

/** The two keys the dashboard slices by; derived from the fixture's group keys. */
export type SweepSliceKey = Extract<SweepGroupKey, 'model' | 'task_id'>

/** Shared shape for every per-group chart. */
type SweepChartProps = {
  rows: SweepMetricsRow[]      // one grouping (per-model, per-task, or a filtered
                               // slice of per-model×task rows)
  groupKey: SweepSliceKey      // which nullable group key labels each row
  title: string                // section header, story-style ("Where errors cluster")
  highlightValue?: string | null  // group value to emphasize (the current slice)
}
```

Components (all in `src/components/sweep/`):

```ts
// Composes everything; owns slice state. Client component ('use client').
type SweepDashboardProps = {
  perModel: SweepMetricsRow[]       // makeSweepMetricsRows({ groupBy: ['model'] })
  perTask: SweepMetricsRow[]        // makeSweepMetricsRows({ groupBy: ['task_id'] })
  perModelTask: SweepMetricsRow[]   // makeSweepMetricsRows({ groupBy: ['model', 'task_id'] })
}
export function SweepDashboard(props: SweepDashboardProps)

// KPI strip: total n, overall pass rate, total cost, error count, rate-limit count.
// Sums counts / total_cost across the given rows (counts are additive; no avg math).
type SweepSummaryStripProps = { rows: SweepMetricsRow[] }
export function SweepSummaryStrip(props: SweepSummaryStripProps)

// Rate-limit / API-error counts per group. One horizontal bar per row:
// error_count outer bar with rate_limit_count inner segment, pending_count
// as a second thin bar. Sorted desc by error_count.
export function ErrorRateChart(props: SweepChartProps)

// Latency per group: dumbbell/range bar from avg_latency_ms to p95_latency_ms
// with dots at both ends, shared x-scale across rows.
export function LatencyRangeChart(props: SweepChartProps)

// avg_cost per group as horizontal bars; total_cost + n in the row detail text.
export function CostBarChart(props: SweepChartProps)

// Perf mean + variance per group: avg_score bar on a fixed [0, 1] domain with a
// ±stddev_score whisker overlay; n annotated per row. Used twice (model + task).
export function PerfMeanVarianceChart(props: SweepChartProps)

// Distribution 1 — outcome mix: 100%-stacked bar per group of
// pass/fail/pending/error counts. Broken groups jump out as color shifts.
export function OutcomeMixChart(props: SweepChartProps)

// Distribution 2 — pass-rate strip plot. Requires model×task rows: one facet row
// per model, one dot per task at x = pass_rate ([0, 1]). Broken tasks are low
// outlier dots repeated across facets; broken models are whole-row-low facets.
type PassRateStripPlotProps = {
  rows: SweepMetricsRow[]          // must be the model×task grouping
  highlightTaskId?: string | null
}
export function PassRateStripPlot(props: PassRateStripPlotProps)
```

Shared internals in `src/components/sweep/sweep-chart-utils.ts` (colocated, not in
`src/lib/`, to keep file isolation — see morning notes):

```ts
// Label for a row of any grouping: model ?? task_id ?? experiment_kind ?? 'all'.
export function sweepGroupLabel(row: SweepMetricsRow, groupKey: SweepSliceKey): string
// Percent width for a bar; returns 0 for null/NaN/max<=0 (never emits NaN styles).
export function barPercent(value: number | null, max: number): number
// Max of a measure across rows, ignoring nulls; 0 when nothing is finite.
export function measureMax(rows: SweepMetricsRow[], pick: (row) => number | null): number
// '8.4 s' / '412 ms' / '—' for null. format.ts has no duration helper; local on purpose.
export function formatMs(value: number | null): string
// Stable sort: desc by measure, nulls last, ties by label (deterministic renders).
export function sortRowsByMeasure(rows, groupKey, pick): SweepMetricsRow[]
```

Value formatting reuses `formatCostCell` / `formatNumber` from `@/lib/format` and the
`—` null idiom from `ScoreHeatmap.formatMeasure`.

## 3. File map (all NEW files; no existing file is touched)

```
docs/plans/06-r1-sweep-dashboard.md                     ← this plan
src/components/sweep/SweepDashboard.tsx                 + SweepDashboard.test.tsx
src/components/sweep/SweepSummaryStrip.tsx              + SweepSummaryStrip.test.tsx
src/components/sweep/ErrorRateChart.tsx                 + ErrorRateChart.test.tsx
src/components/sweep/LatencyRangeChart.tsx              + LatencyRangeChart.test.tsx
src/components/sweep/CostBarChart.tsx                   + CostBarChart.test.tsx
src/components/sweep/PerfMeanVarianceChart.tsx          + PerfMeanVarianceChart.test.tsx
src/components/sweep/OutcomeMixChart.tsx                + OutcomeMixChart.test.tsx
src/components/sweep/PassRateStripPlot.tsx              + PassRateStripPlot.test.tsx
src/components/sweep/sweep-chart-utils.ts               + sweep-chart-utils.test.ts
src/app/dev/sweep-dashboard/page.tsx                    ← demo route
```

Existing files that are imported but never edited: `@/fixtures`, `@/lib/format`,
`@/lib/cn`, `@/components/primitives` (`SECTION_LABEL`, `Tag`),
`@/components/stats/StatCell`.

## 4. Rendering approach

Zero new dependencies. `package.json` has no charting library, and the existing
`ScoreHeatmap` precedent is hand-rolled CSS-grid + inline styles — R1 follows it:

- **Bar charts** (`ErrorRateChart`, `CostBarChart`, `PerfMeanVarianceChart`,
  `OutcomeMixChart`): div-based rows — label column + track div + value column.
  Bar widths are `style={{ width: pct }}` percentages from `barPercent` (never NaN).
  Whiskers (perf) and inner segments (rate-limit share) are absolutely-positioned
  divs inside the track. 100%-stacked outcome mix is a flex row of four segments.
- **Latency dumbbell + strip plot**: one small inline `<svg>` per chart with
  `viewBox="0 0 100 …"` and `preserveAspectRatio="none"`, so x positions are plain
  percentages — no scale library needed. Dots are `<circle>`, ranges are `<line>`.
- **Theme**: existing CSS variables only (`globals.css`), semantics matched to
  `ResultBadge`: passed `--green`, failed `--red`, pending `--yellow`, API error
  `--blue`, rate-limit as a darker inner segment of the error bar, highlights
  `--accent`. Typography/borders copy the heatmap idioms (`font-display` 11px
  uppercase section labels, `rounded-xl border border-[var(--border)]` panels,
  `font-mono tabular-nums` numbers).
- **Dashboard layout** (F-pattern, per dataviz conventions): title + slice controls →
  `SweepSummaryStrip` KPI row → primary "broken?" band (`PassRateStripPlot` +
  `OutcomeMixChart`) → model band (`PerfMeanVarianceChart`, `ErrorRateChart`,
  `LatencyRangeChart`, `CostBarChart` in a 2-col grid) → task band
  (`PerfMeanVarianceChart`, `CostBarChart`). Section headers are story-style
  ("Which tasks look broken", "Where errors and rate limits cluster").
- **Server/client split**: the demo page is an async server component (Next 16
  `searchParams` is a Promise, matching `src/app/aggregate/page.tsx`); it reads an
  optional `?seed=` param, calls `makeSweepMetricsRows` three times (same seed,
  three groupings), and passes plain serializable arrays to the `'use client'`
  `SweepDashboard`. Charts themselves have no state and could stay server-rendered,
  but they render under the dashboard's client boundary — fine, they are pure.
- Empty-rows states render the heatmap's bordered "No data" panel instead of charts.

Demo route: `src/app/dev/sweep-dashboard/page.tsx`, reachable by URL only (nav is a
shared file and is not edited). `?seed=N` reruns the generator for quick visual
fuzzing; invalid/missing seed falls back to `1`.

## 5. Edge cases (from the fixture generator's failure paths)

Derived from `makeSweepMetricsRows` / `makeMeasures` in `src/fixtures/sweep.ts`:

1. **Null group keys.** Per-model rows have `task_id: null` (and vice versa);
   `groupBy: []` yields a single all-null-keys row. `sweepGroupLabel` falls back
   `model → task_id → experiment_kind → 'all'`; components never render
   "null"/"undefined" labels.
2. **Zero-n groups** (`samplesPerGroup: 0`): `pass_rate`/`avg_score` are `null`,
   counts all 0. Bars render at width 0, values as `—`; no `0/0` division
   (`barPercent` guards `max <= 0`).
3. **Null measures generally.** Every `number | null` field (`pass_rate`,
   `avg_score`, `stddev_score`, `avg_cost`, `total_cost`, `avg_latency_ms`,
   `p95_latency_ms`) renders `—` and contributes nothing to scale maxima. No NaN
   ever reaches an SVG attribute or style string (the `ScoreHeatmap.test.tsx`
   no-NaN assertion pattern is reused).
4. **`stddev_score: null` when scored ≤ 1**: perf chart draws the mean bar with no
   whisker rather than a zero-length whisker.
5. **Error/rate-limit-heavy groups**: generator allows `error_count` up to 12% of n
   and `rate_limit_count` anywhere in `[0, error_count]`. Render the invariant
   (inner segment ≤ outer bar) including both boundaries: `rate_limit_count === 0`
   (no inner segment) and `=== error_count` (fully covered bar).
6. **Degenerate scales**: single-row inputs and all-equal values (max === min) must
   still produce finite widths; whisker clamped to the `[0, 1]` score domain
   (mean + stddev can exceed 1 for mid pass rates).
7. **Latency ordering**: generator guarantees `p95 ≥ avg`; component still clamps
   the range to `max(0, p95 - avg)` so hand-built rows can't draw negative ranges.
8. **Empty input** (`models: []` or slice matches nothing): bordered empty-state
   panel, not a zero-height chart.
9. **Long canonical labels** (`"encoder -> decoder"` per `canonical-model.ts`):
   truncate with `title=` tooltip, matching `GenericTable`'s `max-w truncate` idiom.
10. **Duplicate labels across slices**: React keys are
    `${model}|${task_id}|${experiment_kind}` (all three keys), never the label.

## 6. Acceptance mapping

| Acceptance criterion (REL-2) | Design element | Fixture scenario / test |
| --- | --- | --- |
| Rate-limit/API-error count per model | `ErrorRateChart` (`groupKey: 'model'`) | Default per-model rows; test asserts one bar per model, rate-limit segment width ≤ error bar width, and a hand-built `rate_limit_count === error_count` row |
| Latency per model | `LatencyRangeChart` | Per-model rows; test asserts avg-dot x ≤ p95-dot x for every model and `—` for a null-latency row |
| Avg cost per model | `CostBarChart` (`groupKey: 'model'`) | Per-model rows; test asserts `formatCostCell` values and widest bar = max `avg_cost` |
| Perf mean + variance per model | `PerfMeanVarianceChart` (`groupKey: 'model'`) | Per-model rows; test asserts bar widths track `avg_score` on [0,1] and whisker omitted when `stddev_score` null |
| Perf mean + variance per task | Same component, `groupKey: 'task_id'`, `perTask` rows | `makeSweepMetricsRows({ groupBy: ['task_id'] })`; test asserts task labels used |
| Avg cost per task | `CostBarChart` (`groupKey: 'task_id'`) | Per-task rows |
| Distributional plots for spotting broken tasks/models | `PassRateStripPlot` + `OutcomeMixChart` | Model×task rows; test injects a broken model (all `pass_rate` 0) and a broken task (0 across models) and asserts their dots/segments land at x = 0 / full-red mix |
| Sliceable by model and by task | `SweepDashboard` slice selects feeding pre-grouped `perModelTask` rows (section 1) | Dashboard test: `fireEvent.change` the task select → per-model band re-renders from rows with that `task_id`; same for model select |
| Components render correctly against fake data | Every chart prop typed `SweepMetricsRow[]`; all tests build data via `makeSweepMetricsRows` | Multi-seed render loop asserts no NaN styles, no "null" labels |
| A dashboard layout composes them | `SweepDashboard` + demo route `src/app/dev/sweep-dashboard/page.tsx` | Dashboard test asserts all seven sections mount; manual check at `/dev/sweep-dashboard?seed=N` |

## 7. Test plan

Colocated vitest + Testing Library (jsdom, per `vitest.config.ts`), conventions copied
from `ScoreHeatmap.test.tsx` (container queries, style-string assertions, no-NaN
checks). No new dev deps: interactions use RTL `fireEvent` (no `user-event` package).

- **`sweep-chart-utils.test.ts`** — pure-function unit tests: label fallback chain
  (including the all-null-keys row), `barPercent` null/zero/degenerate-max guards,
  `formatMs` thresholds, deterministic sort with null measures last.
- **Per-chart tests** — each renders `makeSweepMetricsRows(...)` output for the
  grouping it owns, plus hand-built `SweepMetricsRow` literals (typed against the
  fixture type, so drift fails compilation) for the edge cases in section 5.
- **Multi-seed invariants** — a shared loop over seeds `[1, 5, 9, 23, 47]` renders
  each chart with per-model, per-task, and model×task groupings and asserts:
  no `NaN` in any `style`/SVG attribute, row count = group count, no literal
  "null"/"undefined" text.
- **`SweepDashboard.test.tsx`** — composition (all sections present with default
  seed data), slice behavior (task select filters the per-model band to
  `perModelTask` rows for that task; model select mirrors it), empty-state when
  given `[]` for all three groupings.
- The demo page itself stays untested (thin async wrapper; matches the repo's
  no-page-test convention). Verified manually via `pnpm dev`.
- Gate: `pnpm test` and `pnpm lint` green before commit; existing suites untouched.

## 8. Morning notes (for Danielle)

1. **Fixture is aggregate-only, so "distributional" plots are cross-group.** True
   per-sample distributions (latency histograms, cost violins) would need a raw
   per-sample sweep fixture, which the frozen contract doesn't include. R1's proxy
   is the per-task pass-rate strip plot + outcome mix, which does catch broken
   tasks/models. If you want real histograms, that's a new fixture shape for a
   later component (contract addition, not a change).
2. **Latency detail is avg + p95 only** — `SweepMetricsRow` carries no
   min/median/max, so the latency plot is a dumbbell, not a box plot. Fine for
   "is a model slow/broken", flagging so nobody expects percentile fans.
3. **No charting library added.** Hand-rolled SVG/CSS matches the ScoreHeatmap
   precedent and keeps deps frozen. Wish-list if R4–R6 need richer plots:
   Observable Plot (small, composable). Decide once, not per-component.
4. **Slice state is local `useState`, not URL params.** URL persistence
   (heatmap-params style) would deserve a shared `sweep-params.ts` +
   conventions review; deferred so R1 stays isolated. Cheap to add later.
5. **Demo route `/dev/sweep-dashboard` is not in the nav** — AppShell is a shared
   file I'm not touching. Reach it by URL; if you want it linked, that's a
   one-line AppShell change for a human/day-shift pass.
6. **`formatMs` lives in `sweep-chart-utils.ts`, not `src/lib/format.ts`** — same
   file-isolation reason. If a later component needs durations too, promote it to
   `format.ts` in a shared-file pass.
7. Fixture shape looks sufficient for REL-2 as specced — no contract complaints.
