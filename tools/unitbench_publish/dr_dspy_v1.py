from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from datetime import datetime
from typing import Any

from psycopg import Connection
from psycopg.rows import DictRow
from pydantic import BaseModel, ConfigDict, Field, StrictInt, StrictStr

from unitbench_publish.dr_dspy import ExperimentAccumulator
from unitbench_publish.models import (
    ExperimentKind,
    PublishDataset,
    PublishedPrediction,
    PublishedPredictionDetail,
    SourceName,
    result_state_for_v1_prediction,
)

SOURCE = SourceName.DR_DSPY
V1_EXPERIMENT_PREFIX = "dr-dspy-v1"
HUMANEVAL_SCORING_PROFILE_ID = "humaneval"
HUMANEVAL_SCORING_PROFILE_VERSION = "v1"

CANONICAL_PREDICTIONS_SQL = """
WITH filtered_scores AS (
    SELECT
        ps.prediction_id,
        ps.experiment_name,
        ps.task_id,
        ps.repetition_seed,
        ps.graph_layout,
        ps.model,
        ps.provider_kind,
        ps.endpoint_kind,
        ps.dimensions,
        ps.provider_configs,
        ps.task_snapshot,
        ps.fair_order_key,
        ps.created_at AS spec_created_at,
        gr.generation_run_id,
        gr.status AS generation_status,
        gr.terminal_node_id,
        COALESCE(gr.summary, '{{}}'::jsonb) AS generation_summary,
        gr.started_at AS generation_started_at,
        gr.completed_at AS generation_completed_at,
        sa.score_attempt_id,
        sa.status AS score_status,
        sa.score,
        sa.generated_code_outcome,
        sa.metrics,
        COALESCE(sa.per_test_results, '[]'::jsonb) AS per_test_results,
        sa.failure AS score_failure,
        sa.extracted_code,
        sa.completed_at AS score_completed_at,
        sa.attempt_index AS score_attempt_index,
        sa.scoring_profile_id,
        sa.scoring_profile_version,
        ROW_NUMBER() OVER (
            PARTITION BY ps.prediction_id, gr.generation_run_id
            ORDER BY sa.attempt_index DESC
        ) AS score_rank_in_run
    FROM dr_dspy_prediction_specs ps
    INNER JOIN dr_dspy_generation_runs gr
        ON gr.prediction_id = ps.prediction_id
    -- LEFT JOIN keeps predictions with no successful score attempt so
    -- generation errors publish as result_state = 'error' instead of vanishing.
    LEFT JOIN dr_dspy_score_attempts sa
        ON sa.generation_run_id = gr.generation_run_id
        AND sa.prediction_id = gr.prediction_id
        AND sa.scoring_profile_id = %(scoring_profile_id)s
        AND sa.scoring_profile_version = %(scoring_profile_version)s
        AND sa.status = 'success'
    WHERE ps.graph_layout IN ('direct', 'encdec')
        {experiment_filter}
        {layout_filter}
),
best_run_scores AS (
    SELECT *
    FROM filtered_scores
    WHERE score_rank_in_run = 1
),
ranked_predictions AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY prediction_id
            ORDER BY
                score_attempt_index DESC NULLS LAST,
                generation_completed_at DESC NULLS LAST,
                generation_run_id
        ) AS prediction_rank
    FROM best_run_scores
)
SELECT
    prediction_id,
    experiment_name,
    task_id,
    repetition_seed,
    graph_layout,
    model,
    provider_kind,
    endpoint_kind,
    dimensions,
    provider_configs,
    task_snapshot,
    fair_order_key,
    spec_created_at,
    generation_run_id,
    generation_status,
    terminal_node_id,
    generation_summary,
    generation_started_at,
    generation_completed_at,
    score_attempt_id,
    score_status,
    score,
    generated_code_outcome,
    metrics,
    per_test_results,
    score_failure,
    extracted_code,
    score_completed_at,
    score_attempt_index,
    scoring_profile_id,
    scoring_profile_version
FROM ranked_predictions
WHERE prediction_rank = 1
ORDER BY experiment_name, fair_order_key, prediction_id
"""

EXPERIMENTS_SQL = """
SELECT
    experiment_name,
    description,
    config_metadata,
    created_at
FROM dr_dspy_experiments
WHERE experiment_name = ANY(%s)
ORDER BY experiment_name
"""

NODE_ATTEMPTS_SQL = """
SELECT
    generation_run_id,
    node_id,
    attempt_index,
    status,
    output,
    usage_cost,
    response_metadata,
    failure
FROM dr_dspy_node_attempts
WHERE generation_run_id = ANY(%s)
ORDER BY generation_run_id, node_id, attempt_index DESC
"""


class ExperimentRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    experiment_name: StrictStr
    description: StrictStr | None
    config_metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class CanonicalPredictionRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prediction_id: StrictStr
    experiment_name: StrictStr
    task_id: StrictStr
    repetition_seed: StrictInt
    graph_layout: StrictStr
    model: StrictStr
    provider_kind: StrictStr
    endpoint_kind: StrictStr
    dimensions: dict[str, Any] = Field(default_factory=dict)
    provider_configs: list[Any] = Field(default_factory=list)
    task_snapshot: dict[str, Any] = Field(default_factory=dict)
    fair_order_key: StrictStr
    spec_created_at: datetime
    generation_run_id: StrictStr
    generation_status: StrictStr
    terminal_node_id: StrictStr | None
    generation_summary: dict[str, Any] = Field(default_factory=dict)
    generation_started_at: datetime
    generation_completed_at: datetime | None
    score_attempt_id: StrictStr | None
    score_status: StrictStr | None
    score: float | None
    generated_code_outcome: StrictStr | None
    metrics: dict[str, Any] | None = None
    per_test_results: list[Any] = Field(default_factory=list)
    score_failure: dict[str, Any] | None = None
    extracted_code: dict[str, Any] | None = None
    score_completed_at: datetime | None
    score_attempt_index: StrictInt | None
    scoring_profile_id: StrictStr | None
    scoring_profile_version: StrictStr | None


class NodeAttemptRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    generation_run_id: StrictStr
    node_id: StrictStr
    attempt_index: StrictInt
    status: StrictStr
    output: dict[str, Any] | None = None
    usage_cost: dict[str, Any] = Field(default_factory=dict)
    response_metadata: dict[str, Any] = Field(default_factory=dict)
    failure: dict[str, Any] | None = None


def experiment_kind_for_layout(graph_layout: str) -> ExperimentKind:
    if graph_layout == "direct":
        return ExperimentKind.HUMANEVAL_DIRECT
    if graph_layout == "encdec":
        return ExperimentKind.HUMANEVAL_ENCDEC
    raise ValueError(f"unsupported graph_layout: {graph_layout}")


def experiment_id(experiment_name: str, graph_layout: str) -> str:
    return f"{V1_EXPERIMENT_PREFIX}/{graph_layout}/{experiment_name}"


def published_prediction_id(graph_layout: str, prediction_id: str) -> str:
    return f"{V1_EXPERIMENT_PREFIX}/{graph_layout}/prediction/{prediction_id}"


def dimension_values(dimensions: Mapping[str, Any]) -> dict[str, Any]:
    values = dimensions.get("values")
    if isinstance(values, dict):
        return values
    return dict(dimensions)


def extract_encoder_decoder_models(
    dimensions: Mapping[str, Any],
    provider_configs: Sequence[Mapping[str, Any]] | None,
) -> tuple[str | None, str | None]:
    dim_map = dimension_values(dimensions)
    encoder = dim_map.get("encoder_model")
    decoder = dim_map.get("decoder_model")
    if encoder is not None and decoder is not None:
        return str(encoder), str(decoder)
    encoder_model: str | None = str(encoder) if encoder is not None else None
    decoder_model: str | None = str(decoder) if decoder is not None else None
    if provider_configs:
        for config in provider_configs:
            if not isinstance(config, dict):
                continue
            config_id = config.get("config_id")
            model = config.get("model")
            if model is None:
                continue
            if config_id == "encoder" and encoder_model is None:
                encoder_model = str(model)
            if config_id == "decoder" and decoder_model is None:
                decoder_model = str(model)
    return encoder_model, decoder_model


def task_input_values(task_snapshot: Mapping[str, Any]) -> dict[str, Any]:
    inputs = task_snapshot.get("inputs")
    if isinstance(inputs, dict):
        values = inputs.get("values")
        if isinstance(values, dict):
            return values
    return {}


def task_metadata(task_snapshot: Mapping[str, Any]) -> dict[str, Any]:
    metadata = task_snapshot.get("metadata")
    if isinstance(metadata, dict):
        return metadata
    return {}


def v0_prediction_id(generation_summary: Mapping[str, Any]) -> str | None:
    metadata = generation_summary.get("metadata")
    if not isinstance(metadata, dict):
        return None
    v0_source = metadata.get("v0_source")
    if not isinstance(v0_source, dict):
        return None
    value = v0_source.get("v0_prediction_id")
    return str(value) if value is not None else None


