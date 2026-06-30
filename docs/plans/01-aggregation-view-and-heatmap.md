# Plan 01 — Aggregation view + model×kind heatmap

**Target repo:** `unitbench` (this repo). Self-contained; **no `dr-dspy` changes**.
**Status:** ready to execute.
**Branch:** create a feature branch off the current branch (do not commit to `main`).

---

## Why this exists (context for the executor)

Unitbench is a read-only Next.js 16 viewer over published benchmark tables in Neon
Postgres. Today it can only browse rows. The user needs to spot **aggregate**
patterns across runs — e.g. "model X fails across the board, in both direct and
enc-dec experiments," which is the signature of a parsing/eval bug rather than a
genuinely weak model.

This is real and already visible in the data. Example (verified):

```
openai/gpt-5.4-nano    humaneval_direct   n=987    avg_score=0.147
openai/gpt-5.4-nano →…  humaneval_encdec   n=3451   avg_score=0.000
```

vs. most models at 0.75–0.93. The point of this feature is to make that jump out.

Read `docs/2026-06-30-aspirations-and-roadmap.md` and `docs/issues.md` for the wider
direction. This plan implements aspiration **#1 (group-by + filter aggregation)** and
the first slice of **#2 (diagnostic plots)** — a heatmap. The `avg`/`stddev`/`count`
aggregation core is deliberately the reusable substrate that later variance and
bootstrapping work will build on.

---

## Data shape (verified against Neon — build to this)

Source table: **`published_predictions`** (74,032 rows, one row per sample).

Relevant columns:

| Column            | Type             | Role        | Notes |
|-------------------|------------------|-------------|-------|
| `model`           | text             | group-by    | 39 distinct |
| `task_id`         | text             | group-by    | 164 distinct |
| `experiment_kind` | text             | group-by    | 2: `humaneval_direct`, `humaneval_encdec` |
| `result_state`    | text             | group-by    | 4: `passed`, `failed`, `error`, `pending` |
| `source`          | text             | group-by    | 1 distinct (low value, but allow it) |
| `score`           | double precision | measure     | 64,767 non-null (range ~0..1) |
| `provider_cost`   | double precision | measure     | 64,706 non-null |

`score` and `provider_cost` contain NULLs — aggregates must ignore NULLs
(standard SQL `avg`/`stddev` behavior is fine; `count(score)` counts non-null).

---

## What to build

### Part A — Aggregation data layer

Add an aggregation query builder alongside the existing data layer
(`src/lib/table-data.ts`, `src/lib/sql-identifiers.ts`). It must:

1. Accept a set of **group-by columns** (multi-select from the allowlist:
   `model`, `task_id`, `experiment_kind`, `result_state`, `source`).
2. Accept **filter-in / filter-out** predicates on those same dimensions
   (e.g. include only `experiment_kind=humaneval_encdec`; exclude
   `model=openai/gpt-5.4-nano`). Support multi-value in/out per column.
3. Compute per group: `count(*)` as `n`, `avg(score)`, `stddev(score)`,
   pass-rate (`count(*) filter (where result_state='passed') / count(*)`),
   `avg(provider_cost)`.
4. Order by a chosen measure (default `avg_score` ascending, so the worst/most
   suspicious groups surface first).

**Hard constraint — reuse the existing safety pattern.** SQL is built dynamically,
so follow the established approach exactly:
- Identifiers (group-by/order columns) go through
  `validateSqlIdentifier` / `quoteIdentifier` from `src/lib/sql-identifiers.ts`.
  **Never interpolate a raw column name.** Only allowlisted columns may be grouped.
- Filter **values** go in as parameters (`$1`, `$2`, …), exactly like
  `buildWhere` in `table-data.ts`. Never interpolate values.
- Return results via the same discriminated-union result pattern used by
  `getTablePage` (`{status:'ok'|...}`), not thrown exceptions, so the page can render
  missing-url / error states.

