from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Annotated

import typer

from unitbench_publish import db, dr_dspy, dr_dspy_v1, schema, sweep_metrics
from unitbench_publish.models import SweepMetricsDataset

SOURCE_DATABASE_URL_ENV = "UNITBENCH_SOURCE_DATABASE_URL"
TARGET_DATABASE_URL_ENV = "UNITBENCH_TARGET_DATABASE_URL"
TARGET_DATABASE_URL_FALLBACKS = (
    TARGET_DATABASE_URL_ENV,
    "DATABASE_URL",
    "DR_LLM_POSTGRES_SYNC_ADMIN_URL",
)


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if value:
        return value
    raise typer.BadParameter(f"{name} is required")


def first_env(*names: str) -> str | None:
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    return None


def source_database_url(value: str | None) -> str:
    return value or require_env(SOURCE_DATABASE_URL_ENV)


def target_database_url(value: str | None) -> str:
    if value:
        return value
    resolved = first_env(*TARGET_DATABASE_URL_FALLBACKS)
    if resolved:
        return resolved
    raise typer.BadParameter(
        f"{TARGET_DATABASE_URL_ENV}, DATABASE_URL, or "
        "DR_LLM_POSTGRES_SYNC_ADMIN_URL is required"
    )


app = typer.Typer(no_args_is_help=True)


@app.command("init-db")
def init_db(
    target_url: Annotated[
        str | None,
        typer.Option(
            "--target-database-url",
            help=f"Target Neon DSN. Defaults to {TARGET_DATABASE_URL_ENV}.",
        ),
    ] = None,
) -> None:
    """Create Unitbench published tables and indexes in the target database."""
    with db.connect(target_database_url(target_url)) as connection:
        db.init_published_schema(connection)
    typer.echo("initialized published Unitbench tables")


@app.command("dry-run-dr-dspy")
def dry_run_dr_dspy(
    source_url: Annotated[
        str | None,
        typer.Option(
            "--source-database-url",
            help=f"Source dr-dspy DSN. Defaults to {SOURCE_DATABASE_URL_ENV}.",
        ),
    ] = None,
    limit: Annotated[
        int | None,
        typer.Option("--limit", min=1, help="Limit rows per prediction source table."),
    ] = None,
) -> None:
    """Read and validate dr-dspy source rows without writing to Neon."""
    with db.connect(source_database_url(source_url)) as connection:
        dataset = dr_dspy.fetch_dr_dspy_dataset(connection, limit=limit)
    echo_dataset_summary("validated dr-dspy publish dataset", dataset)


@app.command("publish-dr-dspy")
def publish_dr_dspy(
    source_url: Annotated[
        str | None,
        typer.Option(
            "--source-database-url",
            help=f"Source dr-dspy DSN. Defaults to {SOURCE_DATABASE_URL_ENV}.",
        ),
    ] = None,
    target_url: Annotated[
        str | None,
        typer.Option(
            "--target-database-url",
            help=f"Target Neon DSN. Defaults to {TARGET_DATABASE_URL_ENV}.",
        ),
    ] = None,
    limit: Annotated[
        int | None,
        typer.Option("--limit", min=1, help="Limit rows per prediction source table."),
    ] = None,
    batch_size: Annotated[
        int,
        typer.Option("--batch-size", min=1, help="Rows to upsert per target batch."),
    ] = 500,
) -> None:
    """Publish dr-dspy rows into Unitbench Neon tables."""
    with db.connect(source_database_url(source_url)) as source_connection:
        dataset = dr_dspy.fetch_dr_dspy_dataset(source_connection, limit=limit)

    echo_dataset_summary("prepared dr-dspy publish dataset", dataset)
    with db.connect(target_database_url(target_url)) as target_connection:
        db.init_published_schema(target_connection)
        experiment_count = db.upsert_models(
            target_connection,
            table=schema.PUBLISHED_EXPERIMENTS_TABLE,
            columns=schema.PUBLISHED_EXPERIMENT_COLUMNS,
            primary_key="experiment_id",
            models=dataset.experiments,
            batch_size=batch_size,
            progress=echo_progress,
        )
        prediction_count = db.upsert_models(
            target_connection,
            table=schema.PUBLISHED_PREDICTIONS_TABLE,
            columns=schema.PUBLISHED_PREDICTION_COLUMNS,
            primary_key="prediction_id",
            models=dataset.predictions,
            batch_size=batch_size,
            progress=echo_progress,
        )
        detail_count = db.upsert_models(
            target_connection,
            table=schema.PUBLISHED_PREDICTION_DETAILS_TABLE,
            columns=schema.PUBLISHED_PREDICTION_DETAIL_COLUMNS,
            primary_key="prediction_id",
            models=dataset.details,
            batch_size=batch_size,
            progress=echo_progress,
        )
    typer.echo(
        "published "
        f"{experiment_count} experiments, "
        f"{prediction_count} predictions, "
        f"{detail_count} details"
    )