def output_field_values(output: Mapping[str, Any] | None) -> dict[str, Any]:
    if output is None:
        return {}
    values = output.get("values")
    if isinstance(values, dict):
        return values
    return {}


def latest_node_outputs(
    node_attempts: Iterable[NodeAttemptRow],
    generation_run_id: str,
) -> dict[str, NodeAttemptRow]:
    latest: dict[str, NodeAttemptRow] = {}
    for attempt in node_attempts:
        if attempt.generation_run_id != generation_run_id:
            continue
        existing = latest.get(attempt.node_id)
        if existing is None or attempt.attempt_index > existing.attempt_index:
            latest[attempt.node_id] = attempt
    return latest


def total_provider_cost(node_attempts: Iterable[NodeAttemptRow], run_id: str) -> float | None:
    total = 0.0
    found = False
    for attempt in node_attempts:
        if attempt.generation_run_id != run_id:
            continue
        cost = attempt.usage_cost.get("provider_cost")
        if cost is not None:
            total += float(cost)
            found = True
    return total if found else None


def display_model_label(
    *,
    graph_layout: str,
    model: str,
    dimensions: Mapping[str, Any],
    provider_configs: Sequence[Mapping[str, Any]] | None,
) -> str:
    if graph_layout == "encdec":
        encoder, decoder = extract_encoder_decoder_models(dimensions, provider_configs)
        if encoder and decoder:
            return f"{encoder} -> {decoder}"
    return model


def display_model(row: CanonicalPredictionRow) -> str:
    return display_model_label(
        graph_layout=row.graph_layout,
        model=row.model,
        dimensions=row.dimensions,
        provider_configs=row.provider_configs,
    )


def build_canonical_query(
    *,
    experiment_names: Sequence[str] | None,
    graph_layout: str | None,
) -> tuple[str, dict[str, Any]]:
    experiment_filter = ""
    layout_filter = ""
    params: dict[str, Any] = {
        "scoring_profile_id": HUMANEVAL_SCORING_PROFILE_ID,
        "scoring_profile_version": HUMANEVAL_SCORING_PROFILE_VERSION,
    }
    if experiment_names:
        experiment_filter = "AND ps.experiment_name = ANY(%(experiment_names)s)"
        params["experiment_names"] = list(experiment_names)
    if graph_layout is not None:
        layout_filter = "AND ps.graph_layout = %(graph_layout)s"
        params["graph_layout"] = graph_layout
    query = CANONICAL_PREDICTIONS_SQL.format(
        experiment_filter=experiment_filter,
        layout_filter=layout_filter,
    )
    return query, params


def fetch_canonical_predictions(
    connection: Connection[DictRow],
    *,
    experiment_names: Sequence[str] | None = None,
    graph_layout: str | None = None,
    limit: int | None = None,
) -> list[CanonicalPredictionRow]:
    query, params = build_canonical_query(
        experiment_names=experiment_names,
        graph_layout=graph_layout,
    )
    if limit is not None:
        query = f"{query}\nLIMIT %(limit)s"
        params = {**params, "limit": limit}
    with connection.cursor() as cursor:
        cursor.execute(query, params)
        rows = [dict(row) for row in cursor.fetchall()]
    return [CanonicalPredictionRow(**row) for row in rows]


def fetch_experiments(
    connection: Connection[DictRow],
    experiment_names: Sequence[str],
) -> dict[str, ExperimentRow]:
    if not experiment_names:
        return {}
    with connection.cursor() as cursor:
        cursor.execute(EXPERIMENTS_SQL, (list(experiment_names),))
        rows = [dict(row) for row in cursor.fetchall()]
    return {
        row.experiment_name: row
        for row in (ExperimentRow(**item) for item in rows)
    }


def fetch_node_attempts(
    connection: Connection[DictRow],
    generation_run_ids: Sequence[str],
) -> list[NodeAttemptRow]:
    if not generation_run_ids:
        return []
    with connection.cursor() as cursor:
        cursor.execute(NODE_ATTEMPTS_SQL, (list(generation_run_ids),))
        rows = [dict(row) for row in cursor.fetchall()]
    return [NodeAttemptRow(**row) for row in rows]


