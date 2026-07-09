from __future__ import annotations

from collections.abc import Sequence

PUBLISHED_EXPERIMENTS_TABLE = "published_experiments"
PUBLISHED_PREDICTIONS_TABLE = "published_predictions"
PUBLISHED_PREDICTION_DETAILS_TABLE = "published_prediction_details"

PUBLISHED_V1_EXPERIMENTS_TABLE = "published_v1_experiments"
PUBLISHED_V1_PREDICTIONS_TABLE = "published_v1_predictions"
PUBLISHED_V1_PREDICTION_DETAILS_TABLE = "published_v1_prediction_details"

PUBLISHED_V1_SWEEP_METRICS_TABLE = "published_v1_sweep_metrics"
PUBLISHED_V1_FAILURE_METRICS_TABLE = "published_v1_failure_metrics"

PUBLISHED_EXPERIMENT_COLUMNS: tuple[str, ...] = (
    "experiment_id",
    "source",
    "experiment_kind",
    "display_name",
    "row_count",
    "pass_count",
    "fail_count",
    "pending_count",
    "error_count",
    "pass_rate",
    "total_provider_cost",
    "first_created_at",
    "last_updated_at",
    "updated_at",
    "metadata_json",
)

PUBLISHED_PREDICTION_COLUMNS: tuple[str, ...] = (
    "prediction_id",
    "experiment_id",
    "source",
    "experiment_kind",
    "task_id",
    "sample_index",
    "model",
    "result_state",
    "generation_status",
    "scoring_status",
    "score",
    "provider_cost",
    "created_at",
    "updated_at",
    "summary_json",
)

PUBLISHED_PREDICTION_DETAIL_COLUMNS: tuple[str, ...] = (
    "prediction_id",
    "experiment_id",
    "input_kind",
    "input_text",
    "output_kind",
    "output_text",
    "prompt_text",
    "code_text",
    "raw_generation",
    "metrics_json",
    "request_json",
    "response_json",
    "validation_json",
    "updated_at",
)

