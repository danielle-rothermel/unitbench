# R4 — Pipeline-flow visualizer (REL-5)

Status: PLAN — implementation to follow on branch `rel5-pipeline-flow`.

Renders the end-to-end per-stage trace for one sample: encode → lossless compress →
decompress → decode → run tests (encdec layout) or generate → run tests (direct
layout), including retries, failures, and skipped downstream stages.

**Frozen inputs.** The component consumes `PipelineTrace` / `PipelineStage` /
`StageFailure` from `src/fixtures/pipeline.ts` exactly as merged (design:
`docs/plans/05-r0-fixture-shapes.md`, Shape 4). No fixture changes are planned.
All fake data comes from `makePipelineTrace(options)` (deterministic, seeded).

**Zero new dependencies.** Layout is flexbox + Tailwind CSS-variable tokens, matching
the existing components. No chart/graph library is needed for a linear stage rail.

---

## 1. Component API

Props are the fixture types directly — the D3 real-data swap changes only where the
trace comes from, never the component contract.

```ts
// src/components/pipeline-flow/PipelineFlow.tsx
import type { PipelineTrace } from '@/fixtures/pipeline'

type PipelineFlowProps = {
  trace: PipelineTrace
  className?: string
}
export function PipelineFlow({ trace, className }: PipelineFlowProps): ReactNode
```

```ts
// src/components/pipeline-flow/PipelineStageNode.tsx
import type { PipelineStage } from '@/fixtures/pipeline'

type PipelineStageNodeProps = {
  stage: PipelineStage
}
export function PipelineStageNode({ stage }: PipelineStageNodeProps): ReactNode
```

```ts
// src/components/pipeline-flow/pipeline-flow-view.ts — pure view-model helpers
import type { PipelineStage, PipelineStageName, StageFailure, StageStatus } from '@/fixtures/pipeline'

/** LLM stages carry model/cost/timestamps; measurement stages carry only char counts. */
export type StageKind = 'llm' | 'measurement' | 'tests'
export function stageKind(stage: PipelineStageName): StageKind  // exhaustive switch + never check

/** Discriminated union so retry-and-recovered can never be confused with a final failure. */
export type StageRetryStory =
  | { kind: 'none' }
  | { kind: 'recovered'; attempts: number; failure: StageFailure }
  | { kind: 'failed'; attempts: number; failure: StageFailure | null }
export function stageRetryStory(stage: PipelineStage): StageRetryStory

export function stageToneClass(status: StageStatus): string   // green / red / dimmed token classes
export function formatDurationMs(ms: number): string          // 850 ms · 6.2 s · 1.1 min
export function charFlowLabel(input: number | null, output: number | null): string | null
                                                               // "192 → 89 ch (0.46×)"; null when both null
```

Semantics anchored to the fixture contract:

- `status` reflects the **final** attempt; a stage keeps its last `failure` even when a
  retry succeeded (fixture doc, pipeline.ts:31-37). So:
  - `status === 'success' && failure !== null` → **recovered retry** (yellow affordance).
  - `status === 'error'` → **final failure** (red affordance), `attempt_index` shows how
    many retries were burned first.
  - `attempt_index > 0 && failure === null` cannot occur in the generator but the type
    allows it; `stageRetryStory` returns `failed`/`recovered` only when data supports it.
- Layout branching is **data-driven**: the component renders whatever `trace.stages`
  contains, in order. `graph_layout` is used only for the header tag, so direct vs
  encdec needs no conditional stage logic.

Reuse-by-import (no edits to any existing file):

- `ResultBadge`, `Tag`, `Dot`, `SECTION_LABEL` from `@/components/primitives` — trace
  header badge and chips.
- `StatCell` from `@/components/stats/StatCell` — header totals strip.
- `formatCost` from `@/lib/format`, `cn` from `@/lib/cn`.
- **Decision: do not reuse `PredictionEncdecPipeline`.** It renders
  `EncdecPipelineData` (prompt / encoded description / decoded output text panels
  derived from `PredictionDetail`), not stage traces — no status, retries, durations,
  or skips. New stage-node components are the right shape; the shared visual language
  comes from the primitives above and the same CSS-variable tokens.

Stage status chips are stage-local (in `PipelineStageNode`), not `ResultBadge`:
`STATE_BADGE` in `@/components/primitives` has no `success`/`skipped` keys and we do
not edit shared files. Same tokens (`--green*`, `--red*`, `--bg-tertiary`) keep the
look consistent. `ResultBadge` is used only for the trace-level `result_state`.

## 2. File map (all new files)

