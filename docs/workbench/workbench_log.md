# Workbench Log

## Status

| stage | state | notes |
|-------|-------|-------|
| 0 critique fixes | done | all acceptance checks green: diagnostics integrity, heatmap grid/contrast/hydration, disclosure, typography, power layer |
| 1 IA + design system | done | lane nav + /lab, DESIGN.md, visx chart theme + demo, Inspector used by detail page |
| 2 parser playground | done | facade (dr-code PR #10) + gen:api client + /playgrounds/parser + e2e vs local facade |
| 3 provider query page | done | facade + variance machinery (dr-providers PR #4) + /playgrounds/provider + e2e vs FixtureProvider |
| 4 graph viewer | done | /design/graph: schema-validated paste/upload, DAG render, node inspector |
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

### 2026-07-04 — iteration 1 (cont.): stages 0.4 typography + 0.5 power layer → stage 0 done

- 0.4 typography/consistency:
  - `font-display` (Space Grotesk) removed from label/body duty:
    SECTION_LABEL, GenericTable `th`, heatmap axis header cells,
    CodePane `h3`, AppShell nav group labels + wordmark subtitle.
    Display font remains on page `h1`s, section `h2`s, and the brand
    wordmark only.
  - AppShell brand `h1` → `span` — exactly one `h1` per page now.
  - Prose capped at `max-w-[72ch]`: home hero, table page description,
    aggregate shell description (heatmap explainer done in 0.2).
  - `StatCell` missing value `unknown` → `—` (matches heatmap).
  - ASCII `<-` back-glyphs → `←` (3 files).
  - Filter rows `items-end` → `items-start` in TableFilters +
    AggregateFilterFields — labels top-align, "Include model" no
    longer floats mid-air.
- 0.5 power layer:
  - New `useTableShortcuts` hook wired into GenericTable: `/` focuses
    the first text filter (`data-shortcut-filter`), `j`/`k` move focus
    down/up rows (first link/button per row, `data-row`/`tabIndex=-1`
    fallback), guarded against typing contexts and modifier keys.
    Hint `"/ filter · j/k rows"` shown in the table chrome bar.
  - "12 visible columns" → "12 columns" (dropped the implied
    column-management claim; count itself is honest and useful).
- Tests: `e2e/table-shortcuts.spec.ts` proves `/` focuses filter,
  typing `j` in the filter types (no row nav), and `j`/`j`/`k` walks
  row focus 0→1→0.
- Verified: typecheck ✓ lint ✓ unit 137 ✓ build ✓ e2e 5/5 ✓ detector
  `[]` on all changed tsx.
- **Stage 0 acceptance checklist — all met:** pnpm gates green;
  heatmap zero console errors + role=grid + accessible cell names +
  ≥4.5:1 in-page contrast (e2e); failures>total never renders without
  marker (fixture component test); failed prediction's scoring stage
  reads "scored" not "Passed"; payloads collapsed by default (e2e);
  `/` and `j/k` work (e2e); detector clean.

### 2026-07-04 — iteration 2: stage 1 IA restructure + design system

- Lane IA: `AppShell` nav regrouped into lanes — Data (6 tables +
  Heatmap + Aggregation), Replay/Playgrounds/Design (muted "planned"
  placeholders until stages 2–6), Lab. Existing URLs unchanged
  (decision recorded in overall.md: URL state is a feature, lanes are
  nav groups, no redirects). New `/lab` route group: index page +
  `/lab/chart-demo`.
- Chart system: **visx** chosen (decision + rationale in overall.md);
  `src/lib/chart-theme.ts` maps OKLCH tokens into axis/grid/point/
  series props (CSS `var(--…)` strings pass straight into SVG);
  fixture-driven demo scatter (correctness-vs-compression shape) at
  `/lab/chart-demo` — no DB, no network.
- `DESIGN.md`: tokens, fonts + typography rules, primitives, component
  inventory, patterns (URL state, inspect-anything, completion≠outcome,
  keyboard layer, charts), lane map.
- Inspector: new `src/components/inspector/Inspector.tsx` — provenance
  links + copyable id chips + collapsible JSON payload panes; the
  prediction detail page now composes it for both its provenance block
  and its Debug payloads section (two calls preserve the page's
  reading order; both sections are optional by design).
- Test hardening: playwright expect timeout 15s (dev-server on-demand
  compiles under parallel workers); shortcut e2e retries `/` press
  until the post-hydration listener is live (`toPass`).
- Tests: `e2e/lab-and-lanes.spec.ts` — lanes visible, heatmap/tables/
  lab reachable through the nav; chart demo renders ≥9 circles with
  `var(--…)` fills.
- Verified: typecheck ✓ lint ✓ unit 137 ✓ build ✓ e2e 7/7 twice ✓
  detector `[]`.
- **Stage 1 acceptance — all met:** pages reachable under new IA;
  DESIGN.md exists; themed demo chart renders in /lab; inspector used
  by prediction detail; pnpm + e2e green.

### 2026-07-04 — iteration 2 (cont.): stage 2a dr-code serve facade

- Landed in **dr-code** (branch `serve`, worktree at
  `../dr-code-serve`, PR
  https://github.com/danielle-rothermel/dr-code/pull/10 — draft):
  - `serve` branched from `composable-migration` HEAD e1a9dbd (main
    lacks the parser nucleus; composable-migration itself untouched).
  - `[serve]` optional extra (fastapi, uvicorn); httpx added to dev
    group for TestClient.
  - `dr_code.serve.explain.explain_extraction(text, profile_id,
    parser_version, code_field, stages=…)` → `ExtractionExplanation`:
    unwrap stage (method + metadata), candidate tree
    (selected/rejected/not_reached + rejection reasons replaying the
    canonical helper checks), selection rationale, canonical
    `CodeExtractionResult` (test-asserted equal to
    `extract_code_with_profile`). Both v1 profiles supported
    (best-effort + strict field-marker).
  - FastAPI app: `POST /explain`, `GET /profiles`, `GET /health`.
    Typer CLI `uv run python -m dr_code.serve serve` binds
    127.0.0.1 only (host is not an option); `openapi` subcommand dumps
    the schema for unitbench's `pnpm gen:api`.
- Verified in dr-code: 12 new tests; full suite 320 passed / 1 skipped;
  ruff + ty clean; `openapi` smoke shows paths
  /explain /health /profiles.
- Remaining for stage 2 (next iteration): `pnpm gen:api`
  (openapi-typescript client committed in unitbench),
  `/playgrounds/parser` page (paste text, toggle stages, candidate
  tree with winner rationale, Inspector for payloads), e2e driving the
  page against the local facade with fixture text (no external
  network).

### 2026-07-04 — iteration 3: stage 2b parser playground → stage 2 done

- dr-code serve branch: added localhost-only CORS
  (`allow_origin_regex` for localhost/127.0.0.1 any port) with
  allow/reject regression tests — browser at the Next.js origin can
  call the facade directly, nothing non-local can (pushed, PR #10).
- unitbench client: `pnpm gen:api` (`scripts/gen-api.mjs`) dumps the
  schema via `uv --directory ../dr-code-serve run python -m
  dr_code.serve openapi` (override dir with `DR_CODE_SERVE_DIR`) and
  runs `openapi-typescript`; committed artifacts
  `src/lib/api/dr-code-openapi.json` + `dr-code.ts`; typed
  `openapi-fetch` client in `src/lib/api/dr-code-client.ts`
  (base URL `NEXT_PUBLIC_DR_CODE_SERVE_URL`, default 127.0.0.1:8321).
- `/playgrounds/parser`: paste text, profile select (both v1
  profiles), stage toggle chips (unwrap/candidates/selection/result),
  Explain → unwrap method+metadata tags, candidate tree
  (selected/rejected/not_reached cards with rejection reasons,
  selected pane open), winner rationale, extracted-code pane, raw
  explanation via `Inspector`. Marked local-only; facade-down renders
  a setup callout with the start command. Nav: Playgrounds lane now
  links Parser.
- Playwright: `webServer` is now an array (Next dev + facade on 8321,
  both reuse existing locally). e2e drives the page with fixture text
  only — no external network: full flow (candidate tree + rationale +
  extracted code) and stage-toggle filtering.
- eslint: `.mjs` added to the lint file glob (scripts/gen-api.mjs).
- Verified: typecheck ✓ lint ✓ unit 137 ✓ build ✓ e2e 9/9 ✓ detector
  `[]`; dr-code suite for CORS change 7/7 app tests, ruff clean.
- **Stage 2 acceptance — all met:** facade unit-tested in dr-code;
  e2e drives the page against the local facade with fixture text; no
  external network.

### 2026-07-04 — iteration 3 (cont.): stage 4 graph viewer

- Schema: `pnpm gen:graph-schema` (`scripts/gen-graph-schema.mjs`)
  exports `GraphSpec.model_json_schema()` from ../dr-graph (read-only;
  `DR_GRAPH_DIR` override) into committed
  `src/lib/api/graph-spec-schema.json`. **Upstream note for dr-graph:**
  its schema declares `input_bindings` values as BindingRef objects
  only, but the model accepts and serializes `"node.field"` strings
  (before-validator + serializer) — the regen script widens that one
  property to `anyOf [string, BindingRef]` to match the real wire
  format.
- Fixtures: `src/lib/design/fixtures/{direct,encdec}-graph.json`
  extracted from dr-graph's golden canonical payloads.
- `src/lib/graph-spec.ts`: Ajv 2020-12 validation (`parseGraphSpec`
  with schema-pointer error strings + terminal-node existence check)
  and `layoutGraphSpec` (dependency-layered columns, externals at
  depth 0, typed edges). 6 unit tests incl. both fixtures.
- `/design/graph` (`GraphViewer`): paste / upload / sample buttons →
  validate → custom SVG DAG from tokens (terminal node accent,
  externals dashed, edge labels `field → input`); node click opens the
  full node spec in the Inspector. Design lane now links Graph viewer.
- Verified: typecheck ✓ lint ✓ unit 143 ✓ build ✓ e2e 12/12 ✓
  detector `[]`.
- **Stage 4 acceptance — all met:** renders the repo's fixture specs
  (direct, enc-dec); invalid spec shows the schema error; e2e green.

### 2026-07-04 — iteration 4: stage 3 provider query page + variance

- **dr-providers** (branch `serve`, worktree `../dr-providers-serve`,
  draft PR https://github.com/danielle-rothermel/dr-providers/pull/4;
  branched from composable-migration 4c3434e, untouched):
  - No variance/canary machinery existed in the library yet — the
    brief assumes it; implemented it library-side as
    `dr_providers.serve.runner` (recorded conservative choice: logic
    stays out of the app; the runner is the reusable machinery).
  - `QuerySpec` (declarative provider_kind/model/messages/knobs) →
    kernel request via the v0.2 config factories; `run_query` applies
    `with_conformance_warnings`, returns wire payload + response or
    the structured `ProviderFailure` record; `run_variance` fans
    prompt × models × N over any `Provider`, per-model dispersion
    (failures, distinct outputs, length stats) + JSONL-able records.
  - FastAPI facade: POST /build_payload (422 with failure record on
    UnsupportedControlError), POST /query, POST /variance (samples
    ≤25, models ≤8), GET /health. Provider choice per request:
    scriptable FixtureProvider (default) or live (requires the
    config's API key env; 424 `missing_api_key` otherwise — never
    exercised by tests). Localhost-only CORS + bind; typer CLI on
    port 8322 with `openapi` dump. 14 unit tests; full suite 97
    passed; ruff + ty clean.
- **unitbench**: `scripts/gen-api.mjs` generalized to a facade list
  (dr-code + dr-providers; `DR_*_SERVE_DIR` overrides); committed
  dr-providers schema/types + typed client (port 8322).
  `/playgrounds/provider`: request builder (provider kind, model,
  temperature, token limit, prompt), fixture outcome controls, wire
  payload preview with endpoint path, response with conformance
  violations as yellow warning rows, failure record card with Retry,
  usage/cost stat cells, Inspector raw payloads; variance mode
  section → per-model dispersion table + client-side JSONL download +
  report Inspector. Nav: Playgrounds lane links Provider. Playwright
  boots the facade as a third webServer.
- e2e (FixtureProvider only, no keys, no network): payload preview +
  fixture send; token_limit_exceeded conformance violation rendered;
  variance across 2 models × 3 samples with 6-record JSONL download.
- Verified: dr-providers ruff/ty/97 tests ✓; unitbench typecheck ✓
  lint ✓ unit 143 ✓ build ✓ e2e 15/15 ✓ detector `[]`.
- **Stage 3 acceptance — all met:** e2e green using FixtureProvider
  only; page clearly marked local-only; no keys read in tests.

### Next iteration

Stage 5 — projection read layer + dashboard: projection consumer
sketch (design commit); read-layer interface over `published_*`
tables behind one module; Data-lane dashboard with
correctness-vs-compression scatter (click-through to prediction
detail) + one distribution view; live Neon locally. Then stage 6
(replay viewer).
