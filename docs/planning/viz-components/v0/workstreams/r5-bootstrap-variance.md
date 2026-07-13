# R5 — Bootstrap variance + confidence-bounds visualization (REL-6)

Status: PLAN — implementation to follow on branch `rel6-bootstrap-variance`.

Visualizes bootstrapped variance and confidence bounds on per-task and aggregate
pass rates, so the coarse budget sweep can answer "how many repetitions (N) do we
need, and which compression range differences are real?" Builds strictly on the
frozen R0 fixture contract (`docs/planning/viz-components/v0/plan.md`, Shape 5 +
Decision 1): raw `BootstrapSampleRow[]` in, client-side seeded bootstrapping,
`BootstrapCiSummary` as the computed output contract of a NEW shared helper.
No fixture files, no shared files, and no `tools/unitbench_publish` files change.

---

## 1. Component API

All prop types are imported directly from the frozen fixture module
(`@/fixtures/bootstrap`) — components adapt to fixtures, never the reverse.

### 1a. Shared helper — `src/lib/bootstrap-ci.ts` (new file)

```ts
import type { BootstrapCiSummary, BootstrapSampleRow } from '@/fixtures/bootstrap'
import { createRng, type Rng } from '@/fixtures/rng' // read-only import; no fixture edits

/** How rows are grouped before resampling. */
export const BOOTSTRAP_GROUPINGS = ['model', 'task', 'model_task', 'overall'] as const
export type BootstrapGrouping = (typeof BOOTSTRAP_GROUPINGS)[number]

export type BootstrapCiConfig = {
  seed: number
  /** Bootstrap replicate count; default 2000. */
  n_resamples: number
  /** Two-sided percentile CI level; default 0.95. */
  confidence_level: number
  /**
   * Per-group draw size for each replicate (m-out-of-n bootstrap). This is the
   * "compare across N" knob: replicates of size N drawn with replacement from
   * the group's observed rows, so CI width ~ 1/sqrt(N). null = the group's own
   * row count (classic bootstrap).
   */
  n_per_group: number | null
}

export const DEFAULT_BOOTSTRAP_CONFIG: BootstrapCiConfig = {
  seed: 17,
  n_resamples: 2000,
  confidence_level: 0.95,
  n_per_group: null,
}

/**
 * Group rows, resample each group deterministically, return one summary per
 * non-empty group. Percentile CI (type-7 linear interpolation on the sorted
 * replicate pass rates). Empty groups are omitted (see §4).
 */
export function computeBootstrapCis(
  rows: readonly BootstrapSampleRow[],
  grouping: BootstrapGrouping,
  config: BootstrapCiConfig,
): BootstrapCiSummary[]

/**
 * Convenience for the compare-across-N view: computeBootstrapCis once per N in
 * the ladder, tagging each batch. Cardinality stays tiny (see §3 perf note).
 */
export type CiByN = { n: number; summaries: BootstrapCiSummary[] }
export function computeCisAcrossN(
  rows: readonly BootstrapSampleRow[],
  grouping: BootstrapGrouping,
  config: Omit<BootstrapCiConfig, 'n_per_group'>,
  nLadder: readonly number[],
): CiByN[]

/** Observed per-group facts the UI needs alongside summaries (available n, etc.). */
export type GroupObservation = {
  model: string | null
  task_id: string | null
  n_available: number
  observed_pass_rate: number | null // null when n_available === 0
}
export function observeGroups(
  rows: readonly BootstrapSampleRow[],
  grouping: BootstrapGrouping,
): GroupObservation[]
```

Output rows are exactly `BootstrapCiSummary` (frozen shape): `model` / `task_id`
null when aggregated across that dimension, `n_samples` = the draw size actually
used, plus `observed_pass_rate`, `ci_low`, `ci_high`, `confidence_level`,
`n_resamples`, `seed`.

Determinism design (the part worth pinning before code):

