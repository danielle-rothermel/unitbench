# Unitbench — Aspirations, Context & Roadmap

_Captured 2026-06-30. The current app is intentionally minimal — a read-only viewer
that proves we can see our data. This doc records where we want to take it, why, and
what the upstream `dr-dspy` data model and plans actually support today. It is a
direction document, not an execution plan; execution prompts will live in
`docs/plans/`._

---

## Framing: from "display" to "interrogate"

Unitbench today answers one question: _what rows exist?_ Every aspiration below is
about asking **harder questions** — _why_ did this fail, _how_ does this compare,
_what happened in between_. That is a different mode (exploration / diagnosis vs.
browsing), and it is exactly the mode needed to debug LLM pipelines, where failures
rarely live in the final row — they live in the **intermediate steps** and in the
**distribution across many samples**. The current simplicity is the right first rung,
not a deficiency.

A useful mental model: these are not six features of one app. They are closer to
**three products sharing one data substrate** —

- a **dashboard** (plots, aspirations 1–2),
- a **trace / replay debugger** (aspiration 4),
- an **interactive playground / API** (aspiration 5),

— all reading from a **purpose-built analytical read layer** (aspiration 3) fed from
`dr-dspy`. This framing matters because the read layer is the foundation all three
products depend on: build the dashboard directly on Neon and we rebuild it for the
analytical store later; get the read layer right and each product gets cheaper.

---

## The aspirations

Each item: a clearer synthesis of the goal and rationale, followed by the original
direct quote.

### 1. Plots where clicking a point opens the sample

**Synthesis:** The core interaction of the whole vision. Aggregate views (e.g. a
scatter of score vs. cost) reveal _that_ something is anomalous; the sample view
reveals _why_. Bridging them — click the outlier, immediately see its actual
prompt / output / details — collapses the loop between "spot the anomaly" and
"diagnose it," and removes the constant context-switch between a chart and a
separate table.

> "Some have to do with being able to see the data in a way that is easier to
> visualize. The 'way better than I could imagine' case version would be something
> like having some super clear plots where we could click on a point on the plot and
> see something like the sample view in the sample viewer variation."

### 2. A range of plot types, each answering a specific question

**Synthesis:** The plot types are not a feature checklist — they are _answers to
questions_. Violin = score distribution per model; heatmap = which task×model cells
are weak; line = whether optimization improved over steps; scatter = score vs. cost
trade-offs. When we plan this, each plot type should be pinned to the actual question
it answers, because that determines the data projection it needs.

> "I definitely want to create a range of different types of plots (heatmaps, scatter
> plots, line plots, violin plots, etc, I have specific questions I want to answer)."

### 3. Move off Neon as primary source → projections on MotherDuck

**Synthesis:** The most architecturally significant aspiration. Neon (transactional
Postgres) is built for writes and point lookups; analytical visualization is
columnar, scan-heavy, aggregate work — DuckDB / MotherDuck's home turf. "Clear
projections from the Postgres tables" describes a **read model**: purpose-shaped,
denormalized snapshots for visualization, separate from the source of truth. This is
the grown-up version of the caching / typed-read-layer items in `issues.md`, and it
decouples the viewer from the live experiment DB. Embedded Dives = letting MotherDuck
host some exploration UI so we don't rebuild everything bespoke.

> "And I want to move away from reading from Neon as the primary source. Ultimately
> I'd like to make some clear projections from the postgres tables from dr-dspy
> experiments for different types of data and then host them on motherduck and read it
> from there (and potentially create some Dives and embed them directly?)."

### 4. A workflow replay viewer (step-through + side-by-side compare)

**Synthesis:** The hardest and likely highest-value aspiration. Prompt-optimization
flows are nearly impossible to interpret as a final score — the signal is in the
_trajectory_: what the optimizer tried, how the prompt mutated, where a sample's
answer diverged from a sibling run. A replay / diff view turns an opaque run into
something readable. Two capabilities: (a) compare similar flows that diverge at each
step; (b) drill into one step (e.g. the input) to see its prompt / config / details,
then advance to the next step with a **clarity-first animation** — the animation's
job is to make causality between steps legible, not to look nice.

