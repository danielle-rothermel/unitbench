from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, StrictInt, StrictStr

JsonDict = dict[str, Any]


class SourceName(StrEnum):
    DR_DSPY = "dr-dspy"
    DR_DSPY_V1 = "dr-dspy-v1"


class ExperimentKind(StrEnum):
    HUMANEVAL_DIRECT = "humaneval_direct"
    HUMANEVAL_ENCDEC = "humaneval_encdec"


class ResultState(StrEnum):
    PASSED = "passed"
    FAILED = "failed"
    PENDING = "pending"
    ERROR = "error"


class MetricsGrouping(StrEnum):
    MODEL = "model"
    MODEL_KIND = "model_kind"
    TASK = "task"
    MODEL_TASK = "model_task"


GENERATION_ERROR_STATUSES = frozenset(
    {"generation_error", "generation_recoverable_error"}
)
SCORING_ERROR_STATUSES = frozenset({"score_error", "score_recoverable_error"})

V1_GENERATION_ERROR_STATUSES = frozenset({"error", "blocked"})
V1_SCORE_ERROR_STATUSES = frozenset({"error"})
V1_GENERATED_CODE_PASSED = "passed"


def result_state_for_prediction(
    *,
    generation_status: str,
    scoring_status: str,
    score: float | None,
) -> ResultState:
    if generation_status in GENERATION_ERROR_STATUSES:
        return ResultState.ERROR
    if scoring_status in SCORING_ERROR_STATUSES:
        return ResultState.ERROR
    if scoring_status == "scored":
        if score is None:
            return ResultState.ERROR
        return ResultState.PASSED if score >= 1.0 else ResultState.FAILED
    return ResultState.PENDING


def result_state_for_v1_prediction(
    *,
    generation_status: str,
    scoring_status: str | None,
    score: float | None,
    generated_code_outcome: str | None = None,
) -> ResultState:
    if generation_status in V1_GENERATION_ERROR_STATUSES:
        return ResultState.ERROR
    if scoring_status in V1_SCORE_ERROR_STATUSES:
        return ResultState.ERROR
    if scoring_status == "success":
        if generated_code_outcome == V1_GENERATED_CODE_PASSED:
            return ResultState.PASSED
        if score is not None and score >= 1.0:
            return ResultState.PASSED
        if score is not None:
            return ResultState.FAILED
        return ResultState.ERROR
    return ResultState.PENDING


class PublishedPrediction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prediction_id: StrictStr
    experiment_id: StrictStr
    source: SourceName
    experiment_kind: ExperimentKind
    task_id: StrictStr | None
    sample_index: StrictInt | None
    model: StrictStr | None
    result_state: ResultState
    generation_status: StrictStr | None
    scoring_status: StrictStr | None
    score: float | None
    provider_cost: float | None
    created_at: datetime | None
    updated_at: datetime
    summary_json: JsonDict = Field(default_factory=dict)


class PublishedPredictionDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prediction_id: StrictStr
    experiment_id: StrictStr
    input_kind: StrictStr
    input_text: StrictStr | None
    output_kind: StrictStr
    output_text: StrictStr | None
    prompt_text: StrictStr | None
    code_text: StrictStr | None
    raw_generation: StrictStr | None
    metrics_json: JsonDict = Field(default_factory=dict)
    request_json: JsonDict = Field(default_factory=dict)
    response_json: JsonDict = Field(default_factory=dict)
    validation_json: JsonDict = Field(default_factory=dict)
    updated_at: datetime


class PublishedExperiment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    experiment_id: StrictStr
    source: SourceName
    experiment_kind: ExperimentKind
    display_name: StrictStr
    row_count: StrictInt
    pass_count: StrictInt
    fail_count: StrictInt
    pending_count: StrictInt
    error_count: StrictInt
    pass_rate: float | None
    total_provider_cost: float | None
    first_created_at: datetime | None
    last_updated_at: datetime | None
    updated_at: datetime
    metadata_json: JsonDict = Field(default_factory=dict)


class PublishDataset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    experiments: list[PublishedExperiment]
    predictions: list[PublishedPrediction]
    details: list[PublishedPredictionDetail]


class PublishedSweepMetric(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metric_key: StrictStr
    source: SourceName
    grouping: MetricsGrouping
    model: StrictStr | None
    task_id: StrictStr | None
    experiment_kind: ExperimentKind | None
    n: StrictInt
    pass_count: StrictInt
    fail_count: StrictInt
    pending_count: StrictInt
    error_count: StrictInt
    rate_limit_count: StrictInt
    included_in_pass_rate_count: StrictInt
    scored_n: StrictInt
    pass_rate: float | None
    avg_score: float | None
    stddev_score: float | None
    avg_cost: float | None
    total_cost: float | None
    avg_latency_ms: float | None
    p95_latency_ms: float | None
    avg_provider_latency_ms_proxy: float | None
    p95_provider_latency_ms_proxy: float | None
    pass_rate_rank: StrictInt | None
    computed_at: datetime
    updated_at: datetime


class PublishedFailureMetric(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metric_key: StrictStr
    source: SourceName
    model: StrictStr
    display_model: StrictStr | None
    node_id: StrictStr
    failure_class: StrictStr
    error_type: StrictStr | None
    attempt_count: StrictInt
    prediction_count: StrictInt
    computed_at: datetime
    updated_at: datetime


class SweepMetricsDataset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sweep_metrics: list[PublishedSweepMetric]
    failure_metrics: list[PublishedFailureMetric]