CREATE_TABLE_SQL: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS published_experiments (
        experiment_id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        experiment_kind TEXT NOT NULL,
        display_name TEXT NOT NULL,
        row_count INTEGER NOT NULL,
        pass_count INTEGER NOT NULL,
        fail_count INTEGER NOT NULL,
        pending_count INTEGER NOT NULL,
        error_count INTEGER NOT NULL,
        pass_rate DOUBLE PRECISION,
        total_provider_cost DOUBLE PRECISION,
        first_created_at TIMESTAMPTZ,
        last_updated_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS published_predictions (
        prediction_id TEXT PRIMARY KEY,
        experiment_id TEXT NOT NULL
            REFERENCES published_experiments(experiment_id) ON DELETE CASCADE,
        source TEXT NOT NULL,
        experiment_kind TEXT NOT NULL,
        task_id TEXT,
        sample_index INTEGER,
        model TEXT,
        result_state TEXT NOT NULL,
        generation_status TEXT,
        scoring_status TEXT,
        score DOUBLE PRECISION,
        provider_cost DOUBLE PRECISION,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        summary_json JSONB NOT NULL DEFAULT '{}'::jsonb
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS published_prediction_details (
        prediction_id TEXT PRIMARY KEY
            REFERENCES published_predictions(prediction_id) ON DELETE CASCADE,
        experiment_id TEXT NOT NULL,
        input_kind TEXT NOT NULL,
        input_text TEXT,
        output_kind TEXT NOT NULL,
        output_text TEXT,
        prompt_text TEXT,
        code_text TEXT,
        raw_generation TEXT,
        metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        request_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        response_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        validation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
)

CREATE_TABLE_SQL_V1: tuple[str, ...] = tuple(
    statement.replace("published_experiments", PUBLISHED_V1_EXPERIMENTS_TABLE)
    .replace("published_predictions", PUBLISHED_V1_PREDICTIONS_TABLE)
    .replace("published_prediction_details", PUBLISHED_V1_PREDICTION_DETAILS_TABLE)
    for statement in CREATE_TABLE_SQL
)

CREATE_INDEX_SQL: tuple[str, ...] = (
    """
    CREATE INDEX IF NOT EXISTS idx_published_experiments_updated
    ON published_experiments(updated_at DESC)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_published_predictions_experiment_updated
    ON published_predictions(experiment_id, updated_at DESC)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_published_predictions_result_state
    ON published_predictions(result_state)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_published_predictions_task
    ON published_predictions(task_id)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_published_predictions_model
    ON published_predictions(model)
    """,
)

PUBLISHED_V1_SWEEP_METRIC_COLUMNS: tuple[str, ...] = (
    "metric_key",
    "source",
    "grouping",
    "model",
    "task_id",
    "experiment_kind",
    "n",
    "pass_count",
    "fail_count",
    "pending_count",
    "error_count",
    "rate_limit_count",
    "included_in_pass_rate_count",
    "scored_n",
    "pass_rate",
    "avg_score",
    "stddev_score",
    "avg_cost",
    "total_cost",
    "avg_latency_ms",
    "p95_latency_ms",
    "avg_provider_latency_ms_proxy",
    "p95_provider_latency_ms_proxy",
    "pass_rate_rank",
    "computed_at",
    "updated_at",
)

PUBLISHED_V1_FAILURE_METRIC_COLUMNS: tuple[str, ...] = (
    "metric_key",
    "source",
    "model",
    "display_model",
    "node_id",
    "failure_class",
    "error_type",
    "attempt_count",
    "prediction_count",
    "computed_at",
    "updated_at",
)

CREATE_METRICS_TABLE_SQL: tuple[str, ...] = (
    f"""
    CREATE TABLE IF NOT EXISTS {PUBLISHED_V1_SWEEP_METRICS_TABLE} (
        metric_key TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        grouping TEXT NOT NULL,
        model TEXT,
        task_id TEXT,
        experiment_kind TEXT,
        n INTEGER NOT NULL,
        pass_count INTEGER NOT NULL,
        fail_count INTEGER NOT NULL,
        pending_count INTEGER NOT NULL,
        error_count INTEGER NOT NULL,
        rate_limit_count INTEGER NOT NULL,
        included_in_pass_rate_count INTEGER NOT NULL,
        scored_n INTEGER NOT NULL,
        pass_rate DOUBLE PRECISION,
        avg_score DOUBLE PRECISION,
        stddev_score DOUBLE PRECISION,
        avg_cost DOUBLE PRECISION,
        total_cost DOUBLE PRECISION,
        avg_latency_ms DOUBLE PRECISION,
        p95_latency_ms DOUBLE PRECISION,
        avg_provider_latency_ms_proxy DOUBLE PRECISION,
        p95_provider_latency_ms_proxy DOUBLE PRECISION,
        pass_rate_rank INTEGER,
        computed_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    f"""
    CREATE TABLE IF NOT EXISTS {PUBLISHED_V1_FAILURE_METRICS_TABLE} (
        metric_key TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        model TEXT NOT NULL,
        display_model TEXT,
        node_id TEXT NOT NULL,
        failure_class TEXT NOT NULL,
        error_type TEXT,
        attempt_count INTEGER NOT NULL,
        prediction_count INTEGER NOT NULL,
        computed_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
)

CREATE_METRICS_INDEX_SQL: tuple[str, ...] = (
    f"""
    CREATE INDEX IF NOT EXISTS idx_published_v1_sweep_metrics_grouping_model
    ON {PUBLISHED_V1_SWEEP_METRICS_TABLE}(grouping, model)
    """,
    f"""
    CREATE INDEX IF NOT EXISTS idx_published_v1_sweep_metrics_grouping_task
    ON {PUBLISHED_V1_SWEEP_METRICS_TABLE}(grouping, task_id)
    """,
)

METRICS_COLUMN_COMMENT_SQL: tuple[str, ...] = (
    f"""
    COMMENT ON COLUMN {PUBLISHED_V1_SWEEP_METRICS_TABLE}.rate_limit_count IS
    'Lower bound on v0-backfilled data: v0 persisted only terminal failures, so '
    '429s that were retried and eventually succeeded are not counted. Complete '
    'for native v1 runs.'
    """,
    f"""
    COMMENT ON COLUMN {PUBLISHED_V1_SWEEP_METRICS_TABLE}.avg_latency_ms IS
    'Measured node-attempt latency (completed_at - started_at). NULL for '
    'v0-backfilled rows, whose timestamps are synthetic (generated_at/scored_at).'
    """,
    f"""
    COMMENT ON COLUMN {PUBLISHED_V1_SWEEP_METRICS_TABLE}.p95_latency_ms IS
    'Measured node-attempt latency (completed_at - started_at). NULL for '
    'v0-backfilled rows, whose timestamps are synthetic (generated_at/scored_at).'
    """,
    f"""
    COMMENT ON COLUMN
    {PUBLISHED_V1_SWEEP_METRICS_TABLE}.avg_provider_latency_ms_proxy IS
    'Provider-reported timing extracted from response_metadata; a proxy, NOT '
    'measured LLM latency. NULL when the provider payload carries no timing keys.'
    """,
    f"""
    COMMENT ON COLUMN
    {PUBLISHED_V1_SWEEP_METRICS_TABLE}.p95_provider_latency_ms_proxy IS
    'Provider-reported timing extracted from response_metadata; a proxy, NOT '
    'measured LLM latency. NULL when the provider payload carries no timing keys.'
    """,
    f"""
    COMMENT ON COLUMN {PUBLISHED_V1_SWEEP_METRICS_TABLE}.included_in_pass_rate_count IS
    'pass_rate denominator: predictions whose model output genuinely exercised '
    'extraction + testing. Model-caused failures (incl. unparseable output) count; '
    'provider/infra errors and incomplete evaluations are excluded.'
    """,
)

CREATE_INDEX_SQL_V1: tuple[str, ...] = tuple(
    statement.replace("published_experiments", PUBLISHED_V1_EXPERIMENTS_TABLE)
    .replace("published_predictions", PUBLISHED_V1_PREDICTIONS_TABLE)
    .replace("published_prediction_details", PUBLISHED_V1_PREDICTION_DETAILS_TABLE)
    .replace("idx_published_", "idx_published_v1_")
    for statement in CREATE_INDEX_SQL
)


def insert_upsert_sql(table: str, columns: Sequence[str], primary_key: str) -> str:
    column_sql = ", ".join(columns)
    value_sql = ", ".join(f"%({column})s" for column in columns)
    update_columns = [column for column in columns if column != primary_key]
    update_sql = ", ".join(f"{column} = EXCLUDED.{column}" for column in update_columns)
    return (
        f"INSERT INTO {table} ({column_sql}) VALUES ({value_sql}) "
        f"ON CONFLICT ({primary_key}) DO UPDATE SET {update_sql}"
    )
