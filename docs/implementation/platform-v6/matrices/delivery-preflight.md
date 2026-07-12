# Unitbench delivery preflight

Status: executable preflight for the Platform v6 Unitbench cut; 2026-07-11.

This matrix fixes the delivery boundary before the Analysis and Detail adapters
land. A live same-physical-fixture probe now proves the two available driver
representations normalize equally, but permanent every-query adapter parity
remains a blocking U2/U5 gate.

## Runtime and secret scenarios

| Analysis configuration | Detail configuration | Analysis routes | Detail routes | Fixture-only `/dev/*` routes |
| --- | --- | --- | --- | --- |
| missing | missing | fail closed as Analysis missing | fail closed as Detail missing | render |
| configured | missing | render | fail closed as Detail missing | render |
| missing | configured | fail closed as Analysis missing | render | render |
| configured | configured | render | render | render |

`ANALYSIS_DATABASE_URL` owns only the deployed MotherDuck Postgres Analysis
connection. `DATABASE_URL` owns only the Neon Detail connection. The root route
declares the Next.js Node runtime. Any module that reads either value must
import `server-only`; neither value may have a `NEXT_PUBLIC_` form.

## Packaging scenarios

| Scenario | Required evidence | Preflight result |
| --- | --- | --- |
| Local Analysis | Native DuckDB is a development-only adapter selected by `LOCAL_ANALYSIS_DATABASE_PATH`. | Deferred until U1; no native DuckDB dependency exists yet. |
| Preview/production Analysis | MotherDuck uses its Postgres endpoint under the Node runtime. | The endpoint and same-fixture parity are live; Vercel `ANALYSIS_DATABASE_URL` is not configured yet. |
| Production bundle | No `duckdb` or `@duckdb/*` native package appears in production dependencies or Next output traces. | Executable package and trace check added; it fails closed until `pnpm build` produces at least one trace. Current build passes. |
| Missing Analysis secret | Analysis fails without changing Detail readiness. | Four-state unit matrix passes. |
| Missing Detail secret | Detail fails without changing Analysis readiness. | Four-state unit matrix passes. |

## Query and view-model parity prerequisites

The first durable parity fixture uses the existing dashboard point and
distribution row boundaries. Local DuckDB may return numeric values while the
MotherDuck Postgres driver may return numeric text or bigint values. Both must
produce byte-equivalent typed view models from the same logical fixture.

The permanent adapter suite must execute the same query text and parameters
against a tiny exported fixture in both stores, validate every returned row at
the same boundary, and compare normalized view models. The preflight test pins
the normalization contract now.

A credential-safe live probe created one temporary MotherDuck physical
fixture, then read it through both the DuckDB `md:` client and MotherDuck's
PostgreSQL endpoint. Both returned `prediction_id`, `DECIMAL`, and `BIGINT` as
the expected string, decimal, and integer representations, and the normalized
rows were equal. The temporary schema was dropped. No credential or connection
string was printed. This establishes driver and endpoint feasibility; U1/U2
must turn the probe into the permanent adapter contract/query-fixture suite
once those adapters and their declared dependencies exist. A mock or two
separately authored expected outputs cannot satisfy that gate.

## Live Vercel inspection

Inspection used Vercel CLI 55.0.0 against the linked `unitbench` project and
did not read or print secret values.

| Check | Observed state | Gate |
| --- | --- | --- |
| Framework | Next.js | pass |
| Production URL | `https://unitbench.vercel.app` | pass |
| Node runtime | 24.x | pass; root route now explicitly selects Node.js |
| `DATABASE_URL` | encrypted; Preview and Production | pass for the current Detail path |
| `ANALYSIS_DATABASE_URL` | absent | expected pre-cut blocker; configure during U5 |
| Preview scope | `DATABASE_URL` present | pass for current Detail path |

A separate credential-safe MotherDuck preflight authenticated to the
MotherDuck PostgreSQL endpoint with SSL and completed a temporary-table
round-trip. The driver returned the expected integer, decimal, and text
representations. This proves that `ANALYSIS_DATABASE_URL` is constructible from
the existing credential when U2/U5 wire it; the credential itself was neither
recorded nor printed. It does not replace the same-query adapter parity suite.

Secret rotation and a live preview with both independently scoped variables
remain U5 acceptance work.

## Commands

```bash
pnpm test -- src/lib/store-environment.server.test.ts src/lib/delivery-parity.test.ts
pnpm build
pnpm check:delivery-preflight
```