> "And, the most useful piece that I think will also be pretty hard is to make a
> replay viewer of the sequence of the workflow in a way that we can (1) compare
> similar flows that have different answers at each step of the flow and (2) That we
> can see one piece, like the input, and see all the details like the prompt, the
> config, etc, and then do some form of indication (click, arrow, etc) that the next
> step can happen and we see some type of simple animation that makes it clear whats
> happening (so the animation is for clarity not visual appeal) and we see the next
> stage, etc all the way through. this would be really nice with our current flows,
> but I think it will be very hard to debug/interpret the prompt optimization flows
> without that."

### 5. Interactive sub-step viewer that hits an API

**Synthesis:** A different category from everything above — the others are
_retrospective_ (look at data that exists); this is _live / interactive_ (run the
actual code on new input). Paste a sample, toggle parser stages on/off, watch it get
parsed stage-by-stage; then pull the failed test cases and inspect values at multiple
points in the flow. A parser with toggleable stages is exactly where static output
hides the bug — you need to watch the input transform. This implies Unitbench grows a
real backend / API that can invoke `dr-dspy` code: a bigger architectural step than
read-only viewing.

> "Also, I want to visualize some of the specific substeps + have an interactive
> viewer that hits an api. Eg I want to be able to paste in a string sample and see
> how it gets parsed based on turning on different pieces of the parser flow. and then
> get the test cases that failed and look at the values at multiple places, etc."

### 6. Explore other related datasets

**Synthesis:** More a design constraint than a feature: the more the data model
generalizes (config-driven, which the app already is), the cheaper it is to point the
same viewer at a new dataset. Don't hardcode to today's tables.

> "And this isn't even saying anything about exploring the other related datasets that
> I'm not currently actively producing."
>
> "Which is to say, the app is SUPER simple right now, but thats because I wanted to
> be sure I could have something that would let me see my data."

---

## Context: what `dr-dspy` (branch `human-eval`) actually provides

Explored via a worktree at `.scratch/dr-dspy-human-eval`. Two findings stand out:
the data model is **more ready** than the current viewer implies, and the table the
viewer reads **doesn't exist yet**.

### The v1 data model is normalized around the trace, not the final row

Defined as SQLAlchemy Core tables (`dr_dspy/db/schema.py`) + Pydantic records
(`dr_dspy/records/models.py`) + Alembic migration
(`db/migrations/versions/20260629_0001_v1_domain_schema.py`). The chain:

```
experiment → prediction_spec → generation_run → node_attempts (per step!) → score_attempts → projection
```

Three unlocks relevant to the aspirations:

