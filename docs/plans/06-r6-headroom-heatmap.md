# R6 — Binned headroom heatmap (REL-1)

Status: PLAN — implementation to follow on this branch (`rel1-headroom-heatmap`).

X = achieved-compression-ratio bins, Y = per-task mean-pass-rate bins, color = task
count per cell. Per-model facet grid with an overlay (combined) toggle, and a
shareable URL that persists the layout — this is the advisor-engagement surface, so
the rendering section below spends real effort on polish.

Contract inputs are frozen: `HeadroomPoint`, `HeadroomBinConfig`, and
`HeadroomHeatmapCell` from `src/fixtures/heatmap.ts` (Shape 6 + Decision 2 in
`docs/plans/05-r0-fixture-shapes.md`). Binning runs client-side over raw
`HeadroomPoint[]`. **Important discovery:** the merged fixture already exports
`binHeadroomPoints(points, config): HeadroomHeatmapCell[]` (sparse cells, per-model
facets plus the `UNFACETED_KEY = 'all'` facet, one shared domain, out-of-domain
clamping) with tests in `src/fixtures/heatmap.test.ts`. This plan **reuses that bin
math by import** and designs the new shared helper as the dense-grid view-model
layer above it — duplicating the histogram arithmetic in `src/lib/` would create two
sources of truth for bin edges. See morning note 1.

No new dependencies. No edits to any existing file.

---

## 1. Component API

Props are typed directly against the fixture types. The component receives raw
points plus parsed URL state; it bins internally via the shared helpers.

```ts
import type { HeadroomPoint } from '@/fixtures/heatmap'

// src/lib/headroom-heatmap-params.ts
export type HeadroomViewMode = 'facets' | 'overlay'

export type HeadroomHeatmapState = {
  view: HeadroomViewMode            // default 'facets'
  x_bin_count: number               // default 10, clamped to [2, 50]
  y_bin_count: number               // default 10, clamped to [2, 50]
  x_domain?: [number, number]       // default: data extent (resolved by the grid helper)
  facetOrder?: string[]             // manual facet order; keys are canonical model labels
  seed: number                      // demo fixture seed, default 1
}

// src/components/headroom/HeadroomHeatmap.tsx
export type HeadroomHeatmapProps = {
  points: HeadroomPoint[]
  state: HeadroomHeatmapState
}
```

Notes:

- `y_domain` is **not** state: pass rate is semantically `[0, 1]` and the fixture
  defaults to exactly that; hard-code it in `toBinConfig` (below).
- Bin-count and domain fields use the fixture's snake_case names so
  `toBinConfig(state)` is a near-identity projection into `HeadroomBinConfig`:

```ts
// src/lib/headroom-heatmap-params.ts
export function toBinConfig(state: HeadroomHeatmapState): HeadroomBinConfig {
  return {
    x_bin_count: state.x_bin_count,
    y_bin_count: state.y_bin_count,
    ...(state.x_domain ? { x_domain: state.x_domain } : {}),
    y_domain: [0, 1],
  }
}
```

### The new shared helper: dense grid view-model

`binHeadroomPoints` returns sparse cells with no record of the resolved default
domain. The component needs the full grid geometry (empty cells, edges, color max),
so the new helper owns domain resolution and always calls `binHeadroomPoints` with
**explicit** domains:

```ts
// src/lib/headroom-heatmap-grid.ts
import {
  binHeadroomPoints,
  UNFACETED_KEY,
  type HeadroomBinConfig,
  type HeadroomHeatmapCell,
  type HeadroomPoint,
} from '@/fixtures/heatmap'

/** Mirrors the fixture default: data extent; min === max widens to [min, min + 1]. */
export function resolveXDomain(
  points: HeadroomPoint[],
  config: HeadroomBinConfig,
): [number, number]

export type HeadroomFacetGrid = {
  facet_key: string
  point_count: number
  /** rows[y_bin_index][x_bin_index]; y ascending. Dense: every cell present, count 0 filled in. */
  rows: HeadroomHeatmapCell[][]
}

export type HeadroomGrid = {
  x_domain: [number, number]
  y_domain: [number, number]
  x_edges: number[]                 // length x_bin_count + 1
  y_edges: number[]                 // length y_bin_count + 1
  facets: HeadroomFacetGrid[]       // one per model, localeCompare order; excludes 'all'
  overlay: HeadroomFacetGrid        // the UNFACETED_KEY facet
  max_facet_count: number           // color max across model facets
  max_overlay_count: number         // color max for overlay mode
}

/** Returns null when points is empty (component renders the empty-state panel). */
export function buildHeadroomGrid(
  points: HeadroomPoint[],
  config: HeadroomBinConfig,
): HeadroomGrid | null
```

