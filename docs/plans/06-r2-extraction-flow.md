# R2 — Extraction-flow visualizer (REL-3)

Status: PLAN — implementation not started. Written against the frozen fixture contract
(`src/fixtures/extraction.ts`, `src/fixtures/primitives.ts`,
`docs/plans/05-r0-fixture-shapes.md`). No shared files are edited; every file below is new.

Purpose: a single-sample visualizer of the code → extraction → tests journey, used to
validate infra behavior against fake data. It renders the code input, the
extracted/parsed functions (the selection story: which functions were found, their
arity/signatures, which one was selected and how that relates to `entry_point`), and
per-test results, legibly, for every failure path the pipeline can produce.

---

## 1. Component API

All props are typed directly as fixture types imported from `@/fixtures/extraction`
and `@/fixtures/primitives` — no re-mapping layer, so the D3 real-data swap feeds the
same component a SQL-derived `ExtractionFlowSample` untouched.

```ts
// src/components/extraction-flow/ExtractionFlowView.tsx  (no directive; server-compatible)
import type { ExtractionFlowSample } from '@/fixtures/extraction'

type ExtractionFlowViewProps = {
  sample: ExtractionFlowSample
}
export function ExtractionFlowView({ sample }: ExtractionFlowViewProps): ReactNode
```

```ts
// src/components/extraction-flow/FunctionSelectionList.tsx
import type { ParsedFunction } from '@/fixtures/extraction'

type FunctionSelectionListProps = {
  parsed_functions: ParsedFunction[]
  best_function_name: string | null
  entry_point: string
}
export function FunctionSelectionList(props: FunctionSelectionListProps): ReactNode
```

```ts
// src/components/extraction-flow/PerTestResultsTable.tsx
import type { PerTestResult } from '@/fixtures/extraction'
import type { EvaluationCaseStatus } from '@/fixtures/primitives'

type PerTestResultsTableProps = {
  per_test_results: PerTestResult[]
  status_counts: Partial<Record<EvaluationCaseStatus, number>>
}
export function PerTestResultsTable(props: PerTestResultsTableProps): ReactNode
```

```ts
// src/components/extraction-flow/TestStatusTag.tsx
// Own tag because shared ResultBadge's STATE_BADGE map has no 'timeout'/'error'
// entries and primitives.tsx cannot be edited. Renders via the shared <Tag> tones.
export const TEST_STATUS_TONE: Record<EvaluationCaseStatus, 'green' | 'red' | 'yellow' | 'blue'>
// passed: 'green', failed: 'red', error: 'yellow', timeout: 'blue'

type TestStatusTagProps = {
  status: EvaluationCaseStatus
  count?: number          // when set, renders "passed × 4" summary-chip form
}
export function TestStatusTag(props: TestStatusTagProps): ReactNode
```

```ts
// src/components/extraction-flow/flow-notice.ts  (pure — easy to unit test)
import type { ExtractionFlowSample } from '@/fixtures/extraction'

export type FlowNotice = {
  tone: 'error' | 'warning'   // matches ErrorSection's tone prop
  title: string
  message: string
}
/** Failure-path banner for the sample, or null for a clean run. */
export function buildFlowNotice(sample: ExtractionFlowSample): FlowNotice | null
```

```ts
// src/components/extraction-flow/demo-scenarios.ts
import type { ExtractionFlowSample } from '@/fixtures/extraction'

export type ExtractionFlowScenario = {
  id: string          // stable slug, e.g. 'passed', 'extraction-failed'
  label: string       // picker button text
  description: string // one-line "what to look for" caption on the demo page
  sample: ExtractionFlowSample
}
export const EXTRACTION_FLOW_SCENARIOS: readonly ExtractionFlowScenario[]
```

```ts
// src/components/extraction-flow/ExtractionFlowDemo.tsx  ('use client')
// No props: imports EXTRACTION_FLOW_SCENARIOS directly; holds the selected-scenario
// useState. Keeps src/app/dev/extraction-flow/page.tsx a default server component.
export function ExtractionFlowDemo(): ReactNode
```

Reuse-by-import (no edits): `CodePane` (`@/components/code/CodePane`),
`ErrorSection` (`@/components/panels/ErrorSection`), `Tag`, `Dot`, `SECTION_LABEL`
(`@/components/primitives`), `cn` (`@/lib/cn`).

Deliberately **not** reused:

