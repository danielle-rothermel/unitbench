# unitbench

register: product

## What it is

A research workbench for LLM evaluation experiments. Today: a hosted
read-only viewer (Next.js + Neon) over published experiment tables —
browse experiments/predictions, aggregate views, score heatmap,
per-prediction detail pages. Target: the single web app composing all
experiment tooling — data dashboards (correctness vs. compression),
workflow replay/diff, interactive playgrounds (provider queries, parser
stage-by-stage), and graph spec viewing/building — over the dr-*
library family extracted from whetstone-ai (see
`../whetstone-ai/docs/composable/overall.md`).

## Audience

One expert user (the researcher) plus coding agents building and using
the tool. Data-dense instrument panel, not a marketing surface.
Efficiency and legibility over onboarding; keyboard-friendly; no
multi-tenant concerns.

## Design constraints

- **Light mode only.** No dark mode, no toggle.
- **Fonts:** Fira Code (mono, ligatures) for code/data; Hanken Grotesk
  (sans) + Space Grotesk (display) currently in place — pairing under
  review.
- **OKLCH token system** in `src/app/globals.css` (semantic status
  colors, syntax tokens, motion vars) — extend it, don't bypass it.
- Tables and detail views are the core surfaces; density is a feature.
- The core interaction being built toward: aggregate view → click
  anomaly → sample detail (collapse the spot-it/diagnose-it loop).

## Key docs

- `docs/2026-06-30-aspirations-and-roadmap.md` — product direction
- `docs/issues.md` — known gaps
