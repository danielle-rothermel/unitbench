from __future__ import annotations

from datetime import UTC, datetime

from unitbench_publish.dr_dspy_v1 import (
    CANONICAL_PREDICTIONS_SQL,
    CanonicalPredictionRow,
    NodeAttemptRow,
    build_publish_dataset,
    map_v1_prediction,
)
from unitbench_publish.models import ResultState, result_state_for_v1_prediction
from unitbench_publish.schema import (
    PUBLISHED_V1_PREDICTIONS_TABLE,
    insert_upsert_sql,
)

NOW = datetime(2026, 6, 30, 12, 0, tzinfo=UTC)


def direct_canonical_row(
    *,
    score: float = 1.0,
    harness_failure_count: int = 0,
    score_attempt_id: str | None = "score-direct-1",
    score_status: str | None = "success",
    submission_outcome: str | None = "passed",
) -> CanonicalPredictionRow:
    return CanonicalPredictionRow(
        prediction_id="v1-direct-1",
        experiment_name="direct-exp",
        task_id="HumanEval/1",
        repetition_seed=3,
        graph_layout="direct",
        model="openai/gpt-4.1-mini",
        provider_kind="openrouter",
        endpoint_kind="chat",
        dimensions={"values": {"temperature": 0.2}},
        provider_configs=[
            {
                "provider_kind": "openrouter",
                "endpoint_kind": "chat",
                "model": "openai/gpt-4.1-mini",
                "config_id": None,
                "throttle_key": "openrouter/chat/openai/gpt-4.1-mini",
            }
        ],
        task_snapshot={
            "task_id": "HumanEval/1",
            "inputs": {
                "values": {
                    "prompt": "write add",
                    "test": "assert add(1, 2) == 3",
                    "entry_point": "add",
                }
            },
            "metadata": {
                "canonical_solution": "def add(a, b): return a + b",
                "ground_truth_code": "def add(a, b): return a + b",
            },
        },
        fair_order_key="0001",
        spec_created_at=NOW,
        generation_run_id="run-direct-1",
        generation_status="success",
        terminal_node_id="direct",
        generation_summary={
            "metadata": {
                "v0_source": {"v0_prediction_id": "pred-direct-legacy"},
            }
        },
        generation_started_at=NOW,
        generation_completed_at=NOW,
        score_attempt_id=score_attempt_id,
        score_status=score_status,
        score=score,
        submission_outcome=submission_outcome,
        metrics={"compression": {"ratio_to_ground_truth": 0.5}},
        per_test_results=[{"status": "passed"}],
        extracted_submission={"code": "def add(a, b): return a + b"},
        score_completed_at=NOW,
        score_attempt_index=0,
        scoring_profile_id="humaneval",
        scoring_profile_version="v1",
        harness_failure_count=harness_failure_count,
    )


def encdec_canonical_row(*, score: float = 0.0) -> CanonicalPredictionRow:
    return CanonicalPredictionRow(
        prediction_id="v1-encdec-1",
        experiment_name="encdec-exp",
        task_id="HumanEval/2",
        repetition_seed=4,
        graph_layout="encdec",
        model="openai/gpt-4.1-mini",
        provider_kind="openrouter",
        endpoint_kind="chat",
        dimensions={
            "values": {
                "budget_ratio": 0.5,
                "encoder_model": "openai/gpt-4.1-mini",
                "decoder_model": "anthropic/claude-3-5-haiku",
            }
        },
        provider_configs=[
            {
                "provider_kind": "openrouter",
                "endpoint_kind": "chat",
                "model": "openai/gpt-4.1-mini",
                "config_id": "encoder",
                "throttle_key": "enc",
            },
            {
                "provider_kind": "openrouter",
                "endpoint_kind": "chat",
                "model": "anthropic/claude-3-5-haiku",
                "config_id": "decoder",
                "throttle_key": "dec",
            },
        ],
        task_snapshot={
            "task_id": "HumanEval/2",
            "inputs": {
                "values": {
                    "prompt": "write sub",
                    "test": "assert sub(3, 2) == 1",
                    "entry_point": "sub",
                }
            },
            "metadata": {
                "canonical_solution": "def sub(a, b): return a - b",
                "ground_truth_code": "def sub(a, b): return a - b",
            },
        },
        fair_order_key="0002",
        spec_created_at=NOW,
        generation_run_id="run-encdec-1",
        generation_status="success",
        terminal_node_id="decoder",
        generation_summary={"metadata": {}},
        generation_started_at=NOW,
        generation_completed_at=NOW,
        score_attempt_id="score-encdec-1",
        score_status="success",
        score=score,
        submission_outcome="tests_failed",
        metrics={"custom": {"evaluation": {"best_compression_ratio": 0.6}}},
        per_test_results=[{"status": "failed"}],
        extracted_submission={"code": "def sub(a, b): return a - b"},
        score_completed_at=NOW,
        score_attempt_index=0,
        scoring_profile_id="humaneval",
        scoring_profile_version="v1",
        harness_failure_count=0,
    )


