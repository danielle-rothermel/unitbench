# AGENTS.md — unitbench

Guidance for coding agents working in this repo. See `PRODUCT.md` for product
direction and design constraints (light mode only, OKLCH token system, density
as a feature).

docs swept 2026-07-07

## Stack and conventions

- **Package manager:** pnpm (pinned via `packageManager: pnpm@9.15.2`). Never
  use npm or yarn; the lockfile is `pnpm-lock.yaml`.
- **Framework:** Next.js (v16) App Router under `src/app/`, React 19,
  TypeScript throughout. Pages are React Server Components that read pinned,
  published Platform v6 Analysis and Detail bundles server-side via the
  adapters in `src/lib/bundle-adapter.server.ts`;
  interactive pieces are colocated `'use client'` components in
  `src/components/`.
- **Styling:** Tailwind CSS 4 with the OKLCH design-token system in
  `src/app/globals.css` — extend the tokens, don't bypass them.
- **Tests:** Vitest (jsdom + Testing Library), colocated next to the code they
  cover (`src/**/*.test.ts(x)`). `pnpm test` runs `vitest run`. Config:
  `vitest.config.ts`; setup: `src/test/setup.ts`.
- **Lint:** `pnpm lint` (flat ESLint config in `eslint.config.js`).
- **Data naming:** snake_case keys everywhere data crosses a boundary — fixture
  keys, table column keys (`src/lib/table-config.ts`), and detail fields are
  the Neon column / JSONB payload keys, verbatim. A component built against a
  fixture row must render a SQL result row with zero mapping.

## Current app surfaces

- `/` — home: allowlisted table cards plus Analysis/Detail bundle status
  (`src/app/page.tsx`).
- `/tables/[tableId]` — tables explorer: filterable/sortable browse tables over
  the allowlisted published bundle projections defined in `src/lib/table-config.ts`
  (experiments, predictions, prediction details, and their v1 variants). The
  predictions tables are the predictions browser; rows link to detail pages.
- `/predictions/[...predictionId]` — per-prediction detail: outcome banner,
  run-config strip, enc/dec pipeline, diagnostics, reference sections
  (`src/components/PredictionDetailPage.tsx`, `src/components/prediction/`).
- `/aggregate` — aggregate view: group-by/measure aggregation with filters
  (`src/lib/aggregate-config.ts`, `aggregate-data.ts`).
- `/aggregate/heatmap` — score heatmap over model x task cells
  (`src/components/ScoreHeatmap.tsx`, `src/lib/heatmap-*.ts`).
- `src/fixtures/` — fake-data fixture package for the six viz components
  (REL-13): seeded RNG, sweep/extraction/compression/pipeline/bootstrap/heatmap
  generators. Shapes double as the component API contract.

## FROZEN fixture contract

`docs/planning/viz-components/v0/plan.md` plus its implementation in `src/fixtures/`
is the FROZEN contract for the R1–R6 component work. Do not change fixture
shapes, keys, or value sets while building components against them — build to
the contract, and raise a flag if the contract seems wrong.

## Skill routing

Before doing frontend work in this repo, read the vendored skills in
`.claude/skills/` and apply the relevant ones:

- `next-best-practices` — App Router conventions, RSC boundaries, async APIs
- `typescript-best-practices` — type-first idioms, discriminated unions, Zod
- `react-components`, `vercel-react-best-practices`,
  `vercel-composition-patterns` — component structure and composition
- `vitest`, `webapp-testing` — test writing and app-level testing
- `dataviz` — chart selection and dashboard design
- `pnpm` — package-manager usage
- `html-anything`, `polish` — HTML generation and UI polish

## Environment

The app reads server-only v6 store configuration: `DATABASE_URL` and
`DETAIL_PUBLICATION_DESTINATION_ID` for Detail; either
`ANALYSIS_DATABASE_URL` or `LOCAL_ANALYSIS_DATABASE_PATH`, plus
`ANALYSIS_PUBLICATION_DESTINATION_ID`, for Analysis. Copy `.env.example` to
`.env` and select one Analysis transport. Without a complete plane
configuration, its pages render an actionable store-not-configured notice.

## Agent skills

### Issue tracker

Issues live in GitHub; external PRs are not a request surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the canonical five-role triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository. See `docs/agents/domain.md`.

### Planning docs

Versioned efforts live under `docs/planning/<effort>/`; only draft versions are mutable. See `docs/agents/planning.md`.
