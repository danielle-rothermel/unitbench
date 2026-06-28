from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime
from typing import Any

from psycopg import Connection
from psycopg.rows import DictRow
from pydantic import BaseModel, ConfigDict, Field, StrictInt, StrictStr

from unitbench_publish.models import (
    ExperimentKind,
    PublishDataset,
    PublishedExperiment,
    PublishedPrediction,
    PublishedPredictionDetail,
    ResultState,
    SourceName,
    result_state_for_prediction,
)

SOURCE = SourceName.DR_DSPY
DIRECT_EXPERIMENT_PREFIX = "dr-dspy/direct"
ENCDEC_EXPERIMENT_PREFIX = "dr-dspy/encdec"

DIRECT_EXPERIMENT_SQL = """
SELECT
    experiment_name,
    script_kind,
    seed,
    sample_count,
    instruction,
    metadata,
    created_at,
    updated_at
FROM dr_dspy_eval_experiments
ORDER BY experiment_name
"""

DIRECT_PREDICTION_SQL = """
SELECT
    prediction_id,
    experiment_name,
    script_kind,
    submission_id,
    task_id,
    sample_index,
    model,
    temperature,
    repetition_seed,
    prompt,
    canonical_solution,
    ground_truth_code,
    test,
    entry_point,
    reasoning,
    generation_status,
    generation_error,
    generation_failure_class,
    generation_exception_type,
    generation_exception_message,
    raw_code,
    raw_generation,
    response_metadata,
    usage_metadata,
    provider_cost,
    scoring_status,
    score,
    scoring_error,
    scoring_failure_class,
    scoring_exception_type,
    scoring_exception_message,
    raw_compile_ok,
    raw_compile_error,
    extraction_candidate_count,
    selected_candidate_index,
    extracted_compile_ok,
    extracted_compile_error,
    extraction_error,
    evaluation_function_names,
    evaluation_total_cases,
    evaluation_failure_count,
    evaluation_status_counts,
    compression_metrics,
    raw_compression_ratio,
    best_compression_ratio,
    best_compression_percent_reduction,
    created_at,
    updated_at,
    generated_at,
    scored_at
FROM dr_dspy_eval_predictions
ORDER BY experiment_name, task_id, sample_index, prediction_id
"""

ENCDEC_EXPERIMENT_SQL = """
SELECT
    experiment_name,
    script_kind,
    seed,
    sample_count,
    encoder_instruction,
    decoder_instruction,
    metadata,
    created_at,
    updated_at
FROM dr_dspy_encdec_eval_experiments
ORDER BY experiment_name
"""

ENCDEC_PREDICTION_SQL = """
SELECT
    prediction_id,
    experiment_name,
    script_kind,
    submission_id,
    task_id,
    sample_index,
    repetition_seed,
    encoder_model,
    decoder_model,
    encoder_temperature,
    decoder_temperature,
    budget_ratio,
    encoder_reasoning,
    decoder_reasoning,
    prompt,
    canonical_solution,
    ground_truth_code,
    test,
    entry_point,
    encoder_char_budget,
    generation_status,
    generation_error,
    generation_failure_class,
    generation_exception_type,
    generation_exception_message,
    encoded_description,
    decoded_generation,
    raw_generation,
    encoder_response_metadata,
    decoder_response_metadata,
    encoder_usage_metadata,
    decoder_usage_metadata,
    encoder_provider_cost,
    decoder_provider_cost,
    provider_cost,
    scoring_status,
    score,
    scoring_error,
    scoring_failure_class,
    scoring_exception_type,
    scoring_exception_message,
    raw_code,
    raw_compile_ok,
    raw_compile_error,
    extraction_candidate_count,
    selected_candidate_index,
    extracted_compile_ok,
    extracted_compile_error,
    extraction_error,
    evaluation_function_names,
    evaluation_total_cases,
    evaluation_failure_count,
    evaluation_status_counts,
    compression_metrics,
    raw_compression_ratio,
    best_compression_ratio,
    best_compression_percent_reduction,
    created_at,
    updated_at,
    generated_at,
    scored_at
FROM dr_dspy_encdec_eval_predictions
ORDER BY experiment_name, task_id, sample_index, prediction_id
"""


class DirectExperimentRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    experiment_name: StrictStr
    script_kind: StrictStr
    seed: StrictInt
    sample_count: StrictInt
    instruction: StrictStr
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class EncdecExperimentRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    experiment_name: StrictStr
    script_kind: StrictStr
    seed: StrictInt
    sample_count: StrictInt
    encoder_instruction: StrictStr
    decoder_instruction: StrictStr
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class DirectPredictionRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prediction_id: StrictStr
    experiment_name: StrictStr
    script_kind: StrictStr
    submission_id: StrictStr
    task_id: StrictStr
    sample_index: StrictInt
    model: StrictStr
    temperature: float | None
    repetition_seed: StrictInt
    prompt: StrictStr
    canonical_solution: StrictStr
    ground_truth_code: StrictStr
    test: StrictStr
    entry_point: StrictStr
    reasoning: dict[str, Any] = Field(default_factory=dict)
    generation_status: StrictStr
    generation_error: StrictStr | None
    generation_failure_class: StrictStr | None
    generation_exception_type: StrictStr | None
    generation_exception_message: StrictStr | None
    raw_code: StrictStr | None
    raw_generation: StrictStr | None
    response_metadata: dict[str, Any] = Field(default_factory=dict)
    usage_metadata: dict[str, Any] = Field(default_factory=dict)
    provider_cost: float | None
    scoring_status: StrictStr
    score: float | None
    scoring_error: StrictStr | None
    scoring_failure_class: StrictStr | None
    scoring_exception_type: StrictStr | None
    scoring_exception_message: StrictStr | None
    raw_compile_ok: bool | None
    raw_compile_error: StrictStr | None
    extraction_candidate_count: StrictInt | None
    selected_candidate_index: StrictInt | None
    extracted_compile_ok: bool | None
    extracted_compile_error: StrictStr | None
    extraction_error: StrictStr | None
    evaluation_function_names: list[Any] = Field(default_factory=list)
    evaluation_total_cases: StrictInt | None
    evaluation_failure_count: StrictInt | None
    evaluation_status_counts: dict[str, Any] = Field(default_factory=dict)
    compression_metrics: dict[str, Any] | list[Any] = Field(default_factory=dict)
    raw_compression_ratio: float | None
    best_compression_ratio: float | None
    best_compression_percent_reduction: float | None
    created_at: datetime
    updated_at: datetime
    generated_at: datetime | None
    scored_at: datetime | None


class EncdecPredictionRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prediction_id: StrictStr
    experiment_name: StrictStr
    script_kind: StrictStr
    submission_id: StrictStr
    task_id: StrictStr
    sample_index: StrictInt
    repetition_seed: StrictInt
    encoder_model: StrictStr
    decoder_model: StrictStr
    encoder_temperature: float | None
    decoder_temperature: float | None
    budget_ratio: float | None
    encoder_reasoning: dict[str, Any] = Field(default_factory=dict)
    decoder_reasoning: dict[str, Any] = Field(default_factory=dict)
    prompt: StrictStr
    canonical_solution: StrictStr
    ground_truth_code: StrictStr
    test: StrictStr
    entry_point: StrictStr
    encoder_char_budget: StrictInt | None
    generation_status: StrictStr
    generation_error: StrictStr | None
    generation_failure_class: StrictStr | None
    generation_exception_type: StrictStr | None
    generation_exception_message: StrictStr | None
    encoded_description: StrictStr | None
    decoded_generation: StrictStr | None
    raw_generation: StrictStr | None
    encoder_response_metadata: dict[str, Any] = Field(default_factory=dict)
    decoder_response_metadata: dict[str, Any] = Field(default_factory=dict)
    encoder_usage_metadata: dict[str, Any] = Field(default_factory=dict)
    decoder_usage_metadata: dict[str, Any] = Field(default_factory=dict)
    encoder_provider_cost: float | None
    decoder_provider_cost: float | None
    provider_cost: float | None
    scoring_status: StrictStr
    score: float | None
    scoring_error: StrictStr | None
    scoring_failure_class: StrictStr | None
    scoring_exception_type: StrictStr | None
    scoring_exception_message: StrictStr | None
    raw_code: StrictStr | None
    raw_compile_ok: bool | None
    raw_compile_error: StrictStr | None
    extraction_candidate_count: StrictInt | None
    selected_candidate_index: StrictInt | None
    extracted_compile_ok: bool | None
    extracted_compile_error: StrictStr | None
    extraction_error: StrictStr | None
    evaluation_function_names: list[Any] = Field(default_factory=list)
    evaluation_total_cases: StrictInt | None
    evaluation_failure_count: StrictInt | None
    evaluation_status_counts: dict[str, Any] = Field(default_factory=dict)
    compression_metrics: dict[str, Any] | list[Any] = Field(default_factory=dict)
    raw_compression_ratio: float | None
    best_compression_ratio: float | None
    best_compression_percent_reduction: float | None
    created_at: datetime
    updated_at: datetime
    generated_at: datetime | None
    scored_at: datetime | None


class ExperimentAccumulator:
    def __init__(
        self,
        *,
        experiment_id: str,
        kind: ExperimentKind,
        display_name: str,
        metadata_json: dict[str, Any],
        first_created_at: datetime | None,
        updated_at: datetime,
    ) -> None:
        self.experiment_id = experiment_id
        self.kind = kind
        self.display_name = display_name
        self.metadata_json = metadata_json
        self.first_created_at = first_created_at
        self.last_updated_at: datetime | None = updated_at
        self.updated_at = updated_at
        self.row_count = 0
        self.pass_count = 0
        self.fail_count = 0
        self.pending_count = 0
        self.error_count = 0
        self.total_provider_cost = 0.0
        self.has_provider_cost = False

    def add_prediction(self, prediction: PublishedPrediction) -> None:
        self.row_count += 1
        if prediction.result_state is ResultState.PASSED:
            self.pass_count += 1
        elif prediction.result_state is ResultState.FAILED:
            self.fail_count += 1
        elif prediction.result_state is ResultState.ERROR:
            self.error_count += 1
        else:
            self.pending_count += 1
        if prediction.provider_cost is not None:
            self.total_provider_cost += prediction.provider_cost
            self.has_provider_cost = True
        if prediction.created_at is not None:
            if self.first_created_at is None:
                self.first_created_at = prediction.created_at
            else:
                self.first_created_at = min(
                    self.first_created_at, prediction.created_at
                )
        self.last_updated_at = max_datetime(self.last_updated_at, prediction.updated_at)
        self.updated_at = max_datetime(self.updated_at, prediction.updated_at)

    def to_published(self) -> PublishedExperiment:
        scored_count = self.pass_count + self.fail_count
        pass_rate = self.pass_count / scored_count if scored_count else None
        total_provider_cost = (
            self.total_provider_cost if self.has_provider_cost else None
        )
        return PublishedExperiment(
            experiment_id=self.experiment_id,
            source=SOURCE,
            experiment_kind=self.kind,
            display_name=self.display_name,
            row_count=self.row_count,
            pass_count=self.pass_count,
            fail_count=self.fail_count,
            pending_count=self.pending_count,
            error_count=self.error_count,
            pass_rate=pass_rate,
            total_provider_cost=total_provider_cost,
            first_created_at=self.first_created_at,
            last_updated_at=self.last_updated_at,
            updated_at=self.updated_at,
            metadata_json=self.metadata_json,
        )


