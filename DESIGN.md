# Unitbench Design System

Register: **product** — instrument-panel density, light mode only, one
shared "inspect anything" pattern. Tokens are the single source of
truth; components never inline ad-hoc colors. See `PRODUCT.md` for the
product framing and `docs/workbench/overall.md` for the lane IA.

## Tokens (`src/app/globals.css`)

All colors are OKLCH CSS custom properties on `:root`.

| group | tokens |
|-------|--------|
| surfaces | `--bg-primary` `--bg-secondary` `--bg-tertiary` `--bg-hover` `--bg-code` |
| borders | `--border` `--border-subtle` `--border-strong` |
| text | `--text-primary` `--text-secondary` `--text-muted` |
| accent | `--accent` `--accent-hover` `--accent-bg` `--accent-ring` |
| status | `--green(-bg)` `--red(-bg/-border)` `--yellow(-bg/-border)` `--blue(-bg)` |
| syntax | `--syntax-keyword/string/number/function/builtin/comment/punctuation` |
| motion | `--ease-out` `--dur-fast` (honors `prefers-reduced-motion`) |

Heatmap cell scale lives in `src/lib/heatmap-color.ts` (light-luminance
ramp; every interpolation ≥4.5:1 against `--text-primary` — do not
darken endpoints without re-running its contrast sweep test).

## Fonts

- `--font-display` **Space Grotesk** — true display moments only: page
  `h1`, section `h2`, the brand wordmark. Never labels or body.
- `--font-sans` **Hanken Grotesk** — body, labels, UI chrome.
- `--font-mono` **Fira Code** (ligatures on) — code, IDs, numerics,
  data cells, keyboard hints.

Rules: exactly one `h1` per page (the page title; the sidebar wordmark
is a styled span). Prose capped at ~72ch. `tabular-nums` right-aligned
for numeric table cells. Missing data renders `—` (never "unknown").
Real glyphs (`←`, `→`, `↕`), not ASCII sketches.

## Primitives (`src/components/primitives.tsx`)

- `SECTION_LABEL` — 11px tracked uppercase label class for section
  headers and stat labels.
- `Tag` — small tone-colored chip (`neutral/accent/blue/green/yellow/red`).
- `ResultBadge` — state pill with dot; color never the sole signal
  (state word always rendered).
- `Dot` — 3px separator dot.

## Components

| component | path | job |
|-----------|------|-----|
| `AppShell` | `components/AppShell.tsx` | fixed sidebar with lane nav (Data / Replay / Playgrounds / Design / Lab) |
| `GenericTable` | `components/GenericTable.tsx` | config-driven data table: sticky headers, sort buttons, pagination, row links, `/` + `j`/`k` shortcuts |
| `ScoreHeatmap` | `components/ScoreHeatmap.tsx` | ARIA-grid pivot heatmap, drag-reorderable axes (post-hydration), token ramp cells |
| `Inspector` | `components/inspector/Inspector.tsx` | the shared "inspect anything" block: provenance links + copyable id chips + collapsible JSON payload panes |
| `CodePane` | `components/code/CodePane.tsx` | highlighted code panel with line/char/byte chips; optional `collapsible`/`defaultOpen` via native `<details>` |
| `TextPanel` | `components/panels/TextPanel.tsx` | plain-text panel with stats header |
| `ErrorSection` | `components/panels/ErrorSection.tsx` | setup/error callouts |
| `StatCell` | `components/stats/StatCell.tsx` | label + value stat cell (`—` for missing) |
| `IdChip` | `components/chips/IdChip.tsx` | click-to-copy labeled id chip |
| `TableFilters` / `AggregateFilterFields` | `components/…` | text/range inputs + facet checkboxes/selects, top-aligned label rows |
| `PredictionDiagnosticsPanel` | `components/prediction/…` | pipeline stage pills (passed/failed/pending/skipped/unknown/completed/inconsistent) |

## Patterns

- **URL-addressable state** — filters, sort, axes, pagination all live
  in the query string; views are shareable and reproducible.
- **Inspect anything** — every payload surface composes `Inspector`
  (provenance + copy + collapsible code panes); do not hand-roll
  payload sections.
- **Stage completion ≠ outcome** — pipeline pills render neutral
  "scored"/"completed" states distinct from pass/fail; impossible data
  renders an explicit `inconsistent data` marker, never silently
  normalized.
- **Keyboard layer** — `/` focuses the first filter, `j`/`k` walk table
  rows (`useTableShortcuts`); hints shown in table chrome.
- **Charts** — visx only, themed exclusively through
  `src/lib/chart-theme.ts` (CSS-var fills/strokes; mono tick labels).
  Demo: `/lab/chart-demo`.

## Lanes

`Data` (tables, aggregation, heatmap — live) · `Replay` · `Playgrounds`
· `Design` (planned, filled by workbench stages 2–6) · `Lab`
(`/lab` route group: disposable prototypes, design-polish-exempt,
nothing outside `/lab` may import from it).