```
src/components/pipeline-flow/
  PipelineFlow.tsx               top-level: header strip + stage rail + connectors
  PipelineStageNode.tsx          one stage card (status, metrics, retry/failure affordances)
  pipeline-flow-view.ts          pure helpers above (stageKind, stageRetryStory, formatters)
  demo-traces.ts                 named demo scenarios built from makePipelineTrace
  PipelineFlow.test.tsx          colocated component tests
  PipelineStageNode.test.tsx     colocated stage-card tests
  pipeline-flow-view.test.ts     colocated pure-helper tests
  demo-traces.test.ts            scenario invariants (each demo shows what it claims)
src/app/dev/pipeline-flow/
  page.tsx                       multi-sample demo route (server component)
docs/plans/
  06-r4-pipeline-flow.md         this plan
```

No changes to `src/fixtures/`, `tools/unitbench_publish/`, `layout.tsx`, `AppShell`,
nav, `globals.css`, `package.json`, or any other existing file.

`PipelineFlow` and `PipelineStageNode` use no hooks or browser APIs → no
`'use client'`; they render in the RSC demo page today and can drop into the
client-side `PredictionDetailPage` later unchanged.

## 3. Rendering approach

### Trace header (`PipelineFlow`)

- Identity line: `Tag` for `graph_layout` (`encdec` accent / `direct` neutral), `Tag`
  for `experiment_kind`, mono `task_id`, `sample #{sample_index}`, mono
  `prediction_id` (break-all), separated by `Dot`s — mirrors the
  `PredictionDetailPage` header idiom.
- `ResultBadge state={trace.result_state}` on the right.
- Totals strip of `StatCell`s (`grid grid-cols-3 gap-px` on `--border-subtle`, the
  existing stat-strip idiom): Model (`identity.model`, mono), Total cost
  (`formatCost(trace.total_provider_cost)`, mono; `StatCell` renders `unknown` for
  null), Total duration (`formatDurationMs`, or `unknown` when null).

### Stage rail

- `<ol>` (list semantics; each stage an `<li>` with
  `aria-label="{stage}: {status}"`) laid out `flex flex-row items-stretch` with
  `max-lg:flex-col` fallback — five encdec cards fit the existing 1280px content
  width; direct traces simply render two.
- **Connector** between consecutive cards (local, non-exported element inside
  `PipelineFlow`): an arrow glyph (`->` / rotated on vertical) carrying the char
  handoff — `output_char_count` of the upstream stage. Connector into a `skipped`
  stage renders dashed/dimmed with no count (upstream produced nothing).

### Stage card (`PipelineStageNode`)

Card = `rounded-xl border bg-[var(--bg-primary)]` with a status-toned top border /
left bar via `stageToneClass`:

- `success` → `--green` bar; `error` → `--red` bar + `--red-bg` tint; `skipped` →
  dashed `--border-subtle`, all text `--text-muted` (visibly inert).

Card contents, top to bottom:

1. **Header row**: stage name (`SECTION_LABEL`), status chip, and — for LLM stages —
   `Tag mono` with `node_id` (`encoder` / `decoder` / `direct`).
2. **Retry affordance** (from `stageRetryStory`):
   - `recovered` → yellow `Tag`: `retried ×{attempts}` plus a one-line note
     `failure_class` (`rate_limited` in yellow, other classes red) + `error_type` +
     `message` in muted text. Visibly *not* an error state.
   - `failed` → red block: `error_type`, `message`, `failure_class` tag; when
     `attempts > 0`, prefix `failed after {attempts + 1} attempts`.
3. **Metrics rows** (each row omitted when its value is null — never render `none`
   rows for measurement stages):
   - duration: `formatDurationMs(duration_ms)`
   - chars: `charFlowLabel(input_char_count, output_char_count)`
   - model: mono (LLM stages only; null otherwise)
   - cost: `formatCost(provider_cost)` (LLM stages only)
   - started: `shortDate(started_at)` as muted subtext (LLM + run_tests stages)
4. **Output excerpt**: `output_excerpt` in a mono, `whitespace-pre-wrap`,
   line-clamped (`line-clamp-3`) footer strip on `--bg-tertiary`. Hidden when null
   (error/skipped/measurement stages). Static display only — no expand interaction in
   this pass.

`stageKind` drives density, not correctness: `measurement` cards (compress /
decompress) are naturally compact because their model/cost/timestamps are null; the
component never special-cases beyond hiding null rows, so any future fixture that adds
timing to measurement stages renders correctly with zero changes.

### Demo page (`src/app/dev/pipeline-flow/page.tsx`)

Server component, no data fetching, reachable at `/dev/pipeline-flow` (not in nav —
see morning notes). Renders every scenario from `demo-traces.ts`, each as a titled
section (`SECTION_LABEL` heading + one-line description + `<PipelineFlow …/>`),
plus a closing "sample gallery" of several seeds to show variance:

