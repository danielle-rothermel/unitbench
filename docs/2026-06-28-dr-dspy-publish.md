# dr-dspy Publish Pipeline

Unitbench reads published tables from Neon. The local publish CLI copies a
viewer-friendly slice of the local dr-dspy experiment tables into the same Neon
database used by the Vercel app.

## Environment

Use separate variables so the script does not confuse the local source database
with the hosted read database:

```bash
export UNITBENCH_SOURCE_DATABASE_URL='postgresql://...local dr-dspy...'
export UNITBENCH_TARGET_DATABASE_URL='postgresql://...neon...'
export DATABASE_URL="$UNITBENCH_TARGET_DATABASE_URL"
```

`DATABASE_URL` is for the Next.js viewer. The publish commands use
`UNITBENCH_SOURCE_DATABASE_URL` and `UNITBENCH_TARGET_DATABASE_URL`.

## Commands

Create or update the published schema:

```bash
uv run unitbench-publish init-db
```

Validate the source rows without writing:

```bash
uv run unitbench-publish dry-run-dr-dspy
```

Smoke-publish a bounded subset from each dr-dspy prediction table:

```bash
uv run unitbench-publish publish-dr-dspy --limit 100
```

Publish all currently available dr-dspy rows:

```bash
uv run unitbench-publish publish-dr-dspy --batch-size 250
```

Check target counts:

```bash
uv run unitbench-publish verify
```

The publish command is idempotent. It upserts by published primary key, so
rerunning it updates rows rather than duplicating them.

Use a bounded `--batch-size` for the full detail-table publish. The detail rows
carry large prompt, output, and metrics payloads, and smaller committed batches
avoid oversized Neon/psycopg pipeline buffers.

## Published Tables

- `published_experiments`: one summary row per source experiment.
- `published_predictions`: compact browse rows for the table viewer.
- `published_prediction_details`: prompt/output/metric/detail rows for later
  detail pages.

DBOS runtime tables and raw workflow tables are not copied.