Dense expansion synthesizes zero-count cells from the edges arrays so
`HeadroomHeatmapCell` stays the single render contract for filled *and* empty cells
(`x_min`/`x_max`/`y_min`/`y_max` computed from the same edges the sparse cells
carry). Two color maxima are kept because overlay counts are sums over models — a
scale shared with the overlay would wash out every per-model facet (dataviz rule:
same color = same meaning *within* a view).

---

## 2. File map

Every file is NEW. Nothing existing is edited.

| Path | Purpose |
| --- | --- |
| `src/lib/headroom-heatmap-grid.ts` | Shared binning/view-model helper: `resolveXDomain`, `buildHeadroomGrid`, edge formatting (`formatEdge(value, step)`) |
| `src/lib/headroom-heatmap-grid.test.ts` | Helper tests (edges, counts, domain clamping, dense expansion) |
| `src/lib/headroom-heatmap-params.ts` | `HeadroomHeatmapState`, `parseHeadroomHeatmapState`, `buildHeadroomHeatmapQuery`, `headroomHeatmapHref`, `toBinConfig`, defaults + clamps |
| `src/lib/headroom-heatmap-params.test.ts` | Param parse/serialize + round-trip tests |
| `src/components/headroom/HeadroomHeatmap.tsx` | `'use client'` orchestrator: grid build, facet order resolution, dnd-kit facet reorder, controls wiring, `router.push` commits |
| `src/components/headroom/HeadroomFacetPanel.tsx` | Presentational: one facet's 2D-histogram grid + axis tick labels + tooltips |
| `src/components/headroom/HeadroomHeatmapControls.tsx` | View toggle, bin-count selects, X-domain select, reset-order button |
| `src/components/headroom/HeadroomColorLegend.tsx` | Sequential count legend (0 → max gradient bar) |
| `src/components/headroom/HeadroomHeatmap.test.tsx` | Component tests (multiple seeds, faceting, order, overlay, empty state) |
| `src/app/dev/headroom-heatmap/page.tsx` | Demo route: parses `searchParams`, generates fixture points, renders the component |
| `docs/plans/06-r6-headroom-heatmap.md` | This plan |

### Reuse-by-import vs pattern-copy (and why)

| Existing code | Decision | Why |
| --- | --- | --- |
| `binHeadroomPoints`, `UNFACETED_KEY`, Shape-6 types (`@/fixtures/heatmap`) | **Import** | Frozen contract; already computes per-model + `all` facets over one shared domain with edge clamping, and is tested. Re-implementing risks bin-edge drift. |
| `makeHeadroomPoints` (`@/fixtures/heatmap`) | **Import** (demo route + tests) | The fake-data source, seeded and deterministic. |
| `applyManualOrder`, `manualOrderOrUndefined`, `moveItem`, `ordersEqual` (`@/lib/heatmap-order`) | **Import** | Pure string-list utilities with no coupling to `HeatmapAxis`/`TableRow`; exactly the manual-order semantics we need for facet order (unknown keys dropped, missing keys appended, undefined when order matches baseline). |
| `buildHeatmapPivot`, `resolveAxisOrders`, `computeRuleOrder` (`@/lib/heatmap-order`) | **Not used** | Categorical pivot over `TableRow` with measure-mean sorting — wrong model for numeric bins whose order is fixed by arithmetic. Only the facet list is reorderable here. |
| `heatmap-params.ts` parse/serialize functions | **Pattern-copy** into the new params module | Its functions are welded to `HeatmapState` (aggregate filters, `HEATMAP_RESERVED_PARAMS`, axis/color enums). We copy the idioms — first-of-array unwrap, fallback-to-default on invalid, omit-defaults-from-URL, comma-joined order lists with the documented no-comma constraint — onto our own state shape. |
| `ScoreHeatmap.tsx` drag headers, `useTransition` + `router.push(href(next))` commit, empty-state panel, legend layout, `gap-px bg-[var(--border)]` grid styling | **Pattern-copy** | These are unexported internals of `ScoreHeatmap`; copying keeps visual/interaction consistency without touching the shared file. Color function is *not* copied: `scoreColor`'s red→green diverging ramp is for scores; counts need a sequential ramp (new `countColor`). |
| `cn` (`@/lib/cn`), `SearchParamsRecord` type (`@/lib/aggregate-filters`), `SECTION_LABEL` (`@/components/primitives`), dnd-kit | **Import** | Shared utilities/deps already in the repo. |