def map_v1_prediction(
    row: CanonicalPredictionRow,
    *,
    node_attempts: Sequence[NodeAttemptRow],
) -> tuple[PublishedPrediction, PublishedPredictionDetail]:
    kind = experiment_kind_for_layout(row.graph_layout)
    exp_id = experiment_id(row.experiment_name, row.graph_layout)
    pred_id = published_prediction_id(row.graph_layout, row.prediction_id)
    result_state = result_state_for_v1_prediction(
        generation_status=row.generation_status,
        scoring_status=row.score_status,
        score=row.score,
        generated_code_outcome=row.generated_code_outcome,
    )
    inputs = task_input_values(row.task_snapshot)
    metadata = task_metadata(row.task_snapshot)
    prompt = str(inputs.get("prompt") or "")
    nodes = latest_node_outputs(node_attempts, row.generation_run_id)
    provider_cost = total_provider_cost(node_attempts, row.generation_run_id)
    updated_at = prediction_updated_at(row)

    if row.graph_layout == "encdec":
        encoder_attempt = nodes.get("encoder")
        decoder_attempt = nodes.get("decoder")
        encoded_description = None
        if encoder_attempt is not None:
            encoded_description = output_field_values(encoder_attempt.output).get(
                "description"
            )
        code_text = None
        decoded_generation = None
        if decoder_attempt is not None:
            code_text = output_field_values(decoder_attempt.output).get("code")
            decoded_generation = code_text
        raw_generation = code_text
        output_kind = "decoded_generation"
        output_text = decoded_generation
        response_json = {
            "encoder_response_metadata": (
                encoder_attempt.response_metadata if encoder_attempt else {}
            ),
            "decoder_response_metadata": (
                decoder_attempt.response_metadata if decoder_attempt else {}
            ),
            "encoder_usage_metadata": (
                encoder_attempt.usage_cost.get("usage_metadata")
                if encoder_attempt
                else {}
            ),
            "decoder_usage_metadata": (
                decoder_attempt.usage_cost.get("usage_metadata")
                if decoder_attempt
                else {}
            ),
            "encoder_provider_cost": (
                encoder_attempt.usage_cost.get("provider_cost")
                if encoder_attempt
                else None
            ),
            "decoder_provider_cost": (
                decoder_attempt.usage_cost.get("provider_cost")
                if decoder_attempt
                else None
            ),
        }
        request_json = {
            "canonical_solution": metadata.get("canonical_solution"),
            "ground_truth_code": metadata.get("ground_truth_code"),
            "test": inputs.get("test"),
            "entry_point": inputs.get("entry_point"),
            "encoded_description": encoded_description,
        }
    else:
        terminal_attempt = nodes.get(row.terminal_node_id) or nodes.get("direct")
        code_text = None
        if terminal_attempt is not None:
            output_values = output_field_values(terminal_attempt.output)
            code_text = output_values.get("output") or output_values.get("code")
        raw_generation = code_text
        output_kind = "generated_code"
        output_text = code_text
        response_json = {
            "response_metadata": (
                terminal_attempt.response_metadata if terminal_attempt else {}
            ),
            "usage_metadata": (
                terminal_attempt.usage_cost.get("usage_metadata")
                if terminal_attempt
                else {}
            ),
        }
        request_json = {
            "canonical_solution": metadata.get("canonical_solution"),
            "ground_truth_code": metadata.get("ground_truth_code"),
            "test": inputs.get("test"),
            "entry_point": inputs.get("entry_point"),
        }

    prediction = PublishedPrediction(
        prediction_id=pred_id,
        experiment_id=exp_id,
        source=SOURCE,
        experiment_kind=kind,
        task_id=row.task_id,
        sample_index=None,
        model=display_model(row),
        result_state=result_state,
        generation_status=row.generation_status,
        scoring_status=row.score_status,
        score=row.score,
        provider_cost=provider_cost,
        created_at=row.spec_created_at,
        updated_at=updated_at,
        summary_json={
            "source_prediction_id": row.prediction_id,
            "source_experiment_name": row.experiment_name,
            "graph_layout": row.graph_layout,
            "generation_run_id": row.generation_run_id,
            "score_attempt_id": row.score_attempt_id,
            "repetition_seed": row.repetition_seed,
            "fair_order_key": row.fair_order_key,
            "scoring_profile_id": row.scoring_profile_id,
            "scoring_profile_version": row.scoring_profile_version,
            "v0_prediction_id": v0_prediction_id(row.generation_summary),
            "generated_at": isoformat_or_none(row.generation_completed_at),
            "scored_at": isoformat_or_none(row.score_completed_at),
        },
    )
    detail = PublishedPredictionDetail(
        prediction_id=pred_id,
        experiment_id=exp_id,
        input_kind="humaneval_prompt",
        input_text=prompt,
        output_kind=output_kind,
        output_text=str(output_text) if output_text is not None else None,
        prompt_text=prompt,
        code_text=str(code_text) if code_text is not None else None,
        raw_generation=str(raw_generation) if raw_generation is not None else None,
        metrics_json=metrics_json(row),
        request_json=request_json,
        response_json=response_json,
        validation_json=validation_json(row),
        updated_at=updated_at,
    )
    return prediction, detail


