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

## v1 publish (whetstone-ai normalized tables)

The v1 publish path reads from the normalized dr-dspy v1 Postgres schema in
whetstone-ai (`dr_dspy_prediction_specs`, `dr_dspy_generation_runs`,
`dr_dspy_score_attempts`, and related tables). It publishes only predictions
whose latest generation run has a successful `humaneval@v1` score attempt.

Point `UNITBENCH_SOURCE_DATABASE_URL` at the whetstone v1 Postgres database. The
target env vars are unchanged.

Validate v1 source rows without writing:

```bash
uv run unitbench-publish dry-run-dr-dspy-v1
```

Smoke-publish a bounded subset:

```bash
uv run unitbench-publish publish-dr-dspy-v1 --limit 100
```

Publish all currently scored v1 rows:

```bash
uv run unitbench-publish publish-dr-dspy-v1 --batch-size 250
```

Optional filters while backfill/rescore is in progress:

```bash
uv run unitbench-publish publish-dr-dspy-v1 --experiment-name my-exp --graph-layout encdec
```

`init-db` creates both v0 and v1 published tables. `verify` prints counts for
all six tables.

### v1 published tables

- `published_v1_experiments`: one summary row per source experiment and graph layout.
- `published_v1_predictions`: compact browse rows for the v1 table viewer.
- `published_v1_prediction_details`: prompt/output/metric/detail rows for v1 detail pages.

Published IDs use the `dr-dspy-v1/{direct|encdec}/...` prefix so they stay
distinct from the legacy v0 published rows.