---

## 3. Rendering approach

### 3.1 The 2D-histogram grid

Same technology as `ScoreHeatmap`: a CSS grid of `div` cells with `gap-px
bg-[var(--border)]` hairlines — no SVG, no new charting dep. Each facet panel:

- **Geometry.** `grid-template-columns: auto repeat(x_bin_count, minmax(0, 1fr))`;
  cells keep `aspect-ratio: 1 / 1` (with a panel `max-width`) so bins read as a
  histogram, not a table. Y bins render **top-down in descending order** so pass
  rate 1.0 sits at the top — the intuitive "headroom" orientation (top-left = high
  pass rate at tight compression = the interesting corner).
- **Axis ticks.** Numeric edge labels (not per-cell labels): Y edges down the left
  gutter, X edges under the bottom row, aligned to grid lines. Label precision
  derives from the step (`decimals = max(0, ceil(-log10(step)))` capped at 3);
  when `x_bin_count > 10`, label every other edge to avoid collisions. Axis titles:
  "achieved compression ratio →" below, "mean pass rate ↑" rotated left (rendered
  once per row of panels, not per panel, to keep facets compact).
- **Cell tooltip** (native `title`, like `ScoreHeatmap`):
  `x ∈ [0.40, 0.60) · pass rate ∈ [0.60, 0.70) · 14 tasks`. Empty cells get
  `No tasks`. No in-cell count text — at 10×10×N facets it is noise; the legend and
  tooltips carry exact values.

### 3.2 Color scale for counts

Sequential single-hue ramp on the theme accent, computed inline:

- `count === 0` → `var(--bg-secondary)` (visibly "empty", distinct from low counts).
- `count > 0` → `color-mix(in oklab, var(--accent) P%, var(--bg-primary))` with
  `P = 12 + 88 * (count / max)` — the 12% floor keeps single-task cells visible.
- `max` is `max_facet_count` in facet view (shared across all model panels so the
  same color means the same count everywhere) and `max_overlay_count` in overlay
  view. Guard `max <= 0` → treat all cells as empty.
- `HeadroomColorLegend` renders a 0 → max gradient bar built from the same
  `countColor` function, with integer end labels, mirroring `ScoreHeatmap`'s legend
  placement (top-right of the section header).

### 3.3 Facets vs overlay

- **`view=facets` (default):** one `HeadroomFacetPanel` per model from
  `grid.facets`, laid out `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4`.
  Panel header = model label (truncated, full label in `title`) + `n tasks·targets`
  point count + a drag handle. All panels share domains, bin edges, and the color
  max — direct visual comparison is the point.
- **`view=overlay`:** a single large panel rendering `grid.overlay` (the fixture's
  `UNFACETED_KEY` facet — counts summed across models over the identical grid).
  "Overlay" here means combined-counts, which is what the frozen cell contract
  supports; per-model translucent layering is explicitly out of scope (a count cell
  set per facet cannot reconstruct per-model alpha blending — noted in §7 only as
  context, not a gap: combined counts answer the same "where is the mass" question).