- No `Math.random()` anywhere. Each group gets its own PRNG stream:
  `createRng(mixSeed(config.seed, groupKeyHash))`, where `mixSeed` is a small
  integer hash (fnv1a over `"${model}|${task_id}"` xor'd into the seed).
  This makes each group's CI independent of group iteration order and of which
  other groups are present — filtering models cannot silently change the CI of
  the models that remain.
- Rows are sorted by `(model, task_id, sample_index)` before indexing so the
  resample index → row mapping is stable regardless of input order.
- Percentile method pinned (type-7) so tests can assert exact bounds.

### 1b. Components — `src/components/bootstrap/` (new directory)

Follows the existing subdirectory convention (`chips/`, `panels/`,
`prediction/`, `stats/`), named exports, `type XxxProps` per file.

```ts
// BootstrapVariancePanel.tsx — 'use client'; owns control state + memoized compute
type BootstrapVariancePanelProps = {
  rows: BootstrapSampleRow[]                       // fixture type, verbatim
  initialConfig?: Partial<BootstrapCiConfig>        // seed etc. from the demo page
  initialGrouping?: BootstrapGrouping               // default 'model'
}

// CiIntervalChart.tsx — pure presentational forest plot
type CiIntervalChartProps = {
  summaries: BootstrapCiSummary[]                   // the computed contract
  observations: GroupObservation[]                  // available-n annotations
  title: string
}

// CiWidthVsNChart.tsx — pure presentational compare-across-N view
type CiWidthVsNChartProps = {
  ciByN: CiByN[]                                    // one batch per ladder N
  observations: GroupObservation[]
}

// BootstrapControls.tsx — controlled form
type BootstrapControlsProps = {
  grouping: BootstrapGrouping
  config: BootstrapCiConfig
  maxAvailableN: number                             // for slider bounds/annotation
  onGroupingChange: (g: BootstrapGrouping) => void
  onConfigChange: (c: BootstrapCiConfig) => void
}
```

The panel is the only stateful piece; both charts are pure functions of
`BootstrapCiSummary[]`, which keeps them trivially testable and keeps the
helper the single place bootstrap math lives.

---

## 2. File map (all NEW files; nothing existing is touched)

| Path | Purpose |
| --- | --- |
| `src/lib/bootstrap-ci.ts` | Seeded bootstrap helper: grouping, m-out-of-n resampling, percentile CIs, N-ladder sweep |
| `src/lib/bootstrap-ci.test.ts` | Helper correctness tests (see §6) |
| `src/components/bootstrap/BootstrapVariancePanel.tsx` | Client panel: control state, `useMemo` compute, composes charts + empty states |
| `src/components/bootstrap/BootstrapVariancePanel.test.tsx` | Panel behavior tests (seeds, controls, degenerate data) |
| `src/components/bootstrap/CiIntervalChart.tsx` | Forest-style CI interval plot (SVG) |
| `src/components/bootstrap/CiIntervalChart.test.tsx` | Interval rendering tests |
| `src/components/bootstrap/CiWidthVsNChart.tsx` | CI width / interval fan vs N (SVG) |
| `src/components/bootstrap/CiWidthVsNChart.test.tsx` | Across-N rendering tests |
| `src/components/bootstrap/BootstrapControls.tsx` | Seed / resamples / confidence / grouping / N controls (tested through the panel) |
| `src/app/dev/bootstrap-variance/page.tsx` | Demo route over `makeBootstrapSampleRows` + handcrafted edge-case scenarios |
| `docs/planning/viz-components/v0/workstreams/r5-bootstrap-variance.md` | This plan |

Notes:

- The dev route inherits `AppShell` via the root layout automatically — no
  layout/nav/`globals.css` edits. It is reachable only by URL
  (`/dev/bootstrap-variance`); intentionally not added to nav (shared file).
- Zero new dependencies: charts are hand-rolled SVG (no chart lib exists in
  `package.json`, and cardinality is small enough that one is unwarranted).
- `src/lib/bootstrap-ci.ts` imports `createRng` from `@/fixtures/rng`
  (import-only reuse of the existing mulberry32; the fixture file is not
  modified). Morning note §7 covers whether to later promote the PRNG to
  `src/lib/`.

---

## 3. Rendering approach

### Demo page (`src/app/dev/bootstrap-variance/page.tsx`)

Server component in the style of `src/app/aggregate/heatmap/page.tsx`
(`await searchParams`, `AggregatePageShell` for chrome). Search params select a
scenario and fixture seed, so states are shareable/reproducible:

- `?scenario=default` (default): `makeBootstrapSampleRows({ seed, taskCount: 24, samplesPerTask: 3 })` — 4 models × 24 tasks × 3 samples.
- `?scenario=high-rep`: `samplesPerTask: 20` — enough depth for the N ladder.
- `?scenario=degenerate`: handcrafted `BootstrapSampleRow` literals appended —
  one all-pass task, one all-fail task, one task with a single sample, one model
  with zero rows for a task (composed in the page; only *uses* fixture types).
- `?seed=<int>`: fixture generation seed (default 1).

The page passes `rows` (serializable) into `<BootstrapVariancePanel />` plus an
`initialConfig` seed. Interactive knobs below are client-local state inside the
panel — no server round-trips while twiddling.

### View 1 — CI interval (forest) plot, `CiIntervalChart`

Data path (dataviz tree): numeric + categoric → several observations per group →
distribution summary per group → interval/forest plot. One row per group
(model, task, or model×task per grouping control):

- Shared X axis fixed to pass rate `[0, 1]` with gridlines at 0/0.25/0.5/0.75/1;
  never truncated, so interval widths are visually comparable across rows.
- Per row: horizontal segment `ci_low → ci_high`, filled dot at
  `observed_pass_rate`, right-aligned mono label
  `0.62 [0.55, 0.69] · n=3 (×2000)` using three-decimal formatting consistent
  with `ScoreHeatmap.formatMeasure`.
- Rows sorted by observed pass rate descending (stable tiebreak on label) so the
  ranking story reads top-down; group label column on the left, truncated with
  `title` tooltip like existing tables.
- `grouping = 'task'` can produce ~24–164 rows: the chart renders inside a
  max-height scroll container (existing `overflow-x-auto rounded-xl border`
  idiom, vertical here); row height stays fixed rather than squeezing.
- Degenerate rows (CI width 0) render the dot plus a "degenerate (all pass)" /
  "(all fail)" tag instead of an invisible segment (§4).
- Styling: theme CSS vars (`--bg-secondary`, `--border`, `--text-*`,
  `--accent`), `font-mono` numbers, no chart junk — matches Tufte-ish repo look.
  SVG carries `role="img"` + `aria-label`; each row group gets an accessible
  label (`{group}: 0.62, 95% CI 0.55 to 0.69`) so tests and screen readers read
  values without pixel math.

### View 2 — compare across N, `CiWidthVsNChart`

The acceptance-critical view: shows how CI width shrinks as per-cell sample
count N grows, to pick N for the real sweep.

- N ladder default `[2, 3, 5, 8, 12, 20, 32, 50]`, clamped/annotated against
  `maxAvailableN` (§4). For each N, `computeCisAcrossN` re-resamples with
  replicate draw size N (m-out-of-n) from the same observed rows.
- Encoding: X = N (log-ish ordinal ticks at the ladder values), Y = pass rate
  `[0, 1]`. Per group: a vertical CI interval at each N (an "interval fan") with
  a connecting line through the observed rate. Few groups (grouping 'model',
  ≤ 4–6 series) render overlaid with the existing categorical accent colors;
  more than 6 series falls back to small multiples per model (avoids the
  many-series line chart anti-pattern).
- Secondary strip under the fan: CI *width* vs N per group (thin lines), the
  direct "when is the interval tight enough" read, with a user-set reference
  line (default width 0.10) — the decision threshold this chart exists for.
- Ns beyond available samples render with a dashed/hollow treatment plus an
  "extrapolated" note (§4).

### Controls, `BootstrapControls`

Single control strip above the charts (existing filter-strip styling):

- **Grouping**: `model | task | model × task | overall` segmented control.
- **Seed**: numeric input + a "reroll" button (increments seed) — demonstrates
  determinism (same seed → identical charts) and resample sensitivity.
- **Resamples**: select `500 | 1000 | 2000 | 5000` (default 2000).
- **Confidence**: select `0.80 | 0.90 | 0.95 | 0.99` (default 0.95).
- **N (view 1)**: slider `1 … max(available, 50)`, default "all available";
  ladder for view 2 is fixed (kept out of the controls to avoid knob overload).

### Responsiveness / heavy computation

Cardinality is genuinely small: worst realistic case is grouping 'task' at 164
groups × 5000 resamples × N ≤ 50 draws ≈ 41M PRNG calls only at the most extreme
settings; defaults are ~24 groups × 2000 × 3 ≈ 150K. Plan:

- All computation inside `useMemo` keyed on `[rows, grouping, config]`
  (`computeBootstrapCis`) and `[rows, grouping, ladder, seed, n_resamples,
  confidence_level]` (`computeCisAcrossN`) — the ScoreHeatmap `useMemo` pattern.
- Slider/select changes wrap the state update in `useDeferredValue` on the
  config object feeding the memo, so the controls stay snappy if someone drags
  the N slider at 5000 resamples.
- No web worker: measured budget at defaults is single-digit milliseconds; a
  worker would be speculative complexity. If profiling during implementation
  shows >100 ms at defaults, note it rather than redesign (constraint: keep it
  simple, morning-note anything bigger).

---

## 4. Edge cases

| Case | Behavior (helper) | Behavior (UI) |
| --- | --- | --- |
| Zero samples in a group (e.g. model×task with no rows) | Group omitted from `computeBootstrapCis` output — a pass-rate CI over nothing is undefined, and `observed_pass_rate` is non-nullable in the frozen `BootstrapCiSummary`. `observeGroups` still reports it with `n_available: 0`, `observed_pass_rate: null`. | Forest plot renders a grayed "no samples" row from `observeGroups` so the group doesn't silently vanish. |
| `rows` empty overall | Both helpers return `[]`. | Panel renders the existing empty-state card ("No bootstrap samples for this scenario."), mirroring `ScoreHeatmap`'s no-data block. |
| All-pass / all-fail group | Every replicate rate is 1 (or 0) → degenerate CI `[1, 1]` / `[0, 0]`. Returned as-is (valid data, not an error). | Dot rendered with a "degenerate" tag instead of a zero-length segment; tooltip explains the bootstrap sees no variance at this N. |
| Requested N > available samples in a group | Allowed: draws are with replacement, so m-out-of-n with m > n is well defined. `n_samples` reports the requested N. | Marked "extrapolated" (dashed interval, hollow dot) with a note that it assumes the observed rate is the truth — it *understates* uncertainty about the rate itself. `maxAvailableN` from `observeGroups` drives the annotation. |
| N < 1 or non-integer from controls | Helper throws on `n_per_group < 1` / non-integer / `n_resamples < 1` / `confidence_level` outside (0, 1) — invalid config is a bug, fail fast. | Controls constrain input (slider min 1, closed select sets) so the throw is unreachable from the UI. |
| Determinism across reruns | Same `(rows, grouping, config)` → byte-identical `BootstrapCiSummary[]`: per-group hashed seed streams + pre-sort by `(model, task_id, sample_index)` make results independent of row order and of unrelated groups' presence. | "Reroll seed" visibly changes bounds; re-entering the previous seed restores the exact prior chart. |
| Single-sample group (n=1) | Valid: every replicate equals the one observation → degenerate CI at 0 or 1. | Falls under the degenerate-tag rendering; the across-N view is where it becomes informative. |
| `score` fractional (future) | Out of scope: helper resamples `passed` only (pass-rate CIs per the issue). `score` is ignored; noted in the helper doc comment. | — |

---

## 5. Acceptance mapping

| REL-6 acceptance criterion | Design element | Fixture scenario / test |
| --- | --- | --- |
| "Renders bootstrap CIs on pass-rate estimates against fake data" | `computeBootstrapCis` → `CiIntervalChart` forest plot on the demo page, per-model / per-task / overall groupings | Demo `?scenario=default` over `makeBootstrapSampleRows`; `CiIntervalChart.test.tsx` asserts one labeled interval per group with `ci_low ≤ observed ≤ ci_high`; `bootstrap-ci.test.ts` asserts CI containment and bounds within [0, 1] |
| "Supports comparing across N (re-resampling at different per-cell sample counts, CI width shrinks as N grows)" | `n_per_group` (m-out-of-n) in the helper, `computeCisAcrossN` N-ladder, `CiWidthVsNChart` interval fan + width strip, N slider in controls | `?scenario=high-rep` (20 samples/task); `bootstrap-ci.test.ts` asserts mean CI width strictly decreases from N=3 → N=12 → N=48; `CiWidthVsNChart.test.tsx` asserts one interval per ladder N and narrower rendered widths at larger N |
| (Implied) reliable conclusions ⇒ reproducible numbers | Seeded per-group PRNG streams; seed control in UI | Helper determinism tests (§6); panel test renders twice with the same seed and diffs markup |
| (Implied) usable for both per-task and aggregate rates | Grouping control `model / task / model_task / overall`; `BootstrapCiSummary.model/task_id` nulls encode the aggregation | Helper tests cover all four groupings incl. null-key population; panel test switches grouping and asserts row-set changes |

---

## 6. Test plan (colocated vitest, jsdom + testing-library per repo setup)

### `src/lib/bootstrap-ci.test.ts` — helper correctness

Fixture inputs: `makeBootstrapSampleRows({ seed, taskCount, samplesPerTask })`
plus small handcrafted row arrays for exact-value cases.

1. **Deterministic given seed**: two calls with identical `(rows, grouping,
   config)` → `toEqual`; shuffled copy of `rows` → identical output (pre-sort);
   different `seed` → at least one differing bound.
2. **Group-stream independence**: computing over all models vs. over one
   model's rows alone yields the same summary for that model (hashed per-group
   seeds).
