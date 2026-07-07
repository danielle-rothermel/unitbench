> **RETIRES AT D3 MERGE** — this drives/feeds the in-flight workbench PR #4 and becomes historical when it merges (open items migrate to Linear then). Tracked in Linear S17/DEV-21.

# Unitbench — Issues, Gaps & Growth Opportunities

_Captured 2026-06-30. A review of the current implementation: what's truly broken,
what should be made better, and what would let the site grow substantially with
lower risk._

The codebase is in good shape overall — parameterized queries throughout, a real
SQL-identifier allowlist, discriminated-union result types instead of throwing, and
genuine unit tests on the tricky logic (pagination, params, sql-identifiers,
table-config). `tsc --noEmit` and `eslint .` both currently pass clean. The issues
below are concentrated at the **seams**: configuration, dev experience, and
architecture — not in the core logic.

Items are grouped by severity and ordered by recommended fix priority.

---

## 🔴 Truly broken / high-risk

### 1. Env var name mismatch — the app does not work out of the box

- **What:** `src/lib/neon.ts:18` reads `process.env.DATABASE_URL`, but `.env` only
  defines `DR_LLM_POSTGRES_SYNC_ADMIN_URL`. So `pnpm dev` currently renders
  **"DATABASE_URL not configured"** on every page.
- **Impact:** A fresh `pnpm install && pnpm dev` produces a non-functional site.
  First thing anyone hits.
- **Fix (recommended):** Rename the var in `.env` to `DATABASE_URL=...` — the entire
  codebase and all UI copy already say `DATABASE_URL`.
- **Alternative:** Support both in `neon.ts`:
  `process.env.DATABASE_URL ?? process.env.DR_LLM_POSTGRES_SYNC_ADMIN_URL`.

### 2. No `.env.example` — the required env var is undocumented

- **What:** `.env` is correctly gitignored (good — the live Neon credential is not
  committed), but that means a fresh clone has **zero** record of which env var is
  needed. No `.env.example`, no mention in the README.
- **Impact:** New devs (or future-you) can't tell the app needs `DATABASE_URL`
  without reading `neon.ts`. Compounds issue #1.
- **Fix:** Add a committed `.env.example` with a placeholder
  `DATABASE_URL=postgresql://...` (no real creds) and reference it in the README.

---

## 🟠 Should be better — will bite as the site grows

### 3. `force-dynamic` on every page — a DB round-trip per request, no caching

- **What:** All three pages declare `export const dynamic = 'force-dynamic'`. For
  read-only published tables that only change when the Python `unitbench_publish`
  CLI republishes, this discards Next 16's biggest performance lever.
- **Impact:** Every page view runs fresh Neon queries → latency + serverless cost
  that scales with traffic.
- **Fix:** Adopt a caching strategy fit for read-mostly data — Next 16 Cache
  Components / `revalidate`, ideally with tag-based invalidation the publish CLI can
  trigger on republish. Worth a deliberate pass before real traffic.

### 4. Unbounded facet query, run serially

- **What:** `getTableFacets` (`src/lib/table-data.ts:159`) runs
  `SELECT DISTINCT col FROM table` with **no LIMIT** for every facet column, and
  `tables/[tableId]/page.tsx:31` awaits it *after* the page query rather than in the
  existing `Promise.all`.
- **Impact:** On high-cardinality columns (e.g. `model`, `task_id`) this becomes a
  full scan returning thousands of rows just to build a filter dropdown — and it
  blocks render. Gets slow as tables grow.
- **Fix:** Cap results (`LIMIT 500`) and fold the facet fetch into the page-level
  `Promise.all` so it runs in parallel with the row fetch.

### 5. No CI and no Node version pin

- **What:** A real test suite (`pnpm test`) and lint exist, but no
  `.github/workflows` running them, and no `.nvmrc` / `engines` field.
- **Impact:** Tests/lint/typecheck only run when someone remembers; "works on my
  machine" Node drift is unguarded. Quality that already exists isn't enforced.
