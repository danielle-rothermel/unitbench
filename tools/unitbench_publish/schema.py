from __future__ import annotations

from collections.abc import Sequence

PUBLISHED_EXPERIMENTS_TABLE = "published_experiments"
PUBLISHED_PREDICTIONS_TABLE = "published_predictions"
PUBLISHED_PREDICTION_DETAILS_TABLE = "published_prediction_details"

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


def insert_upsert_sql(table: str, columns: Sequence[str], primary_key: str) -> str:
    column_sql = ", ".join(columns)
    value_sql = ", ".join(f"%({column})s" for column in columns)
    update_columns = [column for column in columns if column != primary_key]
    update_sql = ", ".join(f"{column} = EXCLUDED.{column}" for column in update_columns)
    return (
        f"INSERT INTO {table} ({column_sql}) VALUES ({value_sql}) "
        f"ON CONFLICT ({primary_key}) DO UPDATE SET {update_sql}"
    )