`demo-traces.ts` exports `DEMO_TRACES: DemoTrace[]`
(`{ id, title, description, trace }`), built from `makePipelineTrace`:

| id | options | story it demonstrates |
| --- | --- | --- |
| `encdec-pass` | seed-scanned: encdec, `result_state === 'passed'`, no retries | happy path, all five stages green, 8/8 excerpt |
| `encdec-retry-recovered` | seed-scanned: encdec, some stage `success` + `failure !== null` | rate-limited retry that recovered (yellow, not red) |
| `encdec-tests-failed` | seed-scanned: encdec, `result_state === 'failed'` | all stages green but 6/8 excerpt + failed badge |
| `encdec-fail-decode` | `{ failAt: 'decode' }` | decode red, run_tests skipped |
| `encdec-fail-encode` | `{ failAt: 'encode' }` | first stage red, four downstream stages skipped |
| `direct-pass` | seed-scanned: direct, passed | two-stage direct layout |
| `direct-fail-generate` | `{ layout: 'direct', failAt: 'generate' }` | direct failure + skipped tests |
| `encdec-fail-tests` | `{ failAt: 'run_tests' }` | last stage errors; nothing skipped |

Seed scanning: retries and pass/fail are probabilistic in the generator
(`chance(rng, 0.2)` / `chance(rng, 0.6)`), so `demo-traces.ts` includes a small
`firstSeedWhere(predicate, options, maxSeed = 500): number` helper that scans seeds
deterministically and **throws** if no seed matches (fail fast; the fixture is frozen,
so found seeds are stable). `demo-traces.test.ts` locks each scenario's invariant.

## 4. Edge cases (from the generator's paths)

| Case | Generator source | Design handling |
| --- | --- | --- |
| Error stage + downstream skipped | `failAt` → `reachedFailure` → `skippedStage()` (pipeline.ts:177-191) | error card red with failure block; skipped cards dashed/dimmed, all-null fields render as a status-only placeholder (no empty metric rows); connector into skipped is dashed with no char count |
| Rate-limited retry that recovered | `retried = spec.llm && chance(rng, 0.2)` → `attempt_index: 1`, `failure` set, `status: 'success'` (pipeline.ts:125-139) | `StageRetryStory.recovered`: yellow `retried ×1` tag + failure note; card stays green — tests assert it is not rendered as an error |
| Null timestamps on measurement stages | `timed = spec.llm \|\| stage === 'run_tests'` → compress/decompress get null `started_at`/`completed_at`/`duration_ms` | duration/started rows omitted entirely; card still shows char flow (89 → 79) |
| Direct-layout traces | `stageSpecs('direct')` → `generate` (node `direct`) + `run_tests` | rail renders the two stages from `trace.stages`; no encdec assumptions anywhere |
| Null costs | measurement + run_tests stages always `provider_cost: null`; type allows null totals | cost row omitted per stage; header `StatCell` shows `unknown` when `total_provider_cost` is null |
| Error stage's own nulls | failed stage: `output_char_count: null`, `output_excerpt: null` | `charFlowLabel` degrades to input-only (`"192 ch in"`); excerpt strip hidden |
| `run_tests` success has null `output_char_count` | pipeline.ts:121-123 | input-only char label; excerpt (`"8/8 cases passed"`) carries the outcome |
| Failed stage `attempt_index: 1` | `attempt_index: retried \|\| failed ? 1 : 0` | "failed after 2 attempts" prefix in the failure block |
| Non-rate-limited failure classes | generator only emits `rate_limited`, but `StageFailure.failure_class` spans all five classes + null | tone mapping keys off `failure_class` (yellow for `rate_limited`, red otherwise, plain when null); covered by hand-built `PipelineStage` literals in tests since the generator can't produce them (see morning notes) |

## 5. Acceptance mapping

REL-5 acceptance: *renders the per-stage pipeline trace for a sample against fake data*.