@app.command("dry-run-dr-dspy-v1")
def dry_run_dr_dspy_v1(
    source_url: Annotated[
        str | None,
        typer.Option(
            "--source-database-url",
            help=f"Source dr-dspy v1 DSN. Defaults to {SOURCE_DATABASE_URL_ENV}.",
        ),
    ] = None,
    limit: Annotated[
        int | None,
        typer.Option("--limit", min=1, help="Limit canonical v1 prediction rows."),
    ] = None,
    experiment_name: Annotated[
        list[str] | None,
        typer.Option(
            "--experiment-name",
            help="Restrict publish to one or more source experiment names.",
        ),
    ] = None,
    graph_layout: Annotated[
        str | None,
        typer.Option(
            "--graph-layout",
            help="Restrict publish to direct or encdec predictions.",
        ),
    ] = None,
) -> None:
    """Read and validate dr-dspy v1 source rows without writing to Neon."""
    with db.connect(source_database_url(source_url)) as connection:
        dataset = dr_dspy_v1.fetch_dr_dspy_v1_dataset(
            connection,
            experiment_names=experiment_name,
            graph_layout=graph_layout,
            limit=limit,
        )
    echo_dataset_summary("validated dr-dspy v1 publish dataset", dataset)


@app.command("publish-dr-dspy-v1")
def publish_dr_dspy_v1(
    source_url: Annotated[
        str | None,
        typer.Option(
            "--source-database-url",
            help=f"Source dr-dspy v1 DSN. Defaults to {SOURCE_DATABASE_URL_ENV}.",
        ),
    ] = None,
    target_url: Annotated[
        str | None,
        typer.Option(
            "--target-database-url",
            help=f"Target Neon DSN. Defaults to {TARGET_DATABASE_URL_ENV}.",
        ),
    ] = None,
    limit: Annotated[
        int | None,
        typer.Option("--limit", min=1, help="Limit canonical v1 prediction rows."),
    ] = None,
    batch_size: Annotated[
        int,
        typer.Option("--batch-size", min=1, help="Rows to upsert per target batch."),
    ] = 500,
    experiment_name: Annotated[
        list[str] | None,
        typer.Option(
            "--experiment-name",
            help="Restrict publish to one or more source experiment names.",
        ),
    ] = None,
    graph_layout: Annotated[
        str | None,
        typer.Option(
            "--graph-layout",
            help="Restrict publish to direct or encdec predictions.",
        ),
    ] = None,
) -> None:
    """Publish dr-dspy v1 rows into Unitbench Neon v1 tables."""
    with db.connect(source_database_url(source_url)) as source_connection:
        dataset = dr_dspy_v1.fetch_dr_dspy_v1_dataset(
            source_connection,
            experiment_names=experiment_name,
            graph_layout=graph_layout,
            limit=limit,
        )

    echo_dataset_summary("prepared dr-dspy v1 publish dataset", dataset)
    with db.connect(target_database_url(target_url)) as target_connection:
        db.init_published_schema(target_connection)
        experiment_count = db.upsert_models(
            target_connection,
            table=schema.PUBLISHED_V1_EXPERIMENTS_TABLE,
            columns=schema.PUBLISHED_EXPERIMENT_COLUMNS,
            primary_key="experiment_id",
            models=dataset.experiments,
            batch_size=batch_size,
            progress=echo_progress,
        )
        prediction_count = db.upsert_models(
            target_connection,
            table=schema.PUBLISHED_V1_PREDICTIONS_TABLE,
            columns=schema.PUBLISHED_PREDICTION_COLUMNS,
            primary_key="prediction_id",
            models=dataset.predictions,
            batch_size=batch_size,
            progress=echo_progress,
        )
        detail_count = db.upsert_models(
            target_connection,
            table=schema.PUBLISHED_V1_PREDICTION_DETAILS_TABLE,
            columns=schema.PUBLISHED_PREDICTION_DETAIL_COLUMNS,
            primary_key="prediction_id",
            models=dataset.details,
            batch_size=batch_size,
            progress=echo_progress,
        )
    typer.echo(
        "published v1 "
        f"{experiment_count} experiments, "
        f"{prediction_count} predictions, "
        f"{detail_count} details"
    )


@app.command("dry-run-dr-dspy-v1-metrics")
def dry_run_dr_dspy_v1_metrics(
    source_url: Annotated[
        str | None,
        typer.Option(
            "--source-database-url",
            help=f"Source dr-dspy v1 DSN. Defaults to {SOURCE_DATABASE_URL_ENV}.",
        ),
    ] = None,
    sample_rows: Annotated[
        int,
        typer.Option("--sample-rows", min=0, help="Sample metric rows to echo."),
    ] = 5,
) -> None:
    """Compute dr-dspy v1 sweep/failure metrics without writing to Neon."""
    computed_at = datetime.now(UTC)
    with db.connect(source_database_url(source_url)) as connection:
        dataset = sweep_metrics.fetch_sweep_metrics_dataset(
            connection, computed_at=computed_at
        )
    echo_metrics_summary(
        "validated dr-dspy v1 metrics dataset", dataset, sample_rows=sample_rows
    )


