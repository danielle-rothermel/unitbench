from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, StrictInt, StrictStr

JsonDict = dict[str, Any]


class SourceName(StrEnum):
    DR_DSPY = "dr-dspy"


class ExperimentKind(StrEnum):
    HUMANEVAL_DIRECT = "humaneval_direct"
    HUMANEVAL_ENCDEC = "humaneval_encdec"


class ResultState(StrEnum):
    PASSED = "passed"
    FAILED = "failed"
    PENDING = "pending"
    ERROR = "error"


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