3. **CI sanity**: for every summary, `0 ≤ ci_low ≤ observed_pass_rate ≤ ci_high ≤ 1`;
   `confidence_level`, `n_resamples`, `seed`, `n_samples` echo the config.
4. **Width shrinks with N**: on `samplesPerTask: 50` fixture rows, mean CI
   width across model groups at N=3 > N=12 > N=48 (strict, fixed seed — value
   is deterministic so no flakiness).
5. **Confidence ordering**: 0.99 CI ⊇ 0.80 CI for the same group/seed.
6. **Degenerate groups**: handcrafted all-pass rows → `[1, 1]`; all-fail →
   `[0, 0]`; single-sample group → degenerate CI at its observation.
7. **Empty input / empty group**: `[]` rows → `[]`; a model×task grouping with
   a missing combination omits that group while `observeGroups` reports
   `n_available: 0`.
8. **m > n allowed**: `n_per_group: 40` over a 3-sample group returns valid
   bounds and `n_samples: 40`.
9. **Invalid config throws**: `n_per_group: 0`, `n_resamples: 0`,
   `confidence_level: 1.2` each reject.
10. **Groupings**: 'model' → `task_id: null`; 'task' → `model: null`;
    'overall' → both null, single summary; 'model_task' → both populated.
11. **`computeCisAcrossN`**: one batch per ladder entry, each equal to a direct
    `computeBootstrapCis` call with that `n_per_group` (composition check).

