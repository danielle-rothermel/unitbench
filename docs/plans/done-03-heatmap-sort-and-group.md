# Plan 03 — Heatmap axis ordering: rule-based sort & group

**Target repo:** `unitbench`. **Surface: the HEATMAP** (`ScoreHeatmap`).
**Effort:** medium. **Status:** ready. **Depends on:** Plan 02 (shares the per-axis
order-state). **Branch:** feature branch, not `main`.

---

## Why (the user's framing)

After manual drag (Plan 02), the user wants to set axis order **by a rule**, because
different questions want different arrangements of the same grid:

- "Order models by avg pass rate" (by a **measure**).
- "Budget axis should go `0.25 → 0.5 → … → 2.0 → (none)`" — `(none)` means
  unbounded, so it belongs at the **high end**, not where it falls alphabetically (by
  a **semantic value order**).
- "Group all direct runs at the bottom" / "cluster models by provider" (by a
  **derived key** — `experiment_kind`, or the provider prefix of the model id).

Key insight: sort, semantic-order, and group are all **the same operation** — setting
the ordered category list for an axis — just with different order keys.

## Interaction model (agreed)

- **Sort is the baseline, drag is a tweak.** Applying a sort **recomputes** the axis's
  ordered list from scratch (overwriting any manual drag order from Plan 02). After
  that, the user may drag to tweak again.
- Reuse the existing **selector + chip** UI pattern (as in `AggregateFilterFields`):
  an external control to choose, per axis, an **order key** and **direction**.

## Order keys to support (per axis)

1. **By measure** — order categories by an aggregate of the cell values along that
   axis (e.g. order model rows by their mean pass rate, asc/desc).
2. **By semantic value order** — a per-column declared order. Implement the config hook
   here and define `budget` as `… → 2.0 → (none)` with **`(none)` last**. Values not in
   the declared list fall back to natural order, appended after known ones (document
   the choice).
3. **By derived key / group** — order/cluster by a derived attribute:
   - `experiment_kind` (so direct vs enc-dec cluster together), and
   - provider (the prefix before `/` in the model id, e.g. `openai`, `deepseek`).
   Within a group, fall back to a secondary order (measure or name).

## What to build

1. Build on Plan 02's per-axis ordered-list state + URL params.
2. Add a per-axis order control (selector + direction), emitting an order spec to the
   URL (e.g. `rowSort=measure:desc`, `colSort=value`, `rowSort=group:provider`).
3. Compute the ordered category list from the spec, then render the heatmap from it.
   Manual drag (Plan 02) continues to mutate the resulting list until the next sort.
4. Implement the semantic value-order config hook (item 2 above) — confirm the real
   `budget` column name + distinct values against Neon before hardcoding the order.

## Acceptance criteria

- [ ] User can order model rows by mean pass rate (asc/desc) from an external control.
- [ ] Budget column axis orders with `(none)` at the high end.
- [ ] User can group rows by `experiment_kind` (direct vs enc-dec cluster) and by
      provider.
- [ ] Applying a sort overwrites a prior manual drag order; dragging afterward still
      works.
- [ ] Order spec is in the URL and reproduces on reload.
- [ ] `pnpm test`, `pnpm lint`, `tsc --noEmit` clean; tests for the value-order helper
      (incl. `(none)`-last and unknown-value fallback) and for derived-key grouping.

## Guardrails / scope

- HEATMAP only. Reuse the existing selector/chip components; don't build a new control
  style.
- Keep safe-SQL discipline if any ordering is pushed to SQL (validated identifiers,
  parameterized values); ordering computed in TypeScript over fetched aggregates is
  also fine — pick the smaller change.
- Light mode; Fira Code for numeric text.
- Out of scope: drag mechanics (Plan 02), checkbox filters (Plan 04).
</content>
