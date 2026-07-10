# R3 — Compression-results visualizer (REL-4)

Status: PLAN — implementation to follow on branch `rel4-compression-results`.

Per-sample visualizer that validates enc-dec infra behavior: did the encoder hit its
compression target, what did the intermediate representation cost in characters, and
how do the lossless codecs compare? Built entirely against the frozen fixture contract
(`src/fixtures/compression.ts`, doc `05-r0-fixture-shapes.md`, Shape 3). Components
adapt to the fixture; no fixture or shared-file changes are planned.

Constraints honored:

- **New files only.** No edits to `layout.tsx`, `AppShell`, `globals.css`,
  `package.json`, `src/fixtures/*`, or any existing file.
- **Zero new dependencies.** Bars and markers are plain divs + Tailwind CSS variables,
  the same idiom `ScoreHeatmap` already uses; the metric table is a semantic
  `<table>`. No charting library needed for this density of marks.
- **Server-renderable.** Every new component is a pure presentational function — no
  hooks, no `'use client'` — so the demo route stays an RSC and the components drop
  into any future server page (D3 real-data swap) unchanged.

---

## 1. Component API

Props are the fixture types, verbatim. The card takes a whole `CompressionResultRow`;
sub-components take `Pick`s of it so their prop names stay the snake_case fixture keys.

```ts
import type { CompressionMetric, CompressionResultRow } from '@/fixtures/compression'

/** Top-level per-sample card: header, ratio bullet, char flow, method table. */
type CompressionResultCardProps = {
  row: CompressionResultRow
  /**
   * Upper bound of the ratio scale (from ratioDomainMax over the rows being shown)
   * so sibling cards share one comparable axis. Defaults to the row's own domain.
   */
  ratioDomainMax?: number
}

/** Target-vs-achieved bullet chart. */
type CompressionRatioBulletProps = Pick<
  CompressionResultRow,
  'target_compression_ratio' | 'achieved_compression_ratio' | 'best_compression_ratio'
> & { domainMax: number }

/** Ground truth → encoded IR → generated char-count flow. */
type CharCountFlowProps = Pick<
  CompressionResultRow,
  | 'ground_truth_char_count'
  | 'encoded_char_count'
  | 'generated_char_count'
  | 'encoder_char_budget'
>

/** Per-method lossless codec table. */
type CompressionMethodTableProps = {
  metrics: CompressionMetric[]
  best_compression_ratio: CompressionResultRow['best_compression_ratio']
}
```

Pure view-model helpers (no React) live in `src/lib/compression-view.ts`, matching the
repo's logic-in-`src/lib` convention (`heatmap-order.ts`, `prediction-diagnostics.ts`):

```ts
/** Shared ratio-axis max for a group of rows: max(1, targets, achieved, best) padded; ≥ 1.25. */
export function ratioDomainMax(rows: CompressionResultRow[]): number

/** Clamped 0–100 width for a ratio bar on the shared axis. */
export function ratioPercent(value: number, domainMax: number): number

/** Tone for the achieved bar: 'green' ≤ target, 'yellow' over target, 'red' > 1 (expansion), 'neutral' unknown. */
export function achievedTone(
  target: number | null,
  achieved: number | null,
): 'green' | 'yellow' | 'red' | 'neutral'

/** '0.44×' | '—' for null. */
export function formatRatio(value: number | null): string

/** Metric with the minimum non-null ratio_to_ground_truth; null when none. */
export function bestMetric(metrics: CompressionMetric[]): CompressionMetric | null
```

Existing shared pieces reused as-is (imports only, no edits): `ResultBadge` and `Tag`
and `SECTION_LABEL` from `@/components/primitives`, `StatCell` from
`@/components/stats/StatCell`, `formatBytes`/`formatNumber` from `@/lib/format`,
`cn` from `@/lib/cn`.

## 2. File map (all new)

