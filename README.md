# unitbench

A hosted viewer for published benchmark and experiment results. A local Python CLI
(`tools/unitbench_publish`) curates experiment tables into Neon; the Next.js app reads
those tables server-side, with filterable/sortable browse tables and per-prediction
detail pages.

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
- The database connection is configured in `.env` via
  `DR_LLM_POSTGRES_SYNC_ADMIN_URL` (Neon Postgres). The app reads its tables
  server-side, so no Python tooling is needed just to view the dev server — the
  tables are populated separately by the `tools/unitbench_publish` CLI.

### Other scripts

- `pnpm build` then `pnpm start` — production build and serve
- `pnpm lint` — run ESLint
- `pnpm test` — run the Vitest suite
