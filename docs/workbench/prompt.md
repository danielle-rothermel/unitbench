# Workbench Execution Brief

You are evolving unitbench per the staged plan in
`docs/workbench/overall.md`. This file is your task definition. Read
first, in order:

1. `docs/workbench/overall.md` — stages, house rules, gates
2. `.impeccable/critique/2026-07-04T07-06-41Z__src-app.md` — stage-0
   backlog with severities
3. `PRODUCT.md`, `docs/2026-06-30-aspirations-and-roadmap.md`
4. `../whetstone-ai/docs/composable/overall.md` + its
   `docs/composable/migration_log.md` — library readiness gates
   (READ-ONLY; never modify whetstone-ai or any `composable-migration`
   branch)

Do not re-litigate settled decisions (lanes, fix-in-place heatmap,
web-first prototyping, light mode, token system). Where something is
open, make the smallest conservative choice and record it in
`overall.md`.

## Loop protocol (read first, every iteration)

You run in a loop; each iteration starts fresh. State lives on disk and
in git.

1. **Re-derive state.** Read `docs/workbench/workbench_log.md` (created
   in Stage 0), verify against `git log`/branch state; repos win over
   the log — correct the log first if they disagree.
2. **Advance one bounded increment** — one stage, or one coherent
   sub-step. Prefer finishing small over starting large.
3. **Leave clean state.** Commit, push, update the log's status table
   and append an entry before ending. Never end with uncommitted work.
4. **Thrash guard.** Same acceptance check failing two consecutive
   iterations with the same error → mark the stage
   `blocked: <one-line diagnosis>`, move to independent work or halt.
5. **Gates.** Stages 2–4 depend on the whetstone migration. Check its
   `migration_log.md` status table; if the gate stage is not `done`,
   mark the workbench stage `gated` (not blocked) and take the next
   ungated stage.
6. **Termination.** All stages `done` (or only `gated` remain) → final
   message exactly `WORKBENCH COMPLETE`. Blocked with nothing ungated →
   `WORKBENCH BLOCKED: <stage list>`.

`workbench_log.md` format: status table (stage | state | notes), then
environment line (node/pnpm versions, DATABASE_URL reachable y/n, which
library repos present), then append-only dated entries (what landed,
verification commands + results, choices made).

## Ground rules

- **Branch discipline.** Work on branch `workbench` in unitbench (create
  from default branch). Library-side facade work (stages 2–3) goes on a
  new `serve` branch in that library's repo — never its
  `composable-migration` branch. Push everything; draft PR per repo.
- **Verification gates, every increment:** `pnpm typecheck && pnpm lint
  && pnpm test && pnpm build` green. Every stage-0 fix and every new
  page lands with a Playwright test in `e2e/`. Run the design detector
  on changed files and keep it clean:
  `node ~/.claude/skills/impeccable/scripts/detect.mjs --json <changed
  tsx files>`.
- **Design system:** extend the OKLCH tokens in `src/app/globals.css`,
  never inline ad-hoc colors; light mode only; Fira Code for code/data;
  density per the product register. Pages under `/lab` are exempt from
  polish but not from typecheck/lint.
- **No paid API calls.** Playground pages are built and tested against
  fixtures/local facades only; live provider calls require keys present
  AND are limited to one smoke call, never in tests.
- **No schema/db writes.** unitbench reads Neon; it never migrates or
  writes it.
- **Facade pattern (stages 2–3):** Pydantic → FastAPI router in the
  library's `[serve]` extra → OpenAPI → `openapi-typescript` client
  committed in unitbench with a regen script (`pnpm gen:api`). Facades
  bind to localhost only.

## Stage 0 — Critique fixes (order: trust → ergonomics → typography → power)

Backlog and root causes are in the critique snapshot; key pointers:

- `src/lib/prediction-diagnostics.ts` — `buildScoringStage` conflates
  stage completion with outcome (render neutral "Scored — <score>"
  distinct from pass/fail); `buildEvaluationStage` renders
  `failures/total` unvalidated — clamp and render an explicit
  inconsistent-data marker when `failures > total`.