def max_datetime(left: datetime | None, right: datetime) -> datetime:
    if left is None:
        return right
    return max(left, right)


def direct_experiment_id(experiment_name: str) -> str:
    return f"{DIRECT_EXPERIMENT_PREFIX}/{experiment_name}"


def encdec_experiment_id(experiment_name: str) -> str:
    return f"{ENCDEC_EXPERIMENT_PREFIX}/{experiment_name}"


def published_prediction_id(kind: ExperimentKind, prediction_id: str) -> str:
    prefix = "direct" if kind is ExperimentKind.HUMANEVAL_DIRECT else "encdec"
    return f"dr-dspy/{prefix}/prediction/{prediction_id}"


def fetch_rows(
    connection: Connection[DictRow],
    query: str,
    *,
    limit: int | None,
) -> list[dict[str, Any]]:
    limited_query = query
    params: tuple[int, ...] = ()
    if limit is not None:
        limited_query = f"{query}\nLIMIT %s"
        params = (limit,)
    with connection.cursor() as cursor:
        cursor.execute(limited_query, params)
        return [dict(row) for row in cursor.fetchall()]


def fetch_dr_dspy_dataset(
    connection: Connection[DictRow],
    *,
    limit: int | None = None,
) -> PublishDataset:
    direct_experiments = [
        DirectExperimentRow(**row)
        for row in fetch_rows(connection, DIRECT_EXPERIMENT_SQL, limit=None)
    ]
    encdec_experiments = [
        EncdecExperimentRow(**row)
        for row in fetch_rows(connection, ENCDEC_EXPERIMENT_SQL, limit=None)
    ]
    direct_predictions = [
        DirectPredictionRow(**row)
        for row in fetch_rows(connection, DIRECT_PREDICTION_SQL, limit=limit)
    ]
    encdec_predictions = [
        EncdecPredictionRow(**row)
        for row in fetch_rows(connection, ENCDEC_PREDICTION_SQL, limit=limit)
    ]
    return build_publish_dataset(
        direct_experiments=direct_experiments,
        encdec_experiments=encdec_experiments,
        direct_predictions=direct_predictions,
        encdec_predictions=encdec_predictions,
    )


def build_publish_dataset(
    *,
    direct_experiments: Iterable[DirectExperimentRow],
    encdec_experiments: Iterable[EncdecExperimentRow],
    direct_predictions: Iterable[DirectPredictionRow],
    encdec_predictions: Iterable[EncdecPredictionRow],
) -> PublishDataset:
    accumulators: dict[str, ExperimentAccumulator] = {}
    for experiment in direct_experiments:
        experiment_id = direct_experiment_id(experiment.experiment_name)
        accumulators[experiment_id] = ExperimentAccumulator(
            experiment_id=experiment_id,
            kind=ExperimentKind.HUMANEVAL_DIRECT,
            display_name=experiment.experiment_name,
            metadata_json={
                "source_experiment_name": experiment.experiment_name,
                "script_kind": experiment.script_kind,
                "seed": experiment.seed,
                "sample_count": experiment.sample_count,
                "instruction": experiment.instruction,
                "metadata": experiment.metadata,
            },
            first_created_at=experiment.created_at,
            updated_at=experiment.updated_at,
        )
    for experiment in encdec_experiments:
        experiment_id = encdec_experiment_id(experiment.experiment_name)
        accumulators[experiment_id] = ExperimentAccumulator(
            experiment_id=experiment_id,
            kind=ExperimentKind.HUMANEVAL_ENCDEC,
            display_name=experiment.experiment_name,
            metadata_json={
                "source_experiment_name": experiment.experiment_name,
                "script_kind": experiment.script_kind,
                "seed": experiment.seed,
                "sample_count": experiment.sample_count,
                "encoder_instruction": experiment.encoder_instruction,
                "decoder_instruction": experiment.decoder_instruction,
                "metadata": experiment.metadata,
            },
            first_created_at=experiment.created_at,
            updated_at=experiment.updated_at,
        )

    predictions: list[PublishedPrediction] = []
    details: list[PublishedPredictionDetail] = []
    for row in direct_predictions:
        prediction, detail = map_direct_prediction(row)
        predictions.append(prediction)
        details.append(detail)
        accumulators[prediction.experiment_id].add_prediction(prediction)
    for row in encdec_predictions:
        prediction, detail = map_encdec_prediction(row)
        predictions.append(prediction)
        details.append(detail)
        accumulators[prediction.experiment_id].add_prediction(prediction)

    return PublishDataset(
        experiments=[
            accumulator.to_published() for accumulator in accumulators.values()
        ],
        predictions=predictions,
        details=details,
    )