| Criterion | Design element | Fixture scenario / test |
| --- | --- | --- |
| Per-stage trace renders against fake data | `PipelineFlow` fed by `makePipelineTrace` | `PipelineFlow.test.tsx`: encdec trace shows all five stage names in fixture order; demo `/dev/pipeline-flow` |
| Per-stage status (success/error/skipped) | status chip + `stageToneClass` | `PipelineStageNode.test.tsx` per status; `failAt: 'decode'` trace asserts error + skipped rendering |
| Retry story (`attempt_index`) | `stageRetryStory` → `retried ×N` tag / "failed after N attempts" | seed-scanned `encdec-retry-recovered` scenario; hand-built failed-retry stage |
| Durations | `formatDurationMs` row + total-duration `StatCell` | helper unit tests; encdec trace asserts LLM stage duration text and null-duration omission on compress |
| Char counts in/out | `charFlowLabel` rows + connector counts | helper unit tests (both-null, input-only, in→out ratio); component assertion on encode card |
| Output excerpts | mono excerpt strip | run_tests card shows `8/8 cases passed` / `6/8 cases passed`; hidden on error/skipped |
| Model + cost | model/cost rows (LLM only), `formatCost`; header totals | encode card shows model + `$0.0xxxx`; measurement card omits both; header total matches `total_provider_cost` |
| Failure metadata incl. `rate_limited` | failure block with `error_type`, `message`, `failure_class` tone | `failAt` trace asserts `RateLimitError` + message rendered; literal stages cover `permanent`/null classes |
| Skipped downstream stages | dashed/dimmed placeholder cards, dashed connectors | `failAt: 'encode'` trace asserts four skipped cards |
| Direct vs encdec layouts | data-driven rail + layout header `Tag` | `layout: 'direct'` traces (pass + failAt) assert two-stage rendering |

## 6. Test plan

Colocated vitest (`jsdom`, globals, `@testing-library/react` + jest-dom per
`vitest.config.ts` / `src/test/setup.ts`), run with `pnpm test`. One behavior per
test; queries by role/accessible text following `IdChip.test.tsx`.

- **`pipeline-flow-view.test.ts`** (pure, parameterized where equivalent):
  - `stageKind` covers all six `PIPELINE_STAGE_NAMES` (exhaustiveness is also
    compile-time via the `never` check).
  - `stageRetryStory`: none / recovered / failed-with-retry / failed-first-attempt,
    including hand-built literals for the type-legal shapes the generator never emits.
  - `formatDurationMs`: ms, seconds, minutes boundaries.
  - `charFlowLabel`: in→out with ratio; input-only; both-null → null.
- **`demo-traces.test.ts`**: every `DEMO_TRACES` entry satisfies its advertised
  invariant (retry scenario contains a recovered retry; `failAt` scenarios contain
  exactly one error stage and the expected skipped tail; layouts match) — keeps the
  demo page honest and pins the scanned seeds against fixture regressions.
- **`PipelineStageNode.test.tsx`**:
  - success LLM stage renders duration, char flow, model, cost, excerpt.
  - measurement stage renders char flow only (no duration/model/cost rows).
  - error stage renders failure `error_type` + `message` and no excerpt.
  - skipped stage renders status only, dimmed, no metric rows.
  - recovered retry renders `retried ×1` + rate-limited note without error styling.
  - non-rate-limited failure literal renders red failure-class tag.
- **`PipelineFlow.test.tsx`**:
  - encdec trace renders the five stages in fixture order (list items).
  - direct trace renders exactly `generate`, `run_tests`.
  - header shows `result_state` badge, model, formatted total cost/duration; null
    totals render `unknown`.
  - multi-seed smoke: for seeds 1–10 × both layouts × (no failAt, failAt first LLM
    stage), rendering throws nothing and always shows a `run_tests` item — cheap
    property-style coverage of the generator's randomized branches (deterministic:
    seeds are fixed).

Verification beyond vitest: `pnpm lint`, `npx tsc --noEmit`, and a manual pass over
`/dev/pipeline-flow` via `pnpm dev` for the visual story (retry yellow vs error red,
skipped dimming, vertical wrap at narrow widths).

## 7. Morning notes (for Danielle)

1. **Demo route discoverability.** `/dev/pipeline-flow` is URL-only; adding it to
   `AppShell` nav would touch a shared file, so it is not planned. If you want a
   `/dev` index later, that is one shared-nav edit across all R-component demos. The
   route also ships in production builds (Next has no dev-only routes) — harmless
   static fake data, but say the word if you want a `notFound()` guard on
   `NODE_ENV === 'production'`.
2. **`formatDurationMs` placement.** It arguably belongs in `src/lib/format.ts`
   next to `formatCost`, but that file is shared — kept colocated in
   `pipeline-flow-view.ts` for now; promote later when a second component needs it.
3. **`STATE_BADGE` lacks an `error` key** (`src/components/primitives.tsx`), so the
   trace-level `ResultBadge` for `result_state: 'error'` falls back to neutral gray
   instead of red. One-line shared edit if you want it red; not planned here.
4. **Fixture failure variety (not a blocker, fixtures stay frozen).** The generator
   emits only `failure_class: 'rate_limited'` (even for `failAt` hard failures) and
   caps `attempt_index` at 1, so `permanent`/`transient`/`unknown` tones and deeper
   retry counts are exercised only via hand-built `PipelineStage` literals in tests.
   If demo-page variety matters, a fixture-side `failureClass` option would be an
   additive generator knob — flagged for a future fixture PR, not this component.