- `ScoreHeatmap` — rebuild in place: `role="grid"` semantics, axis
  headers, accessible cell names ("<model>, <kind>: <value>"),
  contrast-computed cell text color, client-only mount gate for
  DndContext (kills the hydration console error).
- `PredictionDetailPage` — debug JSON payloads collapsed by default
  (line-count summaries; prompt/code/raw-generation stay open);
  deduplicate provenance.
- Typography/consistency: Space Grotesk only for true display; prose
  ≤~72ch; filter grid alignment; `unknown` vs `—` unified; real arrow
  glyph.
- Power layer: `/` focuses filter, `j/k` row nav; wire or remove the
  "12 visible columns" label.

**Accept:** all pnpm gates green; new e2e tests pass proving — heatmap
page has zero console errors, exposes `role="grid"` with headers and
accessible cell names, cell text contrast ≥4.5:1 (computed in-page);
diagnostics can never render `failures > total` without the
inconsistency marker (fixture-driven component test); scoring stage of a
failed prediction does not read "Passed"; detail-page payloads collapsed
by default; `/` and `j/k` work. Detector clean on changed files.

## Stage 1 — IA restructure + design system

Lane navigation (Data/Replay/Playgrounds/Design + `/lab` route group);
extract component inventory to `DESIGN.md`; choose chart library and
commit a token-mapped chart theme with a demo scatter in `/lab`; build
the shared inspector component (payload + provenance + copy + code
panes).

**Accept:** all existing pages reachable under the new IA (redirects
fine); `DESIGN.md` exists; themed demo chart renders in `/lab`;
inspector component used by the prediction detail page; pnpm + e2e
green.

## Stage 2 — Parser playground *(gate: dr-code migration stage done)*

dr-code `[serve]` extra on a new `serve` branch exposing
`explain(text, profile, stages=...)`; `pnpm gen:api` client;
`/playgrounds/parser` — paste text, toggle stages, candidate tree with
winner rationale, using the inspector component.

**Accept:** facade unit-tested in dr-code; e2e drives the page against
the local facade with fixture text; no external network.

## Stage 3 — Provider query page + variance *(gate: dr-providers v0.2 done)*

dr-providers `[serve]` extra (generate/build_payload/conformance);
`/playgrounds/provider` — request builder, wire-payload preview,
response + conformance violations, retry; variance mode (prompt × model
× N → JSONL download + report) built on the library's variance/canary
machinery, tested against `FixtureProvider`.

**Accept:** e2e green using FixtureProvider only; page clearly marked
local-only; no keys read in tests.

## Stage 4 — Graph viewer *(gate: dr-graph exists)*

`/design/graph`: paste/upload GraphSpec JSON, validate against the
dr-graph JSON schema, render the DAG (nodes, bindings, terminal node).
Pure frontend.

**Accept:** renders the repo's fixture specs (direct, enc-dec); invalid
spec shows the schema error; e2e green.

## Stage 5 — Projection read layer + dashboard

Write the projection consumer sketch (flat analytical projection +
replay projection) as a design commit — it doubles as input to the
platform library's projection design. Implement a read-layer interface
over today's `published_*` tables; build the Data-lane dashboard:
correctness-vs-compression scatter with click-through to sample detail,
plus one distribution view.

**Accept:** dashboard renders from live Neon data locally; every plot
point navigates to its prediction detail; read layer isolated behind
one module so the projection swap is contained; pnpm + e2e green.

## Stage 6 — Replay viewer

Step-through of one generation run (`node_attempts` +
`graph_snapshot`): stage-by-stage advance with inputs/outputs in the
inspector; side-by-side compare of two predictions sharing a
`graph_digest`.

**Accept:** e2e walks a fixture run end-to-end; compare view diffs two
runs; pnpm green.

## Escalation / stop conditions

Stop the stage (finish the log entry, push what passes) rather than
improvise when: an acceptance check can't pass without violating a house
rule; a gate's migration stage is not done (mark `gated`, move on);
anything would require touching whetstone-ai, a `composable-migration`
branch, Neon schema, or spending money beyond one smoke call. Completed
stages are independently valuable — a clean stop after stage N is
success.