def direct_node_attempts() -> list[NodeAttemptRow]:
    return [
        NodeAttemptRow(
            generation_run_id="run-direct-1",
            node_id="direct",
            attempt_index=0,
            status="success",
            output={"values": {"output": "def add(a, b): return a + b"}},
            usage_cost={
                "provider_cost": 0.01,
                "usage_metadata": {"total_tokens": 42},
            },
            response_metadata={"id": "resp-1"},
            failure=None,
        )
    ]


def encdec_node_attempts() -> list[NodeAttemptRow]:
    return [
        NodeAttemptRow(
            generation_run_id="run-encdec-1",
            node_id="encoder",
            attempt_index=0,
            status="success",
            output={"values": {"description": "Subtract b from a."}},
            usage_cost={
                "provider_cost": 0.002,
                "usage_metadata": {"total_tokens": 20},
            },
            response_metadata={"id": "enc-resp"},
            failure=None,
        ),
        NodeAttemptRow(
            generation_run_id="run-encdec-1",
            node_id="decoder",
            attempt_index=0,
            status="success",
            output={"values": {"code": "def sub(a, b): return a - b"}},
            usage_cost={
                "provider_cost": 0.003,
                "usage_metadata": {"total_tokens": 30},
            },
            response_metadata={"id": "dec-resp"},
            failure=None,
        ),
    ]


def test_result_state_for_v1_scored_predictions() -> None:
    assert (
        result_state_for_v1_prediction(
            generation_status="success",
            scoring_status="success",
            score=1.0,
            submission_outcome="passed",
        )
        is ResultState.PASSED
    )
    assert (
        result_state_for_v1_prediction(
            generation_status="success",
            scoring_status="success",
            score=0.0,
            submission_outcome="tests_failed",
        )
        is ResultState.FAILED
    )


def test_result_state_for_v1_error_predictions() -> None:
    assert (
        result_state_for_v1_prediction(
            generation_status="error",
            scoring_status="success",
            score=1.0,
        )
        is ResultState.ERROR
    )
    assert (
        result_state_for_v1_prediction(
            generation_status="success",
            scoring_status="error",
            score=None,
        )
        is ResultState.ERROR
    )
    assert (
        result_state_for_v1_prediction(
            generation_status="success",
            scoring_status="harness_failure",
            score=None,
        )
        is ResultState.ERROR
    )


def test_direct_v1_prediction_maps_to_published_rows() -> None:
    prediction, detail = map_v1_prediction(
        direct_canonical_row(),
        node_attempts=direct_node_attempts(),
    )

    assert prediction.prediction_id == "dr-dspy-v1/direct/prediction/v1-direct-1"
    assert prediction.experiment_id == "dr-dspy-v1/direct/direct-exp"
    assert prediction.result_state is ResultState.PASSED
    assert prediction.summary_json["v0_prediction_id"] == "pred-direct-legacy"
    assert detail.input_kind == "humaneval_prompt"
    assert detail.output_kind == "generated_code"
    assert detail.code_text == "def add(a, b): return a + b"
    assert detail.metrics_json["score"] == 1.0
    assert detail.metrics_json["submission_outcome"] == "passed"


def test_encdec_v1_prediction_maps_to_display_model_and_details() -> None:
    prediction, detail = map_v1_prediction(
        encdec_canonical_row(),
        node_attempts=encdec_node_attempts(),
    )

    assert prediction.prediction_id == "dr-dspy-v1/encdec/prediction/v1-encdec-1"
    assert prediction.result_state is ResultState.FAILED
    assert prediction.model == "openai/gpt-4.1-mini -> anthropic/claude-3-5-haiku"
    assert prediction.provider_cost == 0.005
    assert detail.output_kind == "decoded_generation"
    assert detail.request_json["encoded_description"] == "Subtract b from a."


