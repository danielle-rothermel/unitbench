from __future__ import annotations

from datetime import UTC, datetime

from unitbench_publish.dr_dspy import (
    DirectExperimentRow,
    DirectPredictionRow,
    EncdecExperimentRow,
    EncdecPredictionRow,
    build_publish_dataset,
    map_direct_prediction,
    map_encdec_prediction,
)
from unitbench_publish.models import ResultState, result_state_for_prediction
from unitbench_publish.schema import insert_upsert_sql

NOW = datetime(2026, 6, 28, 12, 0, tzinfo=UTC)


def direct_experiment() -> DirectExperimentRow:
    return DirectExperimentRow(
        experiment_name="direct-exp",
        script_kind="humaneval_eval_only_dbos_v0",
        seed=1,
        sample_count=1,
        instruction="solve",
        metadata={"suite": "humaneval"},
        created_at=NOW,
        updated_at=NOW,
    )


def direct_prediction(score: float | None = 1.0) -> DirectPredictionRow:
    return DirectPredictionRow(
        prediction_id="pred-direct-1",
        experiment_name="direct-exp",
        script_kind="humaneval_eval_only_dbos_v0",
        submission_id="sub-1",
        task_id="HumanEval/1",
        sample_index=0,
        model="openai/gpt-4.1-mini",
        temperature=0.2,
        repetition_seed=3,
        prompt="write add",
        canonical_solution="def add(a, b): return a + b",
        ground_truth_code="def add(a, b): return a + b",
        test="assert add(1, 2) == 3",
        entry_point="add",
        reasoning={"effort": "low"},
        generation_status="generated",
        generation_error=None,
        generation_failure_class=None,
        generation_exception_type=None,
        generation_exception_message=None,
        raw_code="def add(a, b): return a + b",
        raw_generation="```python\ndef add(a, b): return a + b\n```",
        response_metadata={"id": "resp-1"},
        usage_metadata={"total_tokens": 42},
        provider_cost=0.01,
        scoring_status="scored",
        score=score,
        scoring_error=None,
        scoring_failure_class=None,
        scoring_exception_type=None,
        scoring_exception_message=None,
        raw_compile_ok=True,
        raw_compile_error=None,
        extraction_candidate_count=1,
        selected_candidate_index=0,
        extracted_compile_ok=True,
        extracted_compile_error=None,
        extraction_error=None,
        evaluation_function_names=["check"],
        evaluation_total_cases=1,
        evaluation_failure_count=0,
        evaluation_status_counts={"passed": 1},
        compression_metrics={"ratio": 0.5},
        raw_compression_ratio=0.5,
        best_compression_ratio=0.4,
        best_compression_percent_reduction=60.0,
        created_at=NOW,
        updated_at=NOW,
        generated_at=NOW,
        scored_at=NOW,
    )


def encdec_experiment() -> EncdecExperimentRow:
    return EncdecExperimentRow(
        experiment_name="encdec-exp",
        script_kind="humaneval_eval_only_encdec_dbos_v0",
        seed=2,
        sample_count=1,
        encoder_instruction="describe",
        decoder_instruction="decode",
        metadata={"suite": "humaneval"},
        created_at=NOW,
        updated_at=NOW,
    )


def encdec_prediction() -> EncdecPredictionRow:
    return EncdecPredictionRow(
        prediction_id="pred-encdec-1",
        experiment_name="encdec-exp",
        script_kind="humaneval_eval_only_encdec_dbos_v0",
        submission_id="sub-2",
        task_id="HumanEval/2",
        sample_index=0,
        repetition_seed=4,
        encoder_model="openai/gpt-4.1-mini",
        decoder_model="anthropic/claude-3-5-haiku",
        encoder_temperature=0.0,
        decoder_temperature=0.4,
        budget_ratio=0.5,
        encoder_reasoning={"effort": "low"},
        decoder_reasoning={"effort": "medium"},
        prompt="write sub",
        canonical_solution="def sub(a, b): return a - b",
        ground_truth_code="def sub(a, b): return a - b",
        test="assert sub(3, 2) == 1",
        entry_point="sub",
        encoder_char_budget=250,
        generation_status="generated",
        generation_error=None,
        generation_failure_class=None,
        generation_exception_type=None,
        generation_exception_message=None,
        encoded_description="Subtract b from a.",
        decoded_generation="def sub(a, b): return a - b",
        raw_generation="def sub(a, b): return a - b",
        encoder_response_metadata={"id": "enc-resp"},
        decoder_response_metadata={"id": "dec-resp"},
        encoder_usage_metadata={"total_tokens": 20},
        decoder_usage_metadata={"total_tokens": 30},
        encoder_provider_cost=0.002,
        decoder_provider_cost=0.003,
        provider_cost=0.005,
        scoring_status="scored",
        score=0.0,
        scoring_error=None,
        scoring_failure_class=None,
        scoring_exception_type=None,
        scoring_exception_message=None,
        raw_code="def sub(a, b): return a - b",
        raw_compile_ok=True,
        raw_compile_error=None,
        extraction_candidate_count=1,
        selected_candidate_index=0,
        extracted_compile_ok=True,
        extracted_compile_error=None,
        extraction_error=None,
        evaluation_function_names=["check"],
        evaluation_total_cases=1,
        evaluation_failure_count=1,
        evaluation_status_counts={"failed": 1},
        compression_metrics={"ratio": 0.7},
        raw_compression_ratio=0.7,
        best_compression_ratio=0.6,
        best_compression_percent_reduction=40.0,
        created_at=NOW,
        updated_at=NOW,
        generated_at=NOW,
        scored_at=NOW,
    )


