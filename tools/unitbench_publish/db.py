from __future__ import annotations

from collections.abc import Callable, Iterable, Sequence
from datetime import datetime
from typing import Any, TypeVar

import psycopg
from psycopg import Connection
from psycopg.rows import DictRow, dict_row
from psycopg.types.json import Jsonb
from pydantic import BaseModel

from unitbench_publish import schema

JsonFieldNames = frozenset(
    {
        "metadata_json",
        "summary_json",
        "metrics_json",
        "request_json",
        "response_json",
        "validation_json",
    }
)
T = TypeVar("T")


def connect(database_url: str) -> Connection[DictRow]:
    return psycopg.connect(database_url, row_factory=dict_row)


def init_published_schema(connection: Connection[Any]) -> None:
    for statement in (
        *schema.CREATE_TABLE_SQL,
        *schema.CREATE_INDEX_SQL,
        *schema.CREATE_TABLE_SQL_V1,
        *schema.CREATE_INDEX_SQL_V1,
    ):
        connection.execute(statement)
    connection.commit()
    init_metrics_schema(connection)


def init_metrics_schema(connection: Connection[Any]) -> None:
    """Create only the two v1 metrics projection tables (plus indexes/comments)."""
    for statement in (
        *schema.CREATE_METRICS_TABLE_SQL,
        *schema.CREATE_METRICS_INDEX_SQL,
        *schema.METRICS_COLUMN_COMMENT_SQL,
    ):
        connection.execute(statement)
    connection.commit()


def count_table(connection: Connection[Any], table: str) -> int:
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT count(*)::int AS row_count FROM {table}")
        row = cursor.fetchone()
    if row is None:
        return 0
    return int(row["row_count"])


def published_counts(connection: Connection[Any]) -> dict[str, int]:
    return {
        schema.PUBLISHED_EXPERIMENTS_TABLE: count_table(
            connection, schema.PUBLISHED_EXPERIMENTS_TABLE
        ),
        schema.PUBLISHED_PREDICTIONS_TABLE: count_table(
            connection, schema.PUBLISHED_PREDICTIONS_TABLE
        ),
        schema.PUBLISHED_PREDICTION_DETAILS_TABLE: count_table(
            connection, schema.PUBLISHED_PREDICTION_DETAILS_TABLE
        ),
        schema.PUBLISHED_V1_EXPERIMENTS_TABLE: count_table(
            connection, schema.PUBLISHED_V1_EXPERIMENTS_TABLE
        ),
        schema.PUBLISHED_V1_PREDICTIONS_TABLE: count_table(
            connection, schema.PUBLISHED_V1_PREDICTIONS_TABLE
        ),
        schema.PUBLISHED_V1_PREDICTION_DETAILS_TABLE: count_table(
            connection, schema.PUBLISHED_V1_PREDICTION_DETAILS_TABLE
        ),
        schema.PUBLISHED_V1_SWEEP_METRICS_TABLE: count_table(
            connection, schema.PUBLISHED_V1_SWEEP_METRICS_TABLE
        ),
        schema.PUBLISHED_V1_FAILURE_METRICS_TABLE: count_table(
            connection, schema.PUBLISHED_V1_FAILURE_METRICS_TABLE
        ),
    }


def model_params(model: BaseModel) -> dict[str, object]:
    params = model.model_dump(mode="python")
    for field_name in JsonFieldNames:
        if field_name in params:
            params[field_name] = Jsonb(params[field_name])
    return params


def upsert_models(
    connection: Connection[Any],
    *,
    table: str,
    columns: tuple[str, ...],
    primary_key: str,
    models: Iterable[BaseModel],
    batch_size: int = 500,
    progress: Callable[[str, int, int], None] | None = None,
) -> int:
    model_list = list(models)
    total = len(model_list)
    if not model_list:
        return total
    statement = schema.insert_upsert_sql(table, columns, primary_key)
    written = 0
    for batch in batches(model_list, batch_size):
        rows = [model_params(model) for model in batch]
        with connection.cursor() as cursor:
            cursor.executemany(statement, rows)
        connection.commit()
        written += len(rows)
        if progress is not None:
            progress(table, written, total)
    return written


def delete_stale_rows(
    connection: Connection[Any],
    *,
    table: str,
    source: str,
    computed_before: datetime,
) -> int:
    """Delete rows from a metrics rebuild whose computed_at predates this run."""
    with connection.cursor() as cursor:
        cursor.execute(
            f"DELETE FROM {table} "
            "WHERE source = %(source)s AND computed_at < %(computed_before)s",
            {"source": source, "computed_before": computed_before},
        )
        deleted = cursor.rowcount
    connection.commit()
    return deleted


def batches(items: Sequence[T], size: int) -> Iterable[Sequence[T]]:
    if size < 1:
        raise ValueError("batch size must be at least 1")
    for start in range(0, len(items), size):
        yield items[start : start + size]