### `src/components/bootstrap/CiIntervalChart.test.tsx`

- Renders one accessible interval row per summary with label text containing
  observed rate and both bounds; rows ordered by observed rate desc.
- Degenerate summary (`ci_low === ci_high`) renders the degenerate tag, no
  zero-width segment element.
- `observations` row with `n_available: 0` renders the "no samples" row.

### `src/components/bootstrap/CiWidthVsNChart.test.tsx`

- Given `computeCisAcrossN` output from fixture rows: one interval group per
  ladder N per series; rendered interval extent at the largest N is smaller
  than at the smallest N (assert via the accessible labels / data attributes,
  not pixel geometry).
- Ladder entries beyond `n_available` carry the extrapolated marker.

### `src/components/bootstrap/BootstrapVariancePanel.test.tsx` — multiple seeds

- Renders both charts + controls from `makeBootstrapSampleRows({ seed: 12 })`.
- **Same seed twice** → identical accessible interval labels (render-level
  determinism). **Seed A vs seed B** (config seeds 17 vs 18, same rows) → at
  least one label differs.
- Changing grouping select from model → task updates the forest-row count from
  model-count to task-count.
- Tightening N via the slider updates view-1 labels (`n=` echo) and bounds.
- Empty `rows` → empty-state message, no SVG.