def test_result_state_for_scored_predictions() -> None:
    assert (
        result_state_for_prediction(
            generation_status="generated", scoring_status="scored", score=1.0
        )
        is ResultState.PASSED
    )
    assert (
        result_state_for_prediction(
            generation_status="generated", scoring_status="scored", score=0.0
        )
        is ResultState.FAILED
    )


def test_result_state_for_pending_and_error_predictions() -> None:
    assert (
        result_state_for_prediction(
            generation_status="generated", scoring_status="pending", score=None
        )
        is ResultState.PENDING
    )
    assert (
        result_state_for_prediction(
            generation_status="generation_error",
            scoring_status="pending",
            score=None,
        )
        is ResultState.ERROR
    )


def test_direct_prediction_maps_to_published_rows() -> None:
    prediction, detail = map_direct_prediction(direct_prediction())

    assert prediction.prediction_id == "dr-dspy/direct/prediction/pred-direct-1"
    assert prediction.experiment_id == "dr-dspy/direct/direct-exp"
    assert prediction.result_state is ResultState.PASSED
    assert prediction.model == "openai/gpt-4.1-mini"
    assert detail.input_kind == "humaneval_prompt"
    assert detail.output_kind == "generated_code"
    assert detail.metrics_json["score"] == 1.0
    assert detail.validation_json["raw_compile_ok"] is True


def test_encdec_prediction_maps_to_display_model_and_details() -> None:
    prediction, detail = map_encdec_prediction(encdec_prediction())

    assert prediction.prediction_id == "dr-dspy/encdec/prediction/pred-encdec-1"
    assert prediction.result_state is ResultState.FAILED
    assert prediction.model == "openai/gpt-4.1-mini -> anthropic/claude-3-5-haiku"
    assert prediction.summary_json["budget_ratio"] == 0.5
    assert detail.output_kind == "decoded_generation"
    assert detail.request_json["encoded_description"] == "Subtract b from a."


def test_build_publish_dataset_summarizes_experiment_counts() -> None:
    dataset = build_publish_dataset(
        direct_experiments=[direct_experiment()],
        encdec_experiments=[encdec_experiment()],
        direct_predictions=[direct_prediction(score=1.0)],
        encdec_predictions=[encdec_prediction()],
    )

    summaries = {row.experiment_id: row for row in dataset.experiments}
    assert summaries["dr-dspy/direct/direct-exp"].pass_count == 1
    assert summaries["dr-dspy/direct/direct-exp"].pass_rate == 1.0
    assert summaries["dr-dspy/encdec/encdec-exp"].fail_count == 1
    assert summaries["dr-dspy/encdec/encdec-exp"].pass_rate == 0.0
    assert len(dataset.predictions) == 2
    assert len(dataset.details) == 2


def test_insert_upsert_sql_updates_non_primary_columns() -> None:
    statement = insert_upsert_sql(
        "published_predictions",
        ("prediction_id", "result_state", "updated_at"),
        "prediction_id",
    )

    assert "ON CONFLICT (prediction_id)" in statement
    assert "result_state = EXCLUDED.result_state" in statement
    assert "updated_at = EXCLUDED.updated_at" in statement
    assert "prediction_id = EXCLUDED.prediction_id" not in statement
