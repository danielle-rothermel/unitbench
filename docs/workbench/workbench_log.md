# Workbench Log

## Status

| stage | state | notes |
|-------|-------|-------|
| 0 critique fixes | in_progress | 0.1 diagnostics (P0), 0.2 heatmap rebuild (P1×2), 0.3 disclosure (P2) done; typography, power layer pending |
| 1 IA + design system | pending | |
| 2 parser playground | pending | gate met: dr-code migration stage done |
| 3 provider query page | pending | gate met: dr-providers v0.2 done |
| 4 graph viewer | pending | gate met: dr-graph exists |
| 5 projection read layer + dashboard | pending | |
| 6 replay viewer | pending | |

## Environment

- node v22.23.0 · pnpm 9.15.2 · Playwright 1.61 (chromium installed)
- DATABASE_URL reachable: y (Neon, `published_predictions` 74,032 rows on 2026-07-04)
- Library repos present: dr-code, dr-providers, dr-graph, dr-serialize, dr-platform, whetstone-ai (all read-only except new `serve` branches)
- Verification gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, e2e via `pnpm test:e2e` (Playwright, dev server on port 3211)

## Entries

### 2026-07-04 — iteration 1: bootstrap + stage 0.1 (diagnostics integrity, P0)

- Landed: `workbench` branch; `typecheck` + `test:e2e` scripts; Playwright
  harness (`playwright.config.ts`, `e2e/home.spec.ts` smoke test asserting
  home renders with zero console errors); vitest now excludes `e2e/**`.
- Stage 0.1 fix in `src/lib/prediction-diagnostics.ts`:
  - `buildScoringStage`: `scoring_status === 'scored'` now maps to new
    neutral `completed` status with statusLabel `scored` (blue pill) —
    stage completion no longer reads "Passed" on failed predictions.
  - `buildEvaluationStage` + `derivePrimaryFailureReason`: when
    `failures > total`, render explicit marker
    "N failures reported for M evaluation cases — inconsistent data"
    (new `inconsistent` status, yellow pill) instead of "N/M failed";
    no silent normalization. Exported `formatInconsistentEvaluation`.
  - `PipelineStageInfo` gained optional `statusLabel` display override;
    `PredictionDiagnosticsPanel` renders it and maps the two new statuses
    (completed → blue tokens, inconsistent → yellow tokens).
- Tests: 2 new unit tests (scoring neutral on failed prediction;
  failures>total flags inconsistent across stage/testSummary/primary
  reason) + fixture-driven component test file
  `PredictionDiagnosticsPanel.test.tsx` (marker always present when
  failures>total, "N/M failed" never rendered; scoring pill reads
  "scored" not "passed").
- Verified: `pnpm typecheck` ✓, `pnpm lint` ✓, `pnpm test` ✓ (20 files,
  132 tests), `pnpm build` ✓, `pnpm test:e2e` ✓ (1 test), detector `[]`
  on changed tsx.
- Choices recorded: `completed` uses `--blue` tokens (neutral, distinct
  from green pass); `inconsistent` uses `--yellow` tokens with explicit
  "inconsistent data" status word (distinct from pending by wording);
  inconsistency check requires both counts present — a null total stays
  `unknown`, an explicit total smaller than failures flags.
- Noted for later stage-0 work: AppShell brand + page title are both
  `<h1>` (two h1s per page) — fold into typography/consistency pass.

### 2026-07-04 — iteration 1 (cont.): stage 0.2 heatmap rebuild in place (P1×2)

- Landed: `ScoreHeatmap.tsx` rebuilt in place.
  - ARIA grid semantics: `role="grid"` (aria-label = heatmap title),
    header `role="row"` with `columnheader` cells (corner = y-axis
    label), each data row `role="row"` with `rowheader` (aria-label =
    y value) and `gridcell` cells; cell links carry accessible names
    `"<y>, <x>: <value>"`. Drag buttons keep their `Drag row/column X`
    labels but no longer *are* the row's only name.
  - Contrast: new `src/lib/heatmap-color.ts` — light-luminance ramp
    (rgb(233,158,150) → rgb(141,211,158)) whose every interpolation
    holds ≥4.5:1 (worst ≈7.4:1) against `--text-primary`
    (≈rgb(17,37,43), computed from the OKLCH token); cell text is
    always dark now (was white-on-mid-olive 3.76:1). Legend gradient
    uses the same endpoints. Unit test sweeps t∈[0,1] asserting ≥4.5.
  - Hydration: DndContext + SortableContext render only after
    hydration via `useSyncExternalStore` gate (`useHydrated`); SSR and
    first client render are identical static grids, drag upgrades
    post-mount. (eslint react-hooks/set-state-in-effect forbids the
    setState-in-effect mount-gate idiom.)
  - Degenerate all-equal color scale now renders mid-ramp instead of
    the old solid red (recorded choice; old behavior looked like an
    all-failed matrix).
- Tests: new grid-semantics component test; `heatmap-color.test.ts`
  ramp/contrast sweep; `e2e/heatmap.spec.ts` — accessible grid +
  zero console errors (regression for the hydration bug) and in-page
  computed worst-case contrast ≥4.5:1 across all data cells.
- Verified: typecheck ✓ lint ✓ unit 136 ✓ build ✓ e2e 3/3 ✓ detector
  `[]` on ScoreHeatmap files.

### 2026-07-04 — iteration 1 (cont.): stage 0.3 detail-page disclosure (P2)

- Landed: `CodePane` gained `collapsible`/`defaultOpen` props rendered
  as native `<details>/<summary>` (header chips with line/char/byte
  counts double as the collapsed summary; chevron via `group-open`);
  non-collapsible panes unchanged. The five debug JSON payloads on
  `PredictionDetailPage` are now `collapsible defaultOpen={false}`;
  prompt/code/raw-generation panes stay open. Removed the duplicate
  source/kind chips from the Provenance section (header tags already
  carry both; ID chips never did).
- Tests: component test asserting all `<details>` payloads start
  closed and Prompt/Code are not collapsible; existing dup-count
  assertions updated (2 → 1). `e2e/prediction-detail.spec.ts` walks
  table → detail, asserts every payload starts collapsed and one
  toggles open.
- Verified: typecheck ✓ lint ✓ unit 137 ✓ build ✓ e2e 4/4 ✓ detector
  `[]`.

### Next iteration

Stage 0.4 typography/consistency (Space Grotesk to display only, ≤72ch
prose, filter grid alignment, `unknown` vs `—` unification, real arrow
glyph, single h1 per page) and 0.5 power layer (`/` focuses filter,
`j/k` row nav, wire or drop the "12 visible columns" label).