def errored_canonical_row() -> CanonicalPredictionRow:
    row = direct_canonical_row()
    return row.model_copy(
        update={
            "prediction_id": "v1-direct-error-1",
            "generation_run_id": "run-direct-error-1",
            "generation_status": "error",
            "generation_summary": {
                "metadata": {"v0_source": {"v0_prediction_id": "pred-err-legacy"}},
                "terminal_error": {"failure": {"failure_class": "rate_limited"}},
            },
            "score_attempt_id": None,
            "score_status": None,
            "score": None,
            "submission_outcome": None,
            "metrics": None,
            "per_test_results": [],
            "extracted_submission": None,
            "score_completed_at": None,
            "score_attempt_index": None,
            "scoring_profile_id": None,
            "scoring_profile_version": None,
        }
    )


def test_errored_v1_prediction_publishes_as_error_row() -> None:
    prediction, detail = map_v1_prediction(
        errored_canonical_row(),
        node_attempts=[],
    )

    assert prediction.result_state is ResultState.ERROR
    assert prediction.score is None
    assert prediction.scoring_status is None
    assert prediction.summary_json["scored_at"] is None
    assert prediction.updated_at == NOW
    assert detail.output_text is None


def test_canonical_query_left_joins_score_attempts() -> None:
    assert "LEFT JOIN dr_dspy_score_attempts" in CANONICAL_PREDICTIONS_SQL
    assert "CASE WHEN score_attempt_id IS NULL THEN 1 ELSE 0 END" in (
        CANONICAL_PREDICTIONS_SQL
    )
    assert "score_attempt_index DESC NULLS LAST" in CANONICAL_PREDICTIONS_SQL


def test_v1_prediction_surfaces_harness_failure_count() -> None:
    prediction, detail = map_v1_prediction(
        direct_canonical_row(harness_failure_count=2),
        node_attempts=direct_node_attempts(),
    )

    assert prediction.harness_failure_count == 2
    assert detail.metrics_json["harness_failure_count"] == 2
    assert detail.validation_json["harness_failure_count"] == 2


def test_v1_prediction_surfaces_harness_only_rows() -> None:
    prediction, detail = map_v1_prediction(
        direct_canonical_row(
            score=None,
            score_attempt_id=None,
            score_status="harness_failure",
            submission_outcome=None,
            harness_failure_count=2,
        ),
        node_attempts=direct_node_attempts(),
    )

    assert prediction.result_state is ResultState.ERROR
    assert prediction.scoring_status == "harness_failure"
    assert prediction.harness_failure_count == 2
    assert detail.metrics_json["score"] is None
    assert detail.validation_json["harness_failure_count"] == 2


def test_build_v1_publish_dataset_summarizes_experiment_counts() -> None:
    dataset = build_publish_dataset(
        canonical_rows=[
            direct_canonical_row(score=1.0),
            encdec_canonical_row(score=0.0),
        ],
        experiments={},
        node_attempts=[*direct_node_attempts(), *encdec_node_attempts()],
    )

    summaries = {row.experiment_id: row for row in dataset.experiments}
    assert summaries["dr-dspy-v1/direct/direct-exp"].pass_count == 1
    assert summaries["dr-dspy-v1/direct/direct-exp"].pass_rate == 1.0
    assert summaries["dr-dspy-v1/encdec/encdec-exp"].fail_count == 1
    assert summaries["dr-dspy-v1/encdec/encdec-exp"].pass_rate == 0.0
    assert len(dataset.predictions) == 2
    assert len(dataset.details) == 2


def test_v1_insert_upsert_sql_targets_v1_tables() -> None:
    statement = insert_upsert_sql(
        PUBLISHED_V1_PREDICTIONS_TABLE,
        ("prediction_id", "result_state", "updated_at"),
        "prediction_id",
    )

    assert statement.startswith(f"INSERT INTO {PUBLISHED_V1_PREDICTIONS_TABLE}")
    assert "ON CONFLICT (prediction_id)" in statement