- **Facet order (the shareable layout).** Baseline order is `localeCompare` of
  model labels. Drag-reorder panel headers via dnd-kit (`rectSortingStrategy`,
  pattern-copied from `ScoreHeatmap`'s sortable headers); on drop, compute
  `manualOrderOrUndefined(next, baseline)` and commit. A "Reset order" button shows
  whenever `facetOrder` is set. In overlay view the order controls hide but the
  param is preserved untouched, so toggling back restores the layout.

### 3.4 Controls (`HeadroomHeatmapControls`)

One control row above the panels; every change commits through
`startTransition(() => router.push(headroomHeatmapHref(next)))` (dim content via
`isPending`, exactly the `ScoreHeatmap` idiom):

- **View:** segmented Facets / Overlay toggle.
- **X bins / Y bins:** selects with `5 / 10 / 15 / 20 / 25` (parser accepts any
  int in `[2, 50]` so hand-edited URLs work).
- **X domain:** select — `Auto (data extent)`, `0 – 1`, `0 – 2` (`0 – 2` matches
  `FIXTURE_TARGET_RATIOS` max; fixed domains make bin edges land on round numbers
  and keep two shared links comparable).
- **Reset order** (conditional, §3.3).

### 3.5 URL-persisted state — exact params

Owned entirely by the demo route's search params via the NEW
`src/lib/headroom-heatmap-params.ts` (hand-rolled, mirroring `heatmap-params.ts`;
nuqs is not a repo dependency). Defaults are omitted from the URL so the bare route
is canonical; invalid values fall back to defaults, never throw.

| Param | Encoding | Default (omitted) | Parse rule |
| --- | --- | --- | --- |
| `view` | `facets` \| `overlay` | `facets` | unknown → default |
| `xBins` | int | `10` | non-int → default; clamp to `[2, 50]` |
| `yBins` | int | `10` | same |
| `xDomain` | `min:max`, e.g. `0:2` (colon — values contain `.` and `-` stays free for future negatives) | unset (data extent) | needs two finite floats with `min < max`, else unset |
| `facetOrder` | comma-joined model labels, e.g. `facetOrder=google/gemini-3-flash,openai/gpt-5.5-codex` | unset (localeCompare baseline) | split on `,`, trim, drop empties; unknown labels dropped and missing ones appended at render time via `applyManualOrder`. Same documented constraint as `heatmap-params`: keys must not contain literal commas (canonical model labels — including `enc -> dec` — never do; spaces and `>` are safe in query values and `URLSearchParams` percent-encodes them) |
| `seed` | int | `1` | non-int → default |

Round-trip law (tested): `parseHeadroomHeatmapState(recordOf(buildHeadroomHeatmapQuery(s))) ≡ s`
for every valid state, and `buildHeadroomHeatmapQuery(defaults).toString() === ''`.

### 3.6 Demo route (`src/app/dev/headroom-heatmap/page.tsx`)

Server component, async `searchParams` (Next 16 promise form, as in
`src/app/aggregate/heatmap/page.tsx`):

```ts
const state = parseHeadroomHeatmapState(await searchParams)
const points = [
  ...makeHeadroomPoints({ seed: state.seed }),
  ...makeDirectBaselinePoints(state.seed),   // local helper in page.tsx, see §4
]
return <HeadroomHeatmap points={points} state={state} />
```

Page chrome: title "Headroom heatmap (dev)", one-line description of axes/color, a
`seed` link row (seeds 1 / 21 / 99) for eyeballing robustness, and a footnote that
data is `makeHeadroomPoints` fixture output. No `dynamic = 'force-dynamic'` needed —
reading `searchParams` already opts the route into dynamic rendering, and there is
no DB access. Props crossing the RSC boundary (`points`, `state`) are plain JSON —
serializable. The route is intentionally not added to the shared nav (shared-file
freeze); it is reached by URL.

---

## 4. Edge cases

| Case | Behavior |
| --- | --- |
| **Empty points** (`points.length === 0`) | `buildHeadroomGrid` returns `null`; component renders the `ScoreHeatmap`-style empty panel ("No headroom points to bin.") instead of a zero-sized grid. Controls stay visible so state remains editable. |
| **Empty bins** | Dense expansion fills `count: 0` cells with correct edges; rendered `var(--bg-secondary)` with a `No tasks` tooltip — visually distinct from count ≥ 1. |
| **Single-point / degenerate X domain** (all achieved ratios equal, `x_domain` unset) | `resolveXDomain` reproduces the fixture rule exactly: `min === max` widens to `[min, min + 1]`, so helper-computed edges always match `binHeadroomPoints`' cell edges. Tested against the fixture output for consistency. |
| **Null target (direct baseline points)** | `target_compression_ratio` is not a binning input — `achieved_compression_ratio` is always a number, so direct points bin normally (clustering near ratio 1.0). The fixture generator only emits encdec points, so the demo page includes a small deterministic `makeDirectBaselinePoints` helper (hand-built `HeadroomPoint[]` with `target_compression_ratio: null`, `experiment_kind: 'humaneval_direct'`) to prove the path. See morning note 3. |
| **Points outside a fixed domain** (`xDomain=0:1` with achieved ratios up to ~2.2) | `binHeadroomPoints` clamps into the edge bins (fixture-tested behavior). The component surfaces this honestly: when `state.x_domain` is set and any point falls outside, the panel footnote appends "edge bins include out-of-range points" (computed from raw points vs domain in the grid helper: `clamped_count`). |
| **Facet with no points** | Cannot arise from binning (facets are derived from points), but `facetOrder` may reference models absent from the current data (stale shared link, different seed). `applyManualOrder` drops unknown keys and appends new ones — no crash, no phantom panel. |
| **`max === 0` / all cells empty** | Guarded in `countColor`; legend renders `0 – 0` with a flat bar. Only reachable via the empty-points path in practice. |
| **Bin counts from hostile URLs** (`xBins=0`, `-3`, `1e9`, `abc`) | Parser clamps to `[2, 50]` or falls back to 10; `binHeadroomPoints` is never called with a non-positive bin count. |
| **Facet keys containing spaces/`->`** | Enc-dec labels like `openai/enc -> anthropic/dec` are preserved by the fixture's nested-map keying (fixture-tested) and survive the `facetOrder` comma encoding since labels never contain commas. |

---

## 5. Acceptance mapping (REL-1)

| Criterion | Design element | Fixture scenario / test |
| --- | --- | --- |
| "Renders the binned heatmap against fake data" | `HeadroomHeatmap` + `buildHeadroomGrid` over `binHeadroomPoints`; demo route feeds `makeHeadroomPoints({ seed })` | Component render tests at seeds 1 / 21 / 99 assert a full `xBins × yBins` cell grid per facet, no `NaN` in any inline style, tooltip text on a known cell; demo route at `/dev/headroom-heatmap` |
| "Per-model faceting" | `view=facets` default; one `HeadroomFacetPanel` per `grid.facets` entry; shared domain + shared color max | Test: 4 fixture models → 4 panels with model-label headers; per-facet cell counts sum to that model's point count (mirrors the fixture test's invariant, now at component level) |
| "…/overlay" | `view=overlay` renders the `UNFACETED_KEY` facet as one combined panel | Test: `view: 'overlay'` → exactly 1 panel; its total count equals `points.length` |
| "Shareable, URL-persisted axis-order layout" | `facetOrder` (+ `view`, `xBins`, `yBins`, `xDomain`, `seed`) in search params; `headroomHeatmapHref` produces the shareable link; drag commits via `router.push` | Params round-trip test (§6); component test: `state.facetOrder` reorders panels; drag-end handler commits `manualOrderOrUndefined` result (router mock asserts the pushed href contains the reordered `facetOrder`) |
| "It should look good" (advisor surface) | Sequential accent ramp with empty-cell distinction, aligned edge ticks, aspect-ratio cells, responsive facet grid, legend, `useTransition` dimming | Visual pass on the demo route at all three linked seeds before hand-off (manual step in §6.4) |