- `PredictionDetailPage` + `src/components/prediction/*` — the existing
  diagnostics/code surface. It is hard-bound to the `PredictionDetail` DB row shape and
  its `@/lib/prediction-diagnostics` builders (validation_json spelunking, run-config
  strips, provenance chips). R2's contract is the fixture type; wrapping the fixture in
  a fake `PredictionDetail` would invert the "components adapt to fixtures" rule and
  drag in sections R2 doesn't want. We copy its *patterns* (SECTION_LABEL headers,
  `max-w-[1280px]` column, `grid grid-cols-N max-lg:grid-cols-1` panel grids, CodePane
  usage) into new files instead.
- `GenericTable` — bound to `TableConfig`/`TableState`/URL-driven sorting and
  pagination. The per-test table is a small static table; a dedicated component is
  simpler and keeps fixture types as the only contract.
- `TextPanel` is available if the prompt should render as prose, but the prompt is a
  Python stub — `CodePane` with `language="python"` is the right panel for all three
  code stages, so `TextPanel` is likely unused.

Zero new dependencies. Rendering is HTML + Tailwind + existing `highlight.js` via
CodePane.

## 2. File map (all new)

```
src/components/extraction-flow/
  ExtractionFlowView.tsx          top-level single-sample flow (stages 1→3)
  ExtractionFlowView.test.tsx
  FunctionSelectionList.tsx       parsed functions + selection story
  FunctionSelectionList.test.tsx
  PerTestResultsTable.tsx         per-test table + status-count chips
  PerTestResultsTable.test.tsx
  TestStatusTag.tsx               EvaluationCaseStatus → Tag tone (covered by table tests)
  flow-notice.ts                  buildFlowNotice(sample) pure helper
  flow-notice.test.ts
  demo-scenarios.ts               named scenario catalog for the demo page
  demo-scenarios.test.ts
  ExtractionFlowDemo.tsx          'use client' scenario picker wrapping ExtractionFlowView
src/app/dev/extraction-flow/
  page.tsx                        server component: metadata + <ExtractionFlowDemo />
docs/plans/
  06-r2-extraction-flow.md        this plan
```

Not touched: `src/fixtures/**` (frozen), `layout.tsx`, `AppShell.tsx`, `globals.css`,
`package.json`, `PredictionDetailPage.tsx`, everything else existing. The `/dev/...`
route intentionally has no nav entry (adding one would mean editing `AppShell`).

## 3. Rendering approach

### Single-sample layout (`ExtractionFlowView`)

One vertical column (`max-w-[1280px]`, `flex flex-col gap-7`) of three numbered stages,
matching the PredictionDetailPage visual language (SECTION_LABEL headers, CodePane
panels, Tag chips):

**Header strip** — identity + verdict at a glance:
- `Tag tone="accent"` experiment_kind, mono task_id, mono model, `sample #N`,
  separated by `Dot`s; prediction_id as the mono heading.
- Outcome tag: `generated_code_outcome` rendered via `Tag` with tone
  `passed → green`, `tests_failed → red`, everything else (`extraction_failed`,
  `no_top_level_functions`, `empty_generation`, `evaluation_incomplete`) → `yellow`;
  `null` outcome renders a neutral `Tag` reading `no outcome`.
- `extraction_method` as a mono `Tag` when non-null; `entry_point` as
  `entry_point: rolling_max` mono chip.

**Failure banner** — `buildFlowNotice(sample)` → `ErrorSection` when non-null (see
§4 for the outcome → copy mapping). Rendered between header and stage 1 so the reason
the flow short-circuits is visible before the empty stages.

**Stage 1 · Code — `prompt → raw generation → extracted code`:**
- `grid grid-cols-3 items-start gap-4 max-lg:grid-cols-1` of CodePanes:
  `Prompt` (python), `Raw generation` (no language — often fenced markdown),
  `Extracted code` (python, `accent`, badge = `extraction_method` when present).
- CodePane returns `null` on empty values, which would silently collapse the flow.
  For legibility each slot goes through a tiny local `PanelSlot` helper (private to
  `ExtractionFlowView.tsx`): value present → CodePane; value null → a dashed
  placeholder card (`border-dashed`, muted text) reading e.g. `raw generation — none`
  so all three stages stay visible and the gap is the information.

**Stage 2 · Function selection — `FunctionSelectionList`:**
- Caption line explaining the rule so the visualization is self-describing:
  *"Selected = best_function_name: the parsed function with the most passed cases,
  tie-broken by name === entry_point (task.py). Arity shown per candidate."*