- **Fix:** Add a GitHub Actions workflow
  (`pnpm install --frozen-lockfile`, `lint`, `typecheck`, `test`, `build`) plus a
  `.nvmrc`.

### 6. Missing `typecheck` script

- **What:** `tsc` only runs implicitly via `next build`. There is no
  `pnpm typecheck`, so type errors can't be gated cheaply in CI without a full build.
- **Fix:** Add `"typecheck": "tsc --noEmit"`, and an umbrella
  `"check": "pnpm lint && pnpm typecheck && pnpm test"`.

### 7. No formatter

- **What:** No Prettier/Biome config or dependency. ESLint is not formatting, so
  style consistency relies on each editor agreeing.
- **Impact:** Noisy, inconsistent diffs over time.
- **Fix:** Add Prettier + `eslint-config-prettier`, or adopt Biome (lint + format in
  one fast tool).

---

## 🟡 Minor / housekeeping

### 8. Duplicated UI copy

- **What:** The "DATABASE_URL not configured" title/message strings are
  hand-duplicated across `src/app/page.tsx`,
  `src/app/tables/[tableId]/page.tsx`, and
  `src/app/predictions/[...predictionId]/page.tsx`.
- **Impact:** Drifts easily; coupled to the bug in #1.
- **Fix:** Hoist to a single shared constant.

### 9. Empty `next.config.ts`

- **What:** `next.config.ts` is `{}`. Fine for now, but it's where `images`,
  security headers, etc. will eventually live. Flagged so it's a conscious choice,
  not an oversight.

### 10. No pre-commit hooks

- **What:** No husky/lint-staged; nothing blocks a broken commit locally.
- **Note:** Optional. CI (#5) covers the same ground and is harder to bypass.
  Add hooks only if fast local feedback is wanted.

---

## 🟢 Growth enablers — lower risk for scaling the site

### 11. Typed DB access layer (Drizzle — incremental)

- **Problem today:** Type safety between the DB and TypeScript is manual.
  `PredictionDetail` (24 hand-maintained fields in
  `src/lib/prediction-detail.ts`) and the `TableRow = Record<string, unknown>`
  casts mean schema drift in a published table isn't caught until runtime.
- **Recommendation:** **Drizzle**, adopted incrementally — not Prisma.
  - Drizzle is lightweight, SQL-first, with first-class
    `@neondatabase/serverless` support, and gives typed results **without** forcing
    us to own migrations (the schema is owned by the Python `unitbench_publish`
    CLI).
  - Start with the **static** queries — `published_predictions` /
    `published_prediction_details` in `prediction-detail.ts` — to gain typed
    results where they help most.
  - Keep the **dynamic** `GenericTable` path (driven by `TABLE_CONFIGS`) on the
    current allowlisted raw SQL. Drizzle's type system fights fully-dynamic column
    selection, so the existing `sql-identifiers` machinery still earns its place.
- **Why not Prisma:** Heavyweight (schema file + codegen), less natural with the
  Neon HTTP driver, and its sweet spot is app-owned schemas with migrations — we
  introspect a schema we don't control, which is Prisma's awkward path.
- **Caveat:** This is an ergonomics/safety upgrade, not a correctness fix. Do it
  *after* the 🔴 and CI items.

### 12. Caching + invalidation as a first-class concern

- Pairs with #3. Once the publish CLI can emit a signal (tag/webhook) on republish,
  the site can serve cached pages and invalidate precisely — substantially better
  latency and cost as data and traffic grow.

---

## Suggested order of work

1. **#1 (env var name)** — one-line fix; the app is non-functional without it.
2. **#2 (`.env.example`)** — pairs naturally with #1; fix README claims.
3. **#6 + #5 (typecheck script + CI)** — cheap insurance for tests already written.
4. **#3 + #4 (caching + facet bounds)** — the real "scales badly" items; do before
   real traffic, in their own reviewable commits.
5. **#7 / #8 (formatter, dedup copy)** — low-effort polish.
6. **#11 (Drizzle, incremental)** — once the above are in, for safer growth.