---

## 6. Test plan (colocated vitest, jsdom, existing config — no config changes)

### 6.1 `src/lib/headroom-heatmap-grid.test.ts`

- **Edges:** `x_edges`/`y_edges` lengths are `bins + 1`; first/last equal the
  domain; steps uniform to 1e-6; helper edges equal the `x_min`/`x_max` values on
  `binHeadroomPoints`' sparse cells for the same explicit domain (the no-drift
  invariant).
- **Counts:** for `makeHeadroomPoints({ seed })` at seeds 1 and 21: every facet's
  dense-grid total equals that model's point count; overlay total equals
  `points.length`; dense grid has exactly `xBins × yBins` cells per facet.
- **Domain resolution:** unset `x_domain` → data extent; all-equal X values →
  `[v, v + 1]` (fixture parity); explicit domain passes through untouched.
- **Domain clamping:** point with `achieved_compression_ratio: 99` under
  `x_domain: [0, 2]` lands in the last X bin of the dense grid and increments
  `clamped_count`; in-domain data → `clamped_count === 0`.
- **Color maxima:** `max_facet_count` = max over model facets only;
  `max_overlay_count` ≥ `max_facet_count`; empty input → `null`.

### 6.2 `src/lib/headroom-heatmap-params.test.ts`

- **Round-trip:** for a table of valid states (defaults; overlay + custom bins;
  `x_domain: [0, 2]`; `facetOrder` containing `a/enc -> b/dec` and slashes; seed
  21), `parse(recordOf(build(state)))` deep-equals the state.