- One row per `ParsedFunction`: mono `signature_str`, `arity N` neutral Tag,
  `entry point` blue Tag when `function_name === entry_point`, and for the selected
  row (`is_selected`) an accent left border + `selected` green Tag.
- Selection-story callout under the list:
  - selected name === entry_point → quiet confirmation line
    (`selected 'rolling_max' matches entry_point`).
  - selected name !== entry_point → `yellow` Tag + line
    (`selected 'helper' ≠ entry_point 'rolling_max' — outcome-based selection overrode the entry point`)
    — this is the case the arity/signature display exists to explain.
  - `best_function_name === null` with functions present → `no function selected`.
- Empty `parsed_functions` → muted empty state: `no top-level functions parsed`.

**Stage 3 · Test results — `PerTestResultsTable`:**
- Summary chip row from `status_counts`: one `TestStatusTag` with `count` per status,
  ordered by `EVALUATION_CASE_STATUSES` (only statuses present in the record), plus a
  `N/M passed` mono chip computed from the counts.
- Table (semantic `<table>`, header row styled like GenericTable's: uppercase 11px
  muted labels, `border-b border-[var(--border)]`): columns
  `status | test_id | function | type | input | expected | actual | message`.
  - `status`: `TestStatusTag` (`size` matches Tag's 11px).
  - `input_repr` / `expected_output_repr` / `actual_output_repr`: `<code>` mono,
    `max-w` + `truncate`, full value in `title` for hover; expected/actual cells get a
    red tint (`text-[var(--red)]`) when the row status is not `passed`, so mismatches
    scan instantly.
  - `message`: secondary text, empty string renders as an em-dash.
- Empty `per_test_results` → single full-width muted row: `no test results recorded`
  (banner above already says why).

### Demo page cycling (`/dev/extraction-flow`)

`page.tsx` is a plain server component exporting `metadata`
(`title: 'Extraction flow · dev'`) and rendering `<ExtractionFlowDemo />`. No data
fetching, no `dynamic` export needed.

`ExtractionFlowDemo` (`'use client'`):
- `useState<string>` holding the selected scenario id, defaulting to the first entry of
  `EXTRACTION_FLOW_SCENARIOS`. Local state only — nothing in the spec needs URL
  persistence, and this keeps the route dependency-free.
- Picker: a wrapping flex row of buttons (one per scenario, Tag-like styling, accent
  border on the active one). Below it: the scenario `description` caption, then
  `<ExtractionFlowView sample={scenario.sample} />`.

`demo-scenarios.ts` builds the catalog once at module scope (fixtures are
deterministic, so this is stable):

1. Generator-backed scenarios via forced outcomes:
   `makeExtractionFlowSample({ seed: 3, outcome: 'passed' })`,
   `{ seed: 5, outcome: 'tests_failed' }`, `{ seed: 7, outcome: 'extraction_failed' }`,
   `{ seed: 9, outcome: 'empty_generation' }`.
2. Sampled-outcome sweep: `makeExtractionFlowSamples(4, { seed: 21 })` exposed as
   `sampled #0…#3` scenarios, so the demo also exercises whatever mix the generator's
   own outcome sampling produces.
3. Hand-authored `ExtractionFlowSample` literals for states the frozen generator cannot
   produce coherently (see morning note 1) — each built by a small local helper that
   derives `status_counts` from `per_test_results` so the literals cannot drift:
   - `no-top-level-functions`: `extracted_code` present (e.g. a bare expression /
     class-only snippet), `parsed_functions: []`, `best_function_name: null`,
     `generated_code_outcome: 'no_top_level_functions'`, empty tests.
   - `compile-error`: `extracted_code` with a syntax error, `compile_ok: false`,
     `compile_error: 'SyntaxError: invalid syntax (line 3)'`, empty
     `parsed_functions`/tests, outcome `'extraction_failed'`.
   - `selected-not-entry-point`: two functions where the selected one
     (`is_selected: true`, matching `best_function_name`) is **not** `entry_point`,
     with differing arities — the headline selection-story case.
   - `timeout-and-error-cases`: per-test rows covering all four
     `EvaluationCaseStatus` values incl. `timeout` and `error`, outcome
     `'tests_failed'`.
   - `evaluation-incomplete`: partial results (fewer rows than the task implies,
     mixed statuses), outcome `'evaluation_incomplete'`.

Building typed literals of frozen fixture types is contract-conforming consumption —
`src/fixtures/` itself is not modified.

## 4. Edge cases (from the generator's failure paths)

| Case | Data shape (per `makeExtractionFlowSample`) | Rendering |
|---|---|---|
| `empty_generation` | `raw_generation: null`, `extracted_code: null`, `compile_ok: false`, `compile_error: null`, empty functions/tests/counts | Banner: warning, "Empty generation — the model returned no output." All three code slots show dashed placeholders except Prompt; stages 2–3 show empty states. |
| `extraction_failed` | `raw_generation` present (prose), `extracted_code: null`, `extraction_method: null`, empty downstream | Banner: warning, "Extraction failed — no code block found in the raw generation." Raw generation pane renders so the human can see *why* extraction failed; extracted-code slot placeholder; no `extraction_method` chip. |
| `no_top_level_functions` | only via hand-authored scenario (generator inconsistency — morning note 1); `extracted_code` present, `parsed_functions: []`, `best_function_name: null` | Banner: warning, "No top-level functions — code parsed but nothing callable was found." Stage 2 empty state; stage 3 empty state. |
| Compile failure | `compile_ok: false` + `compile_error` string (hand-authored; generator never fills `compile_error`) | Banner: error tone, title "Compile failed", message = `compile_error`. `buildFlowNotice` treats `compile_ok === false && extracted_code !== null` as the compile-failure case regardless of outcome; when `compile_error` is null (generator's extraction-failed branch) the outcome-based message wins instead. |
| `evaluation_incomplete` | hand-authored | Banner: warning, "Evaluation incomplete — not all test cases ran." Table renders whatever rows exist. |
| Empty `per_test_results` with `status_counts: {}` | all failure branches above | Chip row renders nothing but the `0/0 passed` chip is suppressed (no counts → just the empty-state table row). |
| Status varieties incl. `timeout` / `error` | generator emits them randomly inside `tests_failed`; hand-authored scenario pins all four | Distinct `TEST_STATUS_TONE` tags (green/red/yellow/blue); `message` column carries the failure detail. |
| `generated_code_outcome: null` | type-legal (real rows may predate scoring) | Neutral `no outcome` tag; no banner; stages render from data alone. |
| `best_function_name` null while functions exist / selected ≠ entry_point | type-legal; mismatch is hand-authored | "no function selected" line / yellow mismatch callout (§3 stage 2). |

Guiding rule: every branch renders from the **data**, never by trusting the outcome
label alone — the outcome drives only the banner copy and header tag, so an
inconsistent real-world row still displays whatever is actually present.

## 5. Acceptance mapping (REL-3)

| Criterion | Design element | Fixture scenario / test |
|---|---|---|
| Renders a single sample's code input | Stage 1 CodePanes (Prompt / Raw generation / Extracted code) with placeholders for nulls | `ExtractionFlowView.test.tsx` happy path (`outcome: 'passed'`) asserts prompt + extracted code text visible; `empty_generation` test asserts placeholder |
| Renders extracted/parsed functions with the arity-based selection story | Stage 2 `FunctionSelectionList`: signature + arity tag per candidate, selected highlight, entry-point marker, selection-rule caption, mismatch callout | `FunctionSelectionList.test.tsx` (one selected row, arity text, mismatch flag); demo scenario `selected-not-entry-point` |
| Renders per-test results legibly | Stage 3 status-count chips + table with per-status color tags, reprs, messages | `PerTestResultsTable.test.tsx` (all four statuses, counts, empty state) |
| Works against fake data | All props are fixture types; demo page cycles generator seeds, forced outcomes, and hand-authored edge samples | `demo-scenarios.test.ts` + multi-seed smoke test in `ExtractionFlowView.test.tsx` |
| Validates infra behavior (failure paths visible) | `buildFlowNotice` banner per failure outcome; placeholders keep truncated flows legible | `flow-notice.test.ts` covers every `GeneratedCodeOutcome` + compile-failure precedence |

## 6. Test plan (colocated vitest, jsdom + testing-library, existing setup)

Conventions: `@testing-library/react` `render`/`screen` as in `IdChip.test.tsx`;
fixture data only via `makeExtractionFlowSample(...)` / `makeExtractionFlowSamples(...)`
(deterministic seeds) plus typed literals for generator-unreachable states; one
behavior per test.

`ExtractionFlowView.test.tsx`
- renders prompt, extracted code, and entry_point chip for a passed sample
  (`makeExtractionFlowSample({ seed: 3, outcome: 'passed' })`)
- shows the extraction-failed banner and extracted-code placeholder
  (`{ seed: 7, outcome: 'extraction_failed' }`)
- shows the raw-generation placeholder for empty_generation
  (`{ seed: 9, outcome: 'empty_generation' }`)
- renders one table row per per_test_result for a tests_failed sample
  (`{ seed: 5, outcome: 'tests_failed' }`)
- multi-seed smoke: for seeds 1–20 (`makeExtractionFlowSamples(20)`), rendering never
  throws and always shows the prediction_id and the stage headers — this is the
  "multiple seeds covering the failure paths" sweep, since the sampler mixes
  passed / tests_failed / extraction_failed across those seeds

`FunctionSelectionList.test.tsx`
- highlights exactly one row as selected and shows its arity tag (fixture-passed sample)
- flags entry-point marker on the function whose name matches entry_point
- renders the mismatch callout when best_function_name !== entry_point (hand-built props)
- renders the empty state for `parsed_functions: []`

`PerTestResultsTable.test.tsx`
- renders one status tag per row with the expected tone class for each of
  passed/failed/error/timeout (hand-built `PerTestResult[]` covering all four)
- shows message text on failing rows and an em-dash on passing rows
- summary chips reflect `status_counts` (counts and ordering)
- renders the empty-state row when `per_test_results` is empty

`flow-notice.test.ts`
- returns null for `passed` and `tests_failed` samples
- returns the expected tone/title for each failure outcome
  (`empty_generation`, `extraction_failed`, `no_top_level_functions`,
  `evaluation_incomplete`) — parameterized with `it.each`
- compile-failure precedence: `compile_ok: false` + non-null `compile_error` +
  non-null `extracted_code` yields the error-tone compile banner; the generator's
  `extraction_failed` shape (`compile_error: null`) yields the extraction message

`demo-scenarios.test.ts`
- scenario ids are unique and non-empty
- the catalog covers the required states: every `GeneratedCodeOutcome` in
  {passed, tests_failed, extraction_failed, empty_generation, no_top_level_functions,
  evaluation_incomplete} appears in some scenario, plus one scenario with
  `compile_error !== null` and one with selected ≠ entry_point
- every hand-authored sample is internally consistent: `status_counts` totals equal
  `per_test_results.length`, and at most one `parsed_functions` entry has
  `is_selected: true`, matching `best_function_name`

Verification commands: `pnpm test` (all of the above), `pnpm lint`, `pnpm build`
(route compiles), manual `pnpm dev` → `http://localhost:3000/dev/extraction-flow`
clicking through every scenario.

## 7. Morning notes (for Danielle — no action taken; fixtures untouched)

1. **Generator gaps in `makeExtractionFlowSample` (fixture-owned follow-up?).**
   Forcing `outcome: 'no_top_level_functions'` or `'evaluation_incomplete'` via
   `ExtractionFixtureOptions` falls through to the success branch and returns parsed
   functions + full test results with a contradictory outcome label; `compile_error`
   is never populated (`compile_ok: false` only appears with `compile_error: null`);
   and `best_function_name` always equals `entry_point`, so the
   selected-≠-entry-point selection story is never generated. R2 works around this
   with hand-authored typed literals in `demo-scenarios.ts`, but additive generator
   scenarios would let the smoke sweep cover these paths too.
2. **`ResultBadge` (shared `primitives.tsx`) lacks `timeout`/`error` styles.** R2 ships
   its own `TestStatusTag` instead of editing the shared map. If per-test statuses
   should join the app-wide badge vocabulary later, that's a small shared change.
3. **`/dev/extraction-flow` is unlinked and ships in prod builds.** Adding a nav entry
   or gating `/dev/*` out of production would require touching `AppShell`/config, so
   neither is in scope; fine for a dev-validation surface, flagging for awareness.
4. **`compile_ok` semantics in the fixture's failure branch**: the
   `extraction_failed`/`empty_generation` branch sets `compile_ok: false` even though
   nothing was compiled. The component treats `compile_ok` as meaningful only when
   `extracted_code` is non-null; worth confirming that reading matches the real
   `validation_json.extracted_code` payload before D3.