def map_direct_prediction(
    row: DirectPredictionRow,
) -> tuple[PublishedPrediction, PublishedPredictionDetail]:
    experiment_id = direct_experiment_id(row.experiment_name)
    prediction_id = published_prediction_id(
        ExperimentKind.HUMANEVAL_DIRECT, row.prediction_id
    )
    result_state = result_state_for_prediction(
        generation_status=row.generation_status,
        scoring_status=row.scoring_status,
        score=row.score,
    )
    prediction = PublishedPrediction(
        prediction_id=prediction_id,
        experiment_id=experiment_id,
        source=SOURCE,
        experiment_kind=ExperimentKind.HUMANEVAL_DIRECT,
        task_id=row.task_id,
        sample_index=row.sample_index,
        model=row.model,
        result_state=result_state,
        generation_status=row.generation_status,
        scoring_status=row.scoring_status,
        score=row.score,
        provider_cost=row.provider_cost,
        created_at=row.created_at,
        updated_at=row.updated_at,
        summary_json={
            "source_prediction_id": row.prediction_id,
            "source_experiment_name": row.experiment_name,
            "script_kind": row.script_kind,
            "submission_id": row.submission_id,
            "temperature": row.temperature,
            "repetition_seed": row.repetition_seed,
            "reasoning": row.reasoning,
            "generated_at": row.generated_at.isoformat() if row.generated_at else None,
            "scored_at": row.scored_at.isoformat() if row.scored_at else None,
        },
    )
    detail = PublishedPredictionDetail(
        prediction_id=prediction_id,
        experiment_id=experiment_id,
        input_kind="humaneval_prompt",
        input_text=row.prompt,
        output_kind="generated_code",
        output_text=row.raw_code,
        prompt_text=row.prompt,
        code_text=row.raw_code,
        raw_generation=row.raw_generation,
        metrics_json=metrics_json(row),
        request_json={
            "canonical_solution": row.canonical_solution,
            "ground_truth_code": row.ground_truth_code,
            "test": row.test,
            "entry_point": row.entry_point,
            "reasoning": row.reasoning,
        },
        response_json={
            "response_metadata": row.response_metadata,
            "usage_metadata": row.usage_metadata,
        },
        validation_json=validation_json(row),
        updated_at=row.updated_at,
    )
    return prediction, detail


