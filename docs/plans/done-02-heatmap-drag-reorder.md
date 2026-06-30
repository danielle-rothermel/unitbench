# Plan 02 — Heatmap axis ordering: manual drag-reorder

**Target repo:** `unitbench`. **Surface: the HEATMAP** (`ScoreHeatmap`), not the
aggregate table. **Effort:** medium. **Status:** ready.
**Branch:** feature branch off the current UI branch
(`feature/aggregate-view-heatmap` or its successor); not `main`.

---

## Why (the user's framing)

The heatmap is the user's single interrogation surface. **How the rows and columns
are arranged _is_ the analysis.** Concrete motivations from the user:

- The all-red `openai/gpt-5.4-nano` row (≈0.000 across the board) stretches the shared
  color scale and washes out contrast among the 0.6–0.99 models. Dragging it to the
  bottom lets the rest of the grid actually use the color range — an analytical need,
  not cosmetics.
- Sometimes the user wants to drag a category (`(none)` budget, a specific model) to a
  chosen spot by hand to hunt for visual patterns, without writing code or waiting for
  a rule to express it.

This plan delivers the **manual primitive** (drag). Rule-based sort/group comes next
(Plan 03) and layers on the same order-state.

## Order-state model (agreed)

- Each axis (rows = the first group-by dimension; columns = the second) has an
  **ordered list of category keys**.
- **"Sort is the baseline, drag is a tweak":** a drag mutates the current ordered list
  in place. (Applying a new sort — Plan 03 — recomputes the list from scratch,
  discarding manual tweaks. This plan only needs to implement the drag mutation +
  persistence; just structure the state so Plan 03 can overwrite it.)
- Persist the order to the **URL** (like all other heatmap state — see
  `src/lib/heatmap-params.ts`), so arrangements are shareable/bookmarkable. Suggest a
  compact param per axis, e.g. `rowOrder=` / `colOrder=` as comma-joined category keys
  (omit when it equals the natural/default order to keep URLs clean).

## What to build

1. Read the current heatmap rendering in `src/components/ScoreHeatmap.tsx` and its
   params in `src/lib/heatmap-params.ts` / `src/lib/heatmap-config.ts`. Determine where
   row and column category order is currently derived.
2. Introduce an explicit per-axis ordered category list, defaulting to today's order,
   overrideable by `rowOrder` / `colOrder` URL params.
3. Add **drag-to-reorder** on:
   - row headers (reorder heatmap rows), and
   - column headers (reorder heatmap columns).
   Use **`@dnd-kit`** (lightweight, modern; justify in the PR). Keep the dependency
   minimal — only the core + sortable preset.
4. On drop, update the order list and push the new URL state (use the existing
   transition/router pattern seen in `GenericTable`/the heatmap page).
5. Add a small **"Reset order"** affordance that clears the manual order params.

## Acceptance criteria

- [ ] User can drag a row header to a new vertical position; the grid reorders and the
      URL updates.
- [ ] User can drag a column header to a new horizontal position; same.
- [ ] Reloading the URL reproduces the arrangement (order is in the URL).
- [ ] "Reset order" returns to the default order.
- [ ] Dragging `gpt-5.4-nano` to the bottom visibly frees the color scale for the rest.
- [ ] `pnpm test`, `pnpm lint`, `tsc --noEmit` clean. Add/adjust a test for the
      order-param parse/serialize round-trip.

## Guardrails / scope

- HEATMAP only. Do not change the aggregate table or the shared filter controls here.
- Smallest change; preserve the existing heatmap rendering, color scale, and
  enc-dec-row-collapsing behavior.
- Light mode only; Fira Code for numeric cells.
- Accessibility: drag handles should be keyboard-operable if `@dnd-kit`'s keyboard
  sensor is low-cost to wire; otherwise note it as a follow-up (don't block).
- Out of scope: rule-based sort/group (Plan 03), checkbox filters (Plan 04). Just make
  the order-state shape forward-compatible with Plan 03 overwriting it.
</content>
