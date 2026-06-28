from __future__ import annotations

import os
from typing import Annotated

import typer

from unitbench_publish import db, dr_dspy, schema

SOURCE_DATABASE_URL_ENV = "UNITBENCH_SOURCE_DATABASE_URL"
TARGET_DATABASE_URL_ENV = "UNITBENCH_TARGET_DATABASE_URL"

app = typer.Typer(no_args_is_help=True)


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if value:
        return value
    raise typer.BadParameter(f"{name} is required")


def source_database_url(value: str | None) -> str:
    return value or require_env(SOURCE_DATABASE_URL_ENV)


def target_database_url(value: str | None) -> str:
    return value or require_env(TARGET_DATABASE_URL_ENV)


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


def echo_progress(table: str, written: int, total: int) -> None:
    typer.echo(f"{table}: upserted {written}/{total}")