def map_encdec_prediction(
    row: EncdecPredictionRow,
) -> tuple[PublishedPrediction, PublishedPredictionDetail]:
    experiment_id = encdec_experiment_id(row.experiment_name)
    prediction_id = published_prediction_id(
        ExperimentKind.HUMANEVAL_ENCDEC, row.prediction_id
    )
    result_state = result_state_for_prediction(
        generation_status=row.generation_status,
        scoring_status=row.scoring_status,
        score=row.score,
    )
    model_label = f"{row.encoder_model} -> {row.decoder_model}"
    prediction = PublishedPrediction(
        prediction_id=prediction_id,
        experiment_id=experiment_id,
        source=SOURCE,
        experiment_kind=ExperimentKind.HUMANEVAL_ENCDEC,
        task_id=row.task_id,
        sample_index=row.sample_index,
        model=model_label,
        result_state=result_state,
        generation_status=row.generation_status,
        scoring_status=row.scoring_status,
        score=row.score,
        provider_cost=row.provider_cost,
        created_at=row.created_at,
        updated_at=row.updated_at,
        summary_json={
            "source_prediction_id": row.prediction_id,
            "source_experiment_name": row.experiment_name,
            "script_kind": row.script_kind,
            "submission_id": row.submission_id,
            "repetition_seed": row.repetition_seed,
            "encoder_model": row.encoder_model,
            "decoder_model": row.decoder_model,
            "encoder_temperature": row.encoder_temperature,
            "decoder_temperature": row.decoder_temperature,
            "budget_ratio": row.budget_ratio,
            "encoder_reasoning": row.encoder_reasoning,
            "decoder_reasoning": row.decoder_reasoning,
            "encoder_char_budget": row.encoder_char_budget,
            "generated_at": row.generated_at.isoformat() if row.generated_at else None,
            "scored_at": row.scored_at.isoformat() if row.scored_at else None,
        },
    )
    detail = PublishedPredictionDetail(
        prediction_id=prediction_id,
        experiment_id=experiment_id,
        input_kind="humaneval_prompt",
        input_text=row.prompt,
        output_kind="decoded_generation",
        output_text=row.decoded_generation,
        prompt_text=row.prompt,
        code_text=row.raw_code,
        raw_generation=row.raw_generation,
        metrics_json=metrics_json(row),
        request_json={
            "canonical_solution": row.canonical_solution,
            "ground_truth_code": row.ground_truth_code,
            "test": row.test,
            "entry_point": row.entry_point,
            "encoded_description": row.encoded_description,
        },
        response_json={
            "encoder_response_metadata": row.encoder_response_metadata,
            "decoder_response_metadata": row.decoder_response_metadata,
            "encoder_usage_metadata": row.encoder_usage_metadata,
            "decoder_usage_metadata": row.decoder_usage_metadata,
            "encoder_provider_cost": row.encoder_provider_cost,
            "decoder_provider_cost": row.decoder_provider_cost,
        },
        validation_json=validation_json(row),
        updated_at=row.updated_at,
    )
    return prediction, detail


def metrics_json(row: DirectPredictionRow | EncdecPredictionRow) -> dict[str, Any]:
    return {
        "score": row.score,
        "provider_cost": row.provider_cost,
        "evaluation_function_names": row.evaluation_function_names,
        "evaluation_total_cases": row.evaluation_total_cases,
        "evaluation_failure_count": row.evaluation_failure_count,
        "evaluation_status_counts": row.evaluation_status_counts,
        "compression_metrics": row.compression_metrics,
        "raw_compression_ratio": row.raw_compression_ratio,
        "best_compression_ratio": row.best_compression_ratio,
        "best_compression_percent_reduction": (row.best_compression_percent_reduction),
    }


def validation_json(row: DirectPredictionRow | EncdecPredictionRow) -> dict[str, Any]:
    return {
        "generation_error": row.generation_error,
        "generation_failure_class": row.generation_failure_class,
        "generation_exception_type": row.generation_exception_type,
        "generation_exception_message": row.generation_exception_message,
        "scoring_error": row.scoring_error,
        "scoring_failure_class": row.scoring_failure_class,
        "scoring_exception_type": row.scoring_exception_type,
        "scoring_exception_message": row.scoring_exception_message,
        "raw_compile_ok": row.raw_compile_ok,
        "raw_compile_error": row.raw_compile_error,
        "extraction_candidate_count": row.extraction_candidate_count,
        "selected_candidate_index": row.selected_candidate_index,
        "extracted_compile_ok": row.extracted_compile_ok,
        "extracted_compile_error": row.extracted_compile_error,
        "extraction_error": row.extraction_error,
    }