1. **Every workflow step is a row.** `dr_dspy_node_attempts` stores one record per
   node, each with its own `output`, `usage_cost`, `provider_config`, `failure`, and
   timing. `dr_dspy_generation_runs.summary.execution_order` gives the ordered trace.
   → This is the raw material for the replay viewer (#4) for **current** flows, and
   it already exists. (Direct = 1 node, enc-dec = 2 nodes, enc→compress→dec = 3.)

2. **The full graph DAG is stored per prediction** in
   `prediction_specs.graph_snapshot` (`GraphSpec`: nodes, `input_bindings`, terminal
   node). → Enables the "compare similar flows" half of #4: predictions sharing a
   `graph_digest` but differing in output are diffable node-by-node.

3. **The parser is fully modeled with toggleable stages**
   (`dr_dspy/humaneval/code_parsing.py`): two parser profiles
   (`humaneval-best-effort`, `humaneval-field-marker`), an `ExtractionMethod` enum of
   pipeline stages (`fenced_code`, `json_code_field`, `bare_python`, …), and a
   `CodeExtractionResult` (which method won, candidate count, compile_ok, errors).
   Rescoring can re-run a different parser profile against existing generations.
   `score_attempts.per_test_results` holds per-test outcomes. → Backbone for the
   parser playground (#5) and the failed-test drill-down.

### Two reality-checks

- **A. The `published_*` tables the viewer reads do not exist yet — anywhere.**
  Unitbench's `TABLE_CONFIGS` references `published_experiments` /
  `published_predictions` / `published_prediction_details`, but there is no such
  table in `dr-dspy` code. "Publish to Neon" is explicitly **step 13, deferred**, and
  the docs leave the projection's _form_ (physical Postgres table vs. view vs. DuckDB
  read-side) as an **open question**. → Leverage: Unitbench's needs can legitimately
  drive the projection design. We are a stakeholder in step 13, not a passive waiter.

- **B. Prompt-optimization runs are NOT in the schema yet.** No
  MIPRO / COPRO / teleprompter trajectory is modeled. The closest analog is multiple
  `generation_runs` (by `attempt_index`) per prediction. COPRO is the **stated
  ultimate goal** of `dr-dspy`, but the data model to capture an optimization _study_
  does not exist. → The "interpret prompt-optimization flows" part of #4 is blocked
  on upstream `dr-dspy` work, not viewer work.

### `dr-dspy` planning context (from `dr-dspy/docs/`)

- North-star design: `docs/append-only-eval-records-design.md` (2026-06-29) — the v1
  graph-based eval platform; DBOS owns durable workflow state; app tables store
  requested specs + append-only terminal outcomes + mutable analysis projections;
  13-step implementation sequence.
- Status notes: `docs/platform-graph-workflow-implementation.md`.
- Superseded but best statement of goal/rationale:
  `docs/generation-experiment-design.md` (2026-06-28) — generalize direct + enc-dec
  into one pluggable generation-graph platform; optimize prompts (COPRO); the
  read-side plan is **bronze (append-only log) → silver (DuckDB views / marimo
  parsing JSONB)**. (DuckDB is named; MotherDuck is not — MotherDuck is "DuckDB,
  hosted," a natural extension.)
- Stated next goals: step 11 migration/backfill of v0 rows → step 12
  rescoring/projection-movement → **step 13 publish projections to Neon + generate
  TypeScript types for the viewer** → run COPRO experiments. Prisma is explicitly
  rejected; Drizzle is a possible later read-side query builder; schema authority
  stays in Python (SQLAlchemy Core + Alembic + Pydantic).

---

## Readiness: aspirations vs. what the data supports

| # | Aspiration | Data ready? | Verdict |
|---|---|---|---|
| 1 | Click plot point → sample view | **Now** (needs projection w/ numeric cols + id) | Buildable once a projection exists |
| 2 | Plot types (heatmap / scatter / violin) | **Now-ish** | Gated on the analytical read layer, not new capture |
| 3 | Off Neon → DuckDB / MotherDuck projections | **Design open** | We can shape this; docs already say "bronze → DuckDB silver" |
| 4a | Replay viewer for **current** flows (direct / enc-dec) | **Now** (`node_attempts` + `graph_snapshot` exist) | Hardest UI, but data is there |
| 4b | Replay / diff for **prompt-optimization** flows | **Blocked** | `dr-dspy` must model optimizer runs first |
| 5 | Interactive parser playground hitting an API | **Partly** (parser code + stages exist; needs API + Unitbench backend) | Architecturally biggest step |
| 6 | Other datasets | Design constraint | "Keep it general"; already config-driven |

---

## Implied sequencing (for the next decision, not yet a plan)

The work splits cleanly across the two repos:

- **Track 1 — unblocked, Unitbench-side:** the analytical read layer (projection) +
  plots #1 / #2 + replay viewer #4a for current flows. Gated only on _defining a
  projection_, which we partly control.
- **Track 2 — upstream, `dr-dspy`-side:** model optimization runs (#4b) and build the
  parser API (#5). These need `dr-dspy` work before Unitbench can consume them.

**Keystone:** the **projection schema** is the single highest-leverage thing to get
right — it is `dr-dspy`'s next deferred milestone (step 13), it is currently
undefined, and #1 / #2 / #4a all read from it. There may be **two** projections: a
`node_attempts`-derived one (for replay) and a flat per-prediction analytical one
with numeric score / cost / compression columns (for plots). Co-defining this between
`dr-dspy` (producer) and Unitbench (consumer) unblocks the most.

### Open decision (what to do next)

- **(a)** Co-design the projection schema first (unblocks the most), **or**
- **(b)** First mock up the replay viewer (#4a) over the `node_attempts` data we
  already have — confirm we understand the data before freezing a schema around it.

Recommendation: lean (a), but (b) is a reasonable way to de-risk the schema first.
</content>