Run: `pnpm test` (`vitest run`), no config changes — `vitest.config.ts` already
provides jsdom, globals, `@/` alias, setup file.

---

## 7. Morning notes (for Danielle)

1. **`BootstrapCiSummary` lacks an "available samples" field.** `n_samples` is
   the draw size used, so when comparing across N (especially extrapolated
   N > available) the UI needs the observed group size separately. Plan works
   around it with a helper-side `GroupObservation` companion type (not a fixture
   change). If R5 sticks, consider adding `n_available` to the Shape-5 contract
   in a future fixture rev.
2. **PRNG location**: the frozen contract puts `createRng` in
   `src/fixtures/rng.ts`. R5's helper imports it read-only from `@/fixtures/rng`
   (no duplication, no fixture edit), which means `src/lib` now depends on
   `src/fixtures`. If that direction bothers you, the follow-up is promoting the
   PRNG to `src/lib/rng.ts` and re-exporting from fixtures — a shared-file change,
   so deliberately not in this plan.
3. **Dev route is not in the nav.** `AppShell` is shared, so
   `/dev/bootstrap-variance` is URL-only. If the team wants a "dev tools"
   nav section, that's a one-line shared change for a human-reviewed PR.
4. **Statistical choices to sanity-check**: (a) percentile bootstrap (not
   BCa/Wilson) — simplest, adequate for a planning viz, and exactly matches the
   frozen summary fields; (b) compare-across-N is m-out-of-n resampling from
   observed rows, and for N beyond available data it treats the observed rate as
   truth, understating rate uncertainty — the UI labels these points
   "extrapolated". Happy to swap in Wilson intervals as a reference overlay
   later if you want an analytic cross-check.
5. **Task-count realism**: fixture default is 24 tasks; real HumanEval is 164.
   The per-task forest view is designed to scroll, and perf headroom was checked
   at 164 × 5000 resamples, but the demo defaults keep 24 for readability.