def prediction_updated_at(row: CanonicalPredictionRow) -> datetime:
    timestamps = [
        timestamp
        for timestamp in (row.generation_completed_at, row.score_completed_at)
        if timestamp is not None
    ]
    if timestamps:
        return max(timestamps)
    return row.spec_created_at


def isoformat_or_none(timestamp: datetime | None) -> str | None:
    return timestamp.isoformat() if timestamp is not None else None


def metrics_json(row: CanonicalPredictionRow) -> dict[str, Any]:
    metrics = row.metrics or {}
    compression = metrics.get("compression") if isinstance(metrics, dict) else {}
    custom = metrics.get("custom") if isinstance(metrics, dict) else {}
    evaluation = custom.get("evaluation") if isinstance(custom, dict) else {}
    return {
        "score": row.score,
        "generated_code_outcome": row.generated_code_outcome,
        "metrics": metrics,
        "realized_compression_ratio": (
            compression.get("ratio_to_ground_truth")
            if isinstance(compression, dict)
            else None
        ),
        "best_compression_ratio": (
            evaluation.get("best_compression_ratio")
            if isinstance(evaluation, dict)
            else None
        ),
        "per_test_results": row.per_test_results,
    }


def validation_json(row: CanonicalPredictionRow) -> dict[str, Any]:
    return {
        "generated_code_outcome": row.generated_code_outcome,
        "score_failure": row.score_failure,
        "extracted_code": row.extracted_code,
        "generation_summary": row.generation_summary,
    }


def ensure_experiment_accumulator(
    accumulators: dict[str, ExperimentAccumulator],
    *,
    experiment_id: str,
    row: CanonicalPredictionRow,
    experiments: Mapping[str, ExperimentRow],
) -> ExperimentAccumulator:
    existing = accumulators.get(experiment_id)
    if existing is not None:
        return existing
    experiment = experiments.get(row.experiment_name)
    metadata_json: dict[str, Any] = {
        "source_experiment_name": row.experiment_name,
        "graph_layout": row.graph_layout,
    }
    created_at = row.spec_created_at
    updated_at = row.spec_created_at
    if experiment is not None:
        metadata_json["config_metadata"] = experiment.config_metadata
        if experiment.description is not None:
            metadata_json["description"] = experiment.description
        created_at = experiment.created_at
        updated_at = experiment.created_at
    accumulator = ExperimentAccumulator(
        experiment_id=experiment_id,
        kind=experiment_kind_for_layout(row.graph_layout),
        display_name=row.experiment_name,
        metadata_json=metadata_json,
        first_created_at=created_at,
        updated_at=updated_at,
    )
    accumulators[experiment_id] = accumulator
    return accumulator


def build_publish_dataset(
    *,
    canonical_rows: Iterable[CanonicalPredictionRow],
    experiments: Mapping[str, ExperimentRow],
    node_attempts: Sequence[NodeAttemptRow],
) -> PublishDataset:
    accumulators: dict[str, ExperimentAccumulator] = {}
    predictions: list[PublishedPrediction] = []
    details: list[PublishedPredictionDetail] = []
    for row in canonical_rows:
        prediction, detail = map_v1_prediction(row, node_attempts=node_attempts)
        predictions.append(prediction)
        details.append(detail)
        accumulator = ensure_experiment_accumulator(
            accumulators,
            experiment_id=prediction.experiment_id,
            row=row,
            experiments=experiments,
        )
        accumulator.add_prediction(prediction)
    return PublishDataset(
        experiments=[accumulator.to_published() for accumulator in accumulators.values()],
        predictions=predictions,
        details=details,
    )


def fetch_dr_dspy_v1_dataset(
    connection: Connection[DictRow],
    *,
    experiment_names: Sequence[str] | None = None,
    graph_layout: str | None = None,
    limit: int | None = None,
) -> PublishDataset:
    canonical_rows = fetch_canonical_predictions(
        connection,
        experiment_names=experiment_names,
        graph_layout=graph_layout,
        limit=limit,
    )
    experiment_name_set = sorted({row.experiment_name for row in canonical_rows})
    experiments = fetch_experiments(connection, experiment_name_set)
    generation_run_ids = sorted({row.generation_run_id for row in canonical_rows})
    node_attempts = fetch_node_attempts(connection, generation_run_ids)
    return build_publish_dataset(
        canonical_rows=canonical_rows,
        experiments=experiments,
        node_attempts=node_attempts,
    )
