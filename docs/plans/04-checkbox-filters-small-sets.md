# Plan 04 — Simple checkbox filters for small-cardinality columns

**Target repo:** `unitbench`. **Surface:** the shared filter controls
(`AggregateFilterFields`), used by both the aggregate and heatmap pages.
**Effort:** medium. **Status:** ready. **Branch:** feature branch, not `main`.

---

## Why

The current filter UX (`src/components/AggregateFilterFields.tsx`) requires, per
column: pick a value from a dropdown → click "Add" → it becomes a chip — with
**separate Include and Exclude selectors**. For a column with only a handful of values
(e.g. `experiment_kind` = 2, a small budget set), that's far more clicking than
"tick the ones I want."

## What to build

When a column's distinct-value count is **below a threshold (default 12; make it a
named constant, range 10–15)**, render a **simple checkbox list** instead of the
selector+chip control. Otherwise keep the existing selector control (for high-card
columns like `model` = 39, `task_id` = 164).

**Interaction model (agreed — simple, not tri-state):**
- Each value has one checkbox.
- **0 boxes checked = no filter on this column (show all).**
- **≥1 checked = include only the checked values** (writes to `filterIn`).
- Unchecked values are simply not included; there is no separate "exclude" expression
  in the checkbox UI. (Exclude remains available via the existing selector control for
  high-cardinality columns; do not remove it there.)

This is purely a better **input control** over the existing `AggregateFilters` shape
(`filterIn` / `filterOut` in `src/lib/aggregate-filters.ts`) — the underlying state,
URL serialization, and query building are unchanged.

## Implementation notes

- The facets query already returns each column's distinct values
  (`AggregateFacets`) — use its length to decide checkbox vs selector. No new query.
- Keep the existing `onChange(next: AggregateFilters)` contract; checkboxes just
  compute the next `filterIn[column]` array.
- Preserve current styling/conventions (`SECTION_LABEL`, control classes, light mode).

## Acceptance criteria

- [ ] `experiment_kind` (2 values) renders as checkboxes; checking one filters to it;
      unchecking all clears the filter.
- [ ] A high-cardinality column (`model`) still uses the selector+chip control.
- [ ] The threshold is a single named constant.
- [ ] URL state and query results match the equivalent selector-based filter (a
      checkbox include and a selector include produce the same `filterIn`).
- [ ] `pnpm test`, `pnpm lint`, `tsc --noEmit` clean; test the checkbox→filterIn
      mapping incl. the "0 checked = no filter" rule.

## Guardrails / scope

- Smallest change; do not restructure `AggregateFilterFields` beyond branching on
  cardinality. Keep the selector path intact for high-card columns.
- Light mode; existing component conventions.
- Out of scope: heatmap ordering (Plans 02–03).
</content>
