# unitbench

A hosted viewer for accepted benchmark and experiment results. The Next.js app reads
validated, pinned Analysis and Detail publication bundles server-side, with 
filterable/sortable browse tables, per-prediction detail pages, an aggregate 
view (`/aggregate`), and a score heatmap (`/aggregate/heatmap`).

## Local development

This is a Next.js app managed with [pnpm](https://pnpm.io/) (`pnpm@9.15.2`).

```bash
# 1. Install JS dependencies
pnpm install

# 2. Start the Next.js dev server
pnpm dev
```

The dev server runs at http://localhost:3000.

### Notes

- Use **pnpm**, not `npm`/`yarn` — the repo is pinned via the `packageManager`
  field and uses `pnpm-lock.yaml`.
- Configure the server-only stores in `.env`: `ANALYSIS_DATABASE_URL` for the
  Analysis bundle and `DATABASE_URL` for the Neon Detail bundle. See
  `.env.example`; each bundle has its own publication destination ID.

### Other scripts

- `pnpm build` then `pnpm start` — production build and serve
- `pnpm lint` — run ESLint
- `pnpm test` — run the Vitest suite