```
docs/planning/viz-components/v0/workstreams/r3-compression-results.md # this plan
src/lib/compression-view.ts                                  # pure view-model helpers
src/lib/compression-view.test.ts
src/components/compression/CompressionResultCard.tsx         # per-sample card (composes the three below)
src/components/compression/CompressionResultCard.test.tsx
src/components/compression/CompressionRatioBullet.tsx        # target-vs-achieved bullet chart
src/components/compression/CompressionRatioBullet.test.tsx
src/components/compression/CharCountFlow.tsx                 # gt → IR → generated char bars
src/components/compression/CharCountFlow.test.tsx
src/components/compression/CompressionMethodTable.tsx        # raw/zlib/gzip/bz2/lzma/zstd table
src/components/compression/CompressionMethodTable.test.tsx
src/app/dev/compression-results/page.tsx                     # multi-sample demo route (RSC)
src/app/dev/compression-results/demo-rows.ts                 # hand-authored edge-case CompressionResultRow literals
src/app/dev/compression-results/page.test.tsx                # demo-page smoke test
```

`src/components/compression/` follows the existing grouped-directory pattern
(`chips/`, `panels/`, `prediction/`, `stats/`). The demo route lands under a new
`src/app/dev/` segment and inherits `AppShell` from the root layout without touching
it; the route is intentionally unlinked from nav (morning note 1).

## 3. Rendering approach

Chart choices per the dataviz decision tree: one numeric observation per sample
compared against a reference value → **bullet chart**; a three-stage ordered size
sequence → **aligned proportional bars**; six categorical methods × a few numerics →
**table with embedded bars** (six rows is table territory, not chart territory).

### Card header — identity + outcome

Top strip of the card (`rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]`):
`Tag`s for `task_id`, `model`, `sample #{sample_index}`, `experiment_kind`, plus
`ResultBadge(result_state)` and the score. A `StatCell` row surfaces the headline
numbers directly (direct labeling over legend-hunting): target, achieved, best,
encoder char budget.

### Target vs achieved — `CompressionRatioBullet`

Horizontal bullet chart on a `0 → domainMax` scale (shared across sibling cards via
`ratioDomainMax`, so a 0.44× bar means the same width everywhere):

- **Budget band**: light `--accent-bg` band from 0 to `target_compression_ratio` —
  "landing here means the encoder met its budget".
- **Target marker**: vertical 2px `--accent` line at the target, labeled `0.50× target`.
- **Achieved bar**: the featured measure, filled bar to
  `achieved_compression_ratio`, colored by `achievedTone` (green within target,
  yellow over, red past 1.0), direct-labeled `0.44× achieved` with the delta to
  target (`Δ −0.06`).
- **Best marker**: small tick at `best_compression_ratio` labeled `best codec 0.41×` —
  shows how much of the achieved ratio is redundancy a lossless codec reclaims.
- **1.0 reference line**: dashed `--border-strong` line labeled `1.0 = no compression`,
  always rendered; ratios to its right are expansion.

Lower-is-better is stated once in the demo-page intro line rather than repeated per card.

### Char-count flow — `CharCountFlow`

Three aligned horizontal bars, widths proportional to the max of the three counts
(one local scale per card — char counts vary 120–900 across tasks, so a shared scale
would flatten small tasks):

```
ground truth   ████████████████████  192 chars
encoded IR     █████████╎            89 chars   (budget 96 ╎)
generated      █████████████████████ 205 chars
```

- Budget tick (`encoder_char_budget`) overlaid on the encoded-IR row; when the
  encoder blows its budget the bar visibly crosses the tick (generator emits up to
  1.05× budget — that overflow is exactly the infra signal this view exists for).
- Counts right-aligned in `font-mono` via `formatNumber`; rows labeled with
  `SECTION_LABEL`-style captions.
- Generated bar gets a muted note when `generated_char_count` exceeds ground truth
  (normal for code reconstruction, worth seeing).

### Per-method table — `CompressionMethodTable`

Semantic `<table>` in the repo's table styling (mono numerics, right-aligned, row
borders via `--border-subtle`), rows in fixture `COMPRESSION_METHODS` order with
`raw` first as the uncompressed baseline:

| method | representation | compressed | ratio (bar) | % reduction |
|--------|---------------:|-----------:|-------------|------------:|

- `ratio_to_ground_truth` cell embeds a mini inline bar on the same `0 → domainMax`
  scale as the bullet, so the table visually reconciles with the chart above it.
- The row matching `bestMetric(metrics)` gets a green `Tag` (`best`) and a
  `--green-bg` row tint; ties resolve to the first minimum.