Add unit tests mirroring the existing ones (`src/lib/table-data.test.ts`,
`sql-identifiers.test.ts`): assert the generated SQL text + params for a couple of
representative group-by + filter-in/out combinations, including that disallowed
column names are rejected.

### Part B — Aggregation table UI

A new route (suggest `src/app/aggregate/page.tsx`, or
`src/app/tables/[tableId]/aggregate` if it fits the existing nav better — pick the
smaller change). It should:

1. Let the user choose group-by columns and filter-in/out values via controls
   consistent with the existing `TableFilters` component.
2. Render the aggregate rows in a sortable table — **reuse `GenericTable`** rather
   than building a new table component.
3. Read state from the URL (searchParams) the same way the existing table pages do,
   so views are shareable/bookmarkable. Follow the `table-params.ts` pattern.

### Part C — Heatmap (first plot)

A heatmap of **`model` (rows) × `experiment_kind` (columns)** colored by `avg_score`
(diverging or sequential scale; low score = visually alarming). Requirements:

- Render from the same aggregation query (group-by `model, experiment_kind`).
- Each cell shows the value (and ideally `n` on hover/secondary text).
- Light mode only (per user convention — no dark theme).
- Keep the plotting dependency minimal. Prefer a lightweight approach (CSS grid +
  computed background colors is acceptable and dependency-free) over pulling in a
  heavy charting library. If a library is used, justify it in the PR description and
  keep it small. Use Fira Code for any numeric/code text in cells.
- The heatmap must make the `gpt-5.4-nano` row (0.147 / 0.000) visually obvious.

---

## Acceptance criteria

- [ ] `pnpm dev` renders the new aggregation view against Neon (see "Env" below).
- [ ] User can group by ≥1 of the allowlisted columns and see `n`, `avg_score`,
      `stddev_score`, `pass_rate`, `avg_cost` per group.
- [ ] User can filter-in and filter-out by `model` and `experiment_kind`
      (multi-value).
- [ ] The heatmap renders model × experiment_kind colored by avg_score, and
      `gpt-5.4-nano` is visibly the outlier.
- [ ] All SQL uses allowlisted identifiers + parameterized values; a disallowed
      group-by column is rejected (with a test proving it).
- [ ] New unit tests pass; `pnpm test`, `pnpm lint`, and `tsc --noEmit` are clean.
- [ ] No changes to unrelated files; no rewrite of the existing table pages beyond
      what's needed to add the new view.

---

## Env / running notes (important)

There is a **known env-var mismatch** (see `docs/issues.md` #1): the code reads
`process.env.DATABASE_URL`, but `.env` defines `DR_LLM_POSTGRES_SYNC_ADMIN_URL`.
**Do not fix that here** (it's a separate plan). To run locally, either export
`DATABASE_URL` from the value in `.env`, or set it for the dev process. Do not commit
the credential.

Verify against real data with (read-only):
```
psql "$DATABASE_URL" -c "SELECT model, experiment_kind, count(*), round(avg(score)::numeric,3) FROM published_predictions GROUP BY 1,2 ORDER BY 4;"
```

---

## Guardrails

- Smallest change that satisfies the request; preserve existing behavior and the
  existing safe-SQL approach. Do not refactor the table pipeline for elegance.
- Match surrounding conventions (naming, discriminated-union results, test style).
- Light mode only; Fira Code for code/numeric panels.
- Put up a feature branch + PR targeting this fork's `main`; do not push to `main`
  directly.

---

## Explicitly out of scope (do NOT do here)

- Fixing the `DATABASE_URL` env mismatch (separate plan).
- Bootstrapping / confidence intervals vs. sample count (aspiration #3 — later).
- The workflow replay / trace viewer (#4) and parser playground (#5).
- Migrating off Neon to DuckDB/MotherDuck (#3 — later; this plan reads Neon).
- Using `published_pool_samples` (richer, 403k rows) — note it exists for future
  faceted heatmaps, but keep this plan on `published_predictions`.
</content>