- **Defaults:** `build(defaults).toString() === ''`; `parse({})` yields defaults;
  `headroomHeatmapHref(defaults) === '/dev/headroom-heatmap'`.
- **Fallbacks/clamps:** `xBins=abc|0|999`, `xDomain=2:0|1|x:y`, `view=nope`,
  `seed=1.5`, array-valued params (first-wins, per repo idiom) — each falls back or
  clamps as specified in §3.5.

### 6.3 `src/components/headroom/HeadroomHeatmap.test.tsx`

`next/navigation` mocked as in `ScoreHeatmap.test.tsx`.

- **Multiple seeds:** render with `makeHeadroomPoints({ seed })` for 1, 21, 99 —
  4 facet panels, `xBins × yBins` cells each, no `style` attribute containing `NaN`.
- **Overlay:** `view: 'overlay'` → 1 panel; combined count in header matches
  `points.length`.
- **URL-persisted order:** `facetOrder` in state reorders panel headers (assert
  header text sequence); baseline (no `facetOrder`) is localeCompare order;
  `facetOrder` with an unknown model neither crashes nor renders an extra panel.
- **Order commit:** invoke the drag-end handler path (as `ScoreHeatmap` tests do
  via state; plus a direct unit call on the exported handler helper if extraction
  is cleaner) and assert `router.push` received an href whose `facetOrder` matches
  the move; reset button pushes an href without `facetOrder`.
- **Empty state:** `points: []` renders the empty panel and no grid cells.
- **Edge-clamp note:** fixed narrow domain + wide-ratio point → footnote text
  present.

### 6.4 Verification (implementation-time checklist)

`pnpm test`, `pnpm lint`, `pnpm build`, then a manual pass of
`/dev/headroom-heatmap` at seeds 1/21/99 exercising: bin-count changes, domain
presets, facet drag + shared-link reload (order survives refresh), overlay toggle
round-trip, browser back/forward restoring layouts.

---

## 7. Morning notes (for Danielle)

1. **The "new shared binning helper" already half-exists in the frozen fixture.**
   `src/fixtures/heatmap.ts` ships `binHeadroomPoints` + tests. This plan reuses it
   for the bin math and puts the NEW helper (`headroom-heatmap-grid.ts`) at the
   dense-grid/view-model layer. If you'd rather the binning math live in `src/lib`
   long-term, that means *moving* code out of a frozen fixture file — needs your
   call; not planned here.
2. **`binHeadroomPoints` doesn't return the resolved default domain**, so the new
   helper re-implements the 3-line extent rule and always passes explicit domains.
   Drift risk is covered by a parity test (§6.1), but exporting a tiny
   `resolveDefaultDomain` from the fixture would be a cleaner additive change if a
   fixture touch is ever sanctioned.
3. **`makeHeadroomPoints` cannot emit direct-baseline points** (always encdec with a
   numeric target). The demo route hand-rolls a few `target_compression_ratio: null`
   points to exercise Shape 6's null-target case. An additive `layout`/kind option on
   the generator would be nicer if REL-1's real data will include direct baselines.
4. **"Overlay" is implemented as combined counts** (the fixture's `all` facet), not
   translucent per-model layering — the frozen cell contract carries counts, not
   per-model stacks within a cell. If you want true multi-model alpha overlay,
   that's a contract conversation.
5. **`UNFACETED_KEY === 'all'`** would collide with a model literally named `all`.
   Not realistic for canonical labels, but it's a latent contract quirk worth
   knowing.
6. **The demo route is unlinked** (`/dev/headroom-heatmap`) because nav/AppShell are
   frozen shared files. If R6 graduates, it needs a nav entry (one-line shared
   change) and likely a real route name.