- Byte columns render via `formatBytes`; `null` ratio/reduction render `—`.

### Demo page — `src/app/dev/compression-results/page.tsx`

RSC, no data fetching, fixed `DEMO_SEED` constant. Layout:

1. **Title + intro** stating the read: "lower ratio = tighter compression; 1.0 = no
   compression" plus the fixture provenance (seed, generator call).
2. **Generated samples** — `makeCompressionResultRows({ seed: DEMO_SEED, taskCount: 3,
   models: 2 defaults, targetRatios: [0.25, 0.5, 1.0, 2.0], samplesPerTarget: 1 })`,
   grouped by target ratio with a section header per target; each group renders its
   rows as cards sharing one `ratioDomainMax(groupRows)`. This shows the
   tight-budget → miss and loose-budget → expansion progression across real generator
   output.
3. **Edge cases** — cards rendered from `demo-rows.ts` literals (section 4), each
   with a one-line caption naming the failure path it demonstrates.

`demo-rows.ts` exports `EDGE_CASE_ROWS: { label: string; row: CompressionResultRow }[]`
— hand-authored literals typed against the frozen fixture type (constructing values of
a fixture type is not a fixture modification).

## 4. Edge cases

The `CompressionResultRow` type admits failure paths that `makeCompressionResultRows`
never emits (it always fills every field and only uses `passed`/`failed`) — see
morning note 2. The components handle the full type; `demo-rows.ts` + tests exercise
each path:

| Case | Source | Component behavior |
|------|--------|--------------------|
| `target_compression_ratio: null` (+ null `encoder_char_budget`) — direct run | type contract; direct layouts have no knob | Bullet renders achieved bar only, `no target (direct run)` neutral `Tag`, no budget band/marker, no delta; flow omits the budget tick |
| `achieved_compression_ratio: null`, `encoded_char_count: null`, `generated_char_count: null` — sample failed before encode/decode | type contract | Bullet keeps the track + target marker, `not measured` muted placeholder instead of a bar; flow renders ground-truth bar plus `not produced` placeholders for the missing stages |
| Ratio > 1 (expansion) | generator emits these for targets 1.5/2.0 (encoded ≈ 0.7–1.05 × budget) | Domain extends past the always-visible 1.0 dashed line; achieved bar past it renders red with an `expansion` label; bar widths clamp at 100% of the track |
| `result_state: 'error'`, `score: null` | type contract (`RESULT_STATES`) | `ResultBadge` renders it (neutral fallback today — morning note 3); score shows `—`; metric/char nulls handled as above |
| `ratio_to_ground_truth: null` in a metric row | type contract | `—` cells, row excluded from `bestMetric`; all-null metrics → no best highlight |
| Budget floor (`encoder_char_budget` = 50 > target × chars) | generator `MIN_ENCODER_CHAR_BUDGET` | Budget tick can sit right of the target-implied width; flow renders the tick wherever it lands — no special casing needed, just no assumption that budget ≈ target × gt |
| Encoded chars exceed budget | generator (`floatBetween 0.7–1.05`) | Encoded bar crosses the budget tick — rendered, not clamped to the tick |

## 5. Acceptance mapping

REL-4 acceptance: *"renders compression metrics for a sample against fake data"*, with
the issue asking for target-vs-achieved plus IR/char counts and a legible per-method
table.

| Criterion | Design element | Fixture scenario / test |
|-----------|----------------|------------------------|
| Renders compression metrics for a sample against fake data | `CompressionResultCard` consuming `CompressionResultRow` from `makeCompressionResultRows`; live at `/dev/compression-results` | `CompressionResultCard.test.tsx` renders every generator row for seeds 1/7/42 without NaN/`undefined` text; `page.test.tsx` smoke-renders the route |
| Target vs achieved compression ratio surfaced | `CompressionRatioBullet` (budget band, target marker, achieved bar, best tick, 1.0 reference) + `StatCell` headline strip | `CompressionRatioBullet.test.tsx`: values direct-labeled, tone by target relation; generator targets 0.25→2.0 give both met and missed budgets |
| IR / character counts surfaced | `CharCountFlow` (gt → encoded IR → generated with budget tick) | `CharCountFlow.test.tsx`: proportional widths, budget tick, counts shown; generator rows for spread of `ground_truth_char_count` |
| Per-method table legible | `CompressionMethodTable`: fixed method order, best-row highlight, inline ratio bars, `formatBytes` | `CompressionMethodTable.test.tsx`: all six `COMPRESSION_METHODS` rows in order, best highlight matches `best_compression_ratio` |
| Used to validate infra behavior (failure paths visible) | Edge-cases demo section; expansion/over-budget rendering | `demo-rows.ts` literals; null/expansion/error tests in the bullet/flow/card test files |