@app.command("publish-dr-dspy-v1-metrics")
def publish_dr_dspy_v1_metrics(
    source_url: Annotated[
        str | None,
        typer.Option(
            "--source-database-url",
            help=f"Source dr-dspy v1 DSN. Defaults to {SOURCE_DATABASE_URL_ENV}.",
        ),
    ] = None,
    target_url: Annotated[
        str | None,
        typer.Option(
            "--target-database-url",
            help=f"Target Neon DSN. Defaults to {TARGET_DATABASE_URL_ENV}.",
        ),
    ] = None,
    batch_size: Annotated[
        int,
        typer.Option("--batch-size", min=1, help="Rows to upsert per target batch."),
    ] = 500,
) -> None:
    """Publish dr-dspy v1 sweep/failure metric rows into Unitbench Neon tables.

    Full rebuild: upserts by metric_key, then deletes rows whose computed_at
    predates this run so groups that disappear do not linger.
    """
    computed_at = datetime.now(UTC)
    with db.connect(source_database_url(source_url)) as source_connection:
        dataset = sweep_metrics.fetch_sweep_metrics_dataset(
            source_connection, computed_at=computed_at
        )

    echo_metrics_summary("prepared dr-dspy v1 metrics dataset", dataset)
    with db.connect(target_database_url(target_url)) as target_connection:
        db.init_metrics_schema(target_connection)
        sweep_count = db.upsert_models(
            target_connection,
            table=schema.PUBLISHED_V1_SWEEP_METRICS_TABLE,
            columns=schema.PUBLISHED_V1_SWEEP_METRIC_COLUMNS,
            primary_key="metric_key",
            models=dataset.sweep_metrics,
            batch_size=batch_size,
            progress=echo_progress,
        )
        failure_count = db.upsert_models(
            target_connection,
            table=schema.PUBLISHED_V1_FAILURE_METRICS_TABLE,
            columns=schema.PUBLISHED_V1_FAILURE_METRIC_COLUMNS,
            primary_key="metric_key",
            models=dataset.failure_metrics,
            batch_size=batch_size,
            progress=echo_progress,
        )
        stale_counts = {
            table: db.delete_stale_rows(
                target_connection,
                table=table,
                source=sweep_metrics.SOURCE,
                computed_before=computed_at,
            )
            for table in (
                schema.PUBLISHED_V1_SWEEP_METRICS_TABLE,
                schema.PUBLISHED_V1_FAILURE_METRICS_TABLE,
            )
        }
    typer.echo(
        "published v1 metrics "
        f"{sweep_count} sweep rows, "
        f"{failure_count} failure rows"
    )
    for table, deleted in stale_counts.items():
        typer.echo(f"{table}: deleted {deleted} stale rows")


@app.command("verify")
def verify(
    target_url: Annotated[
        str | None,
        typer.Option(
            "--target-database-url",
            help=f"Target Neon DSN. Defaults to {TARGET_DATABASE_URL_ENV}.",
        ),
    ] = None,
) -> None:
    """Print target table counts for the Unitbench published schema."""
    with db.connect(target_database_url(target_url)) as connection:
        counts = db.published_counts(connection)
    for table, count in counts.items():
        typer.echo(f"{table}: {count}")


def echo_dataset_summary(title: str, dataset: dr_dspy.PublishDataset) -> None:
    typer.echo(title)
    typer.echo(f"experiments: {len(dataset.experiments)}")
    typer.echo(f"predictions: {len(dataset.predictions)}")
    typer.echo(f"details: {len(dataset.details)}")


def echo_metrics_summary(
    title: str, dataset: SweepMetricsDataset, *, sample_rows: int = 0
) -> None:
    typer.echo(title)
    grouping_counts: dict[str, int] = {}
    for metric in dataset.sweep_metrics:
        grouping_counts[metric.grouping] = grouping_counts.get(metric.grouping, 0) + 1
    for grouping, count in sorted(grouping_counts.items()):
        typer.echo(f"sweep_metrics[{grouping}]: {count} rows")
    typer.echo(f"sweep_metrics total: {len(dataset.sweep_metrics)}")
    typer.echo(f"failure_metrics total: {len(dataset.failure_metrics)}")
    if sample_rows:
        for metric in dataset.sweep_metrics[:sample_rows]:
            typer.echo(
                f"  sample sweep: {metric.metric_key} "
                f"n={metric.n} pass={metric.pass_count} fail={metric.fail_count} "
                f"pending={metric.pending_count} error={metric.error_count} "
                f"rate_limit={metric.rate_limit_count} "
                f"pass_rate={metric.pass_rate} rank={metric.pass_rate_rank}"
            )
        for metric in dataset.failure_metrics[:sample_rows]:
            typer.echo(
                f"  sample failure: {metric.metric_key} "
                f"attempts={metric.attempt_count} "
                f"predictions={metric.prediction_count} "
                f"error_type={metric.error_type}"
            )


def echo_progress(table: str, written: int, total: int) -> None:
    typer.echo(f"{table}: upserted {written}/{total}")