## 6. Test plan

Colocated vitest (`jsdom` + testing-library, per `vitest.config.ts` and the
`ScoreHeatmap.test.tsx` idiom). Fixture-driven tests loop over
`makeCompressionResultRows` with multiple seeds and assert invariants rather than
pinned values, since the generator is seeded-random.

- **`src/lib/compression-view.test.ts`** — one behavior per test:
  `ratioDomainMax` covers the max of target/achieved/best across rows and floors at
  1.25; `ratioPercent` clamps to [0, 100]; `achievedTone` table (≤ target → green,
  > target → yellow, > 1 → red, null → neutral); `formatRatio` null → `—`;
  `bestMetric` picks the min non-null ratio, skips nulls, returns null when all null.
- **`CompressionResultCard.test.tsx`** — for seeds `[1, 7, 42]`, render every row of
  `makeCompressionResultRows({ seed, taskCount: 2 })`: no `NaN` in rendered styles or
  text (the `ScoreHeatmap` NaN-guard pattern); target/achieved/best appear via
  `formatRatio`; six method rows; identity tags + `ResultBadge` present.
- **`CompressionRatioBullet.test.tsx`** — null target hides band/marker and shows the
  direct-run tag; null achieved shows the placeholder; ratio > 1 shows the expansion
  label with the 1.0 reference line still rendered; widths never exceed the track.
- **`CharCountFlow.test.tsx`** — widths proportional to the max count; null
  encoded/generated render placeholders; budget tick rendered only when
  `encoder_char_budget` is non-null; over-budget encoded bar crosses the tick.
- **`CompressionMethodTable.test.tsx`** — methods rendered in `COMPRESSION_METHODS`
  order; best-row highlight; null-ratio metric renders `—` and never wins best.
- **`page.test.tsx`** — smoke: demo page renders the intro, one section per target
  ratio, and every `EDGE_CASE_ROWS` label.

Verification commands: `pnpm test` (full suite),
`pnpm vitest run src/lib/compression-view.test.ts src/components/compression src/app/dev`
(scoped), `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm dev` →
`http://localhost:3000/dev/compression-results` for the visual check.

## 7. Morning notes (for Danielle)

1. **Demo route is unlinked.** `/dev/compression-results` inherits `AppShell` but has
   no nav entry (adding one means editing `AppShell.tsx`, a shared file). Decide
   whether dev demo routes get a nav section or a `/dev` index page once several R
   components exist.
2. **Generator never exercises its own failure paths.** `makeCompressionResultRows`
   only emits `passed`/`failed` rows with every field populated; the type's null
   target (direct runs), null achieved/encoded/generated, and `error`/`pending`
   states never occur. This plan hand-authors edge rows in `demo-rows.ts` and tests.
   If you want generator-emitted failure paths, an additive option on the fixture
   (e.g. `errorRate`, `includeDirect`) would be a small follow-up — not planned here
   because the fixture contract is frozen.
3. **`ResultBadge` has no `error` styling.** `STATE_BADGE` in
   `src/components/primitives.tsx` lacks an `'error'` key, so error rows fall back to
   neutral gray. A one-line red mapping there would fix it repo-wide — shared file,
   so deferred; the card compensates by also muting the score to `—`.
4. **Fixture byte fields hold char counts.** `makeCompressionMetrics` feeds char
   counts into `ground_truth_bytes`/`representation_bytes`, so in fixtures
   `raw.ratio_to_ground_truth === achieved_compression_ratio` exactly. Real data has
   bytes ≠ chars, and doc 05 already flags that D3 must pin whether
   `realized_compression_ratio` means the `raw` or best method. The table labels byte
   columns per the field names either way; just don't be surprised that the fixture's
   raw row duplicates the achieved headline.
