from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from unitbench_publish.models import (
    ExperimentKind,
    MetricsGrouping,
    PublishedFailureMetric,
    PublishedSweepMetric,
    ResultState,
    SourceName,
)
from unitbench_publish.schema import (
    PUBLISHED_V1_FAILURE_METRIC_COLUMNS,
    PUBLISHED_V1_FAILURE_METRICS_TABLE,
    PUBLISHED_V1_SWEEP_METRIC_COLUMNS,
    PUBLISHED_V1_SWEEP_METRICS_TABLE,
    insert_upsert_sql,
)
from unitbench_publish.sweep_metrics import (
    FailedNodeAttemptRow,
    MetricsNodeAttemptRow,
    MetricsPredictionRow,
    PredictionMetricsRecord,
    build_failure_metrics,
    build_metrics_predictions_query,
    build_prediction_records,
    build_sweep_metrics,
    percentile,
    prediction_included_in_pass_rate,
    provider_latency_proxy_sql_expression,
    run_measured_latency_ms,
    run_provider_latency_ms_proxy,
    sweep_metric_key,
    terminal_failure_class,
)

NOW = datetime(2026, 7, 7, 12, 0, tzinfo=UTC)


def make_record(
    *,
    prediction_id: str = "pred-1",
    model: str = "enc-a -> dec-b",
    task_id: str = "HumanEval/1",
    experiment_kind: ExperimentKind = ExperimentKind.HUMANEVAL_ENCDEC,
    result_state: ResultState = ResultState.PASSED,
    scored: bool = True,
    included_in_pass_rate: bool = True,
    score: float | None = 1.0,
    provider_cost: float | None = 0.01,
    failure_class: str | None = None,
    latency_ms: float | None = None,
    provider_latency_ms_proxy: float | None = None,
) -> PredictionMetricsRecord:
    return PredictionMetricsRecord(
        prediction_id=prediction_id,
        model=model,
        task_id=task_id,
        experiment_kind=experiment_kind,
        result_state=result_state,
        scored=scored,
        included_in_pass_rate=included_in_pass_rate,
        score=score,
        provider_cost=provider_cost,
        failure_class=failure_class,
        latency_ms=latency_ms,
        provider_latency_ms_proxy=provider_latency_ms_proxy,
    )


def encdec_prediction_row(
    *,
    prediction_id: str = "pred-1",
    task_id: str = "HumanEval/1",
    generation_status: str = "success",
    generation_summary: dict | None = None,
    score_status: str | None = "success",
    score: float | None = 1.0,
    generated_code_outcome: str | None = "passed",
) -> MetricsPredictionRow:
    return MetricsPredictionRow(
        prediction_id=prediction_id,
        task_id=task_id,
        graph_layout="encdec",
        model="openai/gpt-4.1-mini",
        dimensions={
            "values": {
                "encoder_model": "enc-a",
                "decoder_model": "dec-b",
            }
        },
        provider_configs=[],
        generation_run_id=f"run-{prediction_id}",
        generation_status=generation_status,
        generation_summary=generation_summary or {},
        score_status=score_status,
        score=score,
        generated_code_outcome=generated_code_outcome,
    )


@pytest.mark.parametrize(
    ("result_state", "outcome", "expected"),
    [
        (ResultState.PASSED, "passed", True),
        (ResultState.FAILED, "tests_failed", True),
        (ResultState.FAILED, "extraction_failed", True),
        (ResultState.FAILED, "empty_generation", True),
        (ResultState.FAILED, "no_top_level_functions", True),
        (ResultState.FAILED, "evaluation_incomplete", False),
        (ResultState.ERROR, None, False),
        (ResultState.PENDING, None, False),
    ],
)
def test_included_in_pass_rate_rule(
    result_state: ResultState, outcome: str | None, expected: bool
) -> None:
    assert (
        prediction_included_in_pass_rate(
            result_state=result_state, generated_code_outcome=outcome
        )
        is expected
    )


def test_terminal_failure_class_reads_nested_payload() -> None:
    summary = {
        "terminal_error": {"failure": {"failure_class": "rate_limited"}},
    }
    assert terminal_failure_class(summary) == "rate_limited"
    assert terminal_failure_class({}) is None
    assert terminal_failure_class({"terminal_error": {}}) is None


def test_errored_prediction_row_builds_excluded_record() -> None:
    row = encdec_prediction_row(
        generation_status="error",
        generation_summary={
            "terminal_error": {"failure": {"failure_class": "rate_limited"}},
            "metadata": {"v0_source": {"v0_prediction_id": "legacy-1"}},
        },
        score_status=None,
        score=None,
        generated_code_outcome=None,
    )
    record = build_prediction_records([row], [])[0]

    assert record.result_state is ResultState.ERROR
    assert record.model == "enc-a -> dec-b"
    assert record.included_in_pass_rate is False
    assert record.scored is False
    assert record.failure_class == "rate_limited"
    assert record.latency_ms is None


def test_build_sweep_metrics_excludes_infra_errors_from_pass_rate() -> None:
    records = [
        make_record(prediction_id="p1", result_state=ResultState.PASSED, score=1.0),
        make_record(
            prediction_id="p2", result_state=ResultState.FAILED, score=0.0
        ),
        make_record(
            prediction_id="p3",
            result_state=ResultState.ERROR,
            scored=False,
            included_in_pass_rate=False,
            score=None,
            failure_class="rate_limited",
        ),
        make_record(
            prediction_id="p4",
            result_state=ResultState.PENDING,
            scored=False,
            included_in_pass_rate=False,
            score=None,
        ),
    ]
    metrics = build_sweep_metrics(records, computed_at=NOW)
    by_grouping = {
        metric.grouping: metric
        for metric in metrics
        if metric.grouping is MetricsGrouping.MODEL
    }
    model_row = by_grouping[MetricsGrouping.MODEL]

    assert model_row.n == 4
    assert model_row.pass_count == 1
    assert model_row.fail_count == 1
    assert model_row.error_count == 1
    assert model_row.pending_count == 1
    assert model_row.rate_limit_count == 1
    assert model_row.included_in_pass_rate_count == 2
    assert model_row.scored_n == 2
    assert model_row.pass_rate == 0.5
    assert model_row.total_cost == pytest.approx(0.04)
    assert model_row.computed_at == NOW


def test_build_sweep_metrics_emits_all_groupings_with_expected_keys() -> None:
    records = [
        make_record(prediction_id="p1", model="m1", task_id="HumanEval/1"),
        make_record(prediction_id="p2", model="m2", task_id="HumanEval/2"),
    ]
    metrics = build_sweep_metrics(records, computed_at=NOW)
    counts = dict.fromkeys(MetricsGrouping, 0)
    for metric in metrics:
        counts[metric.grouping] += 1

    assert counts[MetricsGrouping.MODEL] == 2
    assert counts[MetricsGrouping.MODEL_KIND] == 2
    assert counts[MetricsGrouping.TASK] == 2
    assert counts[MetricsGrouping.MODEL_TASK] == 2
    model_rows = [m for m in metrics if m.grouping is MetricsGrouping.MODEL]
    assert all(m.task_id is None and m.experiment_kind is None for m in model_rows)
    kind_rows = [m for m in metrics if m.grouping is MetricsGrouping.MODEL_KIND]
    assert all(
        m.experiment_kind is ExperimentKind.HUMANEVAL_ENCDEC for m in kind_rows
    )
    keys = [m.metric_key for m in metrics]
    assert len(keys) == len(set(keys))


def test_metric_keys_are_stable() -> None:
    assert (
        sweep_metric_key(
            MetricsGrouping.MODEL_TASK,
            model="enc-a -> dec-b",
            task_id="HumanEval/7",
            experiment_kind=None,
        )
        == "dr-dspy-v1/metrics/model_task/model=enc-a -> dec-b/task=HumanEval/7/kind=-"
    )


def test_pass_rate_rank_is_dense_within_partition() -> None:
    records = [
        make_record(prediction_id="p1", model="m1", score=1.0),
        make_record(prediction_id="p2", model="m2", score=1.0),
        make_record(
            prediction_id="p3",
            model="m3",
            result_state=ResultState.FAILED,
            score=0.0,
        ),
        make_record(
            prediction_id="p4",
            model="m4",
            result_state=ResultState.PENDING,
            scored=False,
            included_in_pass_rate=False,
            score=None,
        ),
    ]
    metrics = build_sweep_metrics(records, computed_at=NOW)
    model_rows = {
        m.model: m for m in metrics if m.grouping is MetricsGrouping.MODEL
    }

    assert model_rows["m1"].pass_rate_rank == 1
    assert model_rows["m2"].pass_rate_rank == 1
    assert model_rows["m3"].pass_rate_rank == 2
    assert model_rows["m4"].pass_rate_rank is None


def test_percentile_matches_percentile_cont() -> None:
    assert percentile([], 0.95) is None
    assert percentile([7.0], 0.95) == 7.0
    assert percentile([1.0, 2.0, 3.0, 4.0], 0.5) == 2.5
    assert percentile([10.0, 20.0], 0.95) == pytest.approx(19.5)


def test_run_provider_latency_proxy_uses_latest_attempt_per_node() -> None:
    def attempt(
        node_id: str, attempt_index: int, proxy: float | None
    ) -> MetricsNodeAttemptRow:
        return MetricsNodeAttemptRow(
            generation_run_id="run-1",
            node_id=node_id,
            attempt_index=attempt_index,
            status="success",
            provider_cost=None,
            provider_latency_ms_proxy=proxy,
            started_at=None,
            completed_at=None,
        )

    attempts = [
        attempt("encoder", 0, 100.0),
        attempt("encoder", 1, 250.0),
        attempt("decoder", 0, 400.0),
    ]
    assert run_provider_latency_ms_proxy(attempts) == 650.0
    assert run_provider_latency_ms_proxy([attempt("encoder", 0, None)]) is None


def test_run_measured_latency_is_none_for_v0_backfill() -> None:
    attempts = [
        MetricsNodeAttemptRow(
            generation_run_id="run-1",
            node_id="encoder",
            attempt_index=0,
            status="success",
            provider_cost=None,
            provider_latency_ms_proxy=None,
            started_at=NOW,
            completed_at=NOW + timedelta(seconds=2),
        )
    ]
    assert run_measured_latency_ms(attempts, is_v0_backfill=True) is None
    assert run_measured_latency_ms(attempts, is_v0_backfill=False) == 2000.0


def test_provider_latency_proxy_sql_expression_covers_both_levels() -> None:
    expression = provider_latency_proxy_sql_expression()

    assert expression.startswith("COALESCE(")
    assert "(response_metadata->>'response_ms')::double precision" in expression
    assert (
        "(response_metadata->'response_metadata'->>'response_ms')"
        "::double precision" in expression
    )


def test_build_metrics_predictions_query_wraps_left_join_canonical() -> None:
    query, params = build_metrics_predictions_query()

    assert "LEFT JOIN dr_dspy_score_attempts" in query
    assert "score_attempt_index DESC NULLS LAST" in query
    assert params["scoring_profile_id"] == "humaneval"
    assert params["scoring_profile_version"] == "v1"


def failed_attempt(
    *,
    prediction_id: str = "pred-1",
    node_id: str = "encoder",
    attempt_index: int = 0,
    model: str | None = None,
    provider_config_model: str | None = None,
    failure: dict | None = None,
) -> FailedNodeAttemptRow:
    return FailedNodeAttemptRow(
        prediction_id=prediction_id,
        generation_run_id=f"run-{prediction_id}",
        node_id=node_id,
        attempt_index=attempt_index,
        model=model,
        provider_config_model=provider_config_model,
        failure=failure,
    )


def test_build_failure_metrics_groups_and_falls_back_to_node_model() -> None:
    predictions = {"pred-1": encdec_prediction_row(prediction_id="pred-1")}
    attempts = [
        failed_attempt(
            failure={"failure_class": "unknown", "error_type": "APIError"},
        ),
        failed_attempt(
            attempt_index=1,
            failure={"failure_class": "unknown", "error_type": "APIError"},
        ),
        failed_attempt(
            node_id="decoder",
            model="dec-b",
            failure={"failure_class": "permanent", "error_type": "BadRequestError"},
        ),
    ]
    metrics = build_failure_metrics(attempts, predictions, computed_at=NOW)
    by_key = {(m.model, m.node_id, m.failure_class): m for m in metrics}

    unknown = by_key[("enc-a", "encoder", "unknown")]
    assert unknown.attempt_count == 2
    assert unknown.prediction_count == 1
    assert unknown.error_type == "APIError"
    assert unknown.display_model == "enc-a -> dec-b"
    assert unknown.source is SourceName.DR_DSPY_V1

    permanent = by_key[("dec-b", "decoder", "permanent")]
    assert permanent.attempt_count == 1
    keys = [m.metric_key for m in metrics]
    assert len(keys) == len(set(keys))


def test_build_failure_metrics_defaults_missing_failure_to_unknown() -> None:
    attempts = [failed_attempt(prediction_id="pred-x", failure=None)]
    metrics = build_failure_metrics(attempts, {}, computed_at=NOW)

    assert metrics[0].failure_class == "unknown"
    assert metrics[0].model == "unknown"
    assert metrics[0].display_model is None
    assert metrics[0].error_type is None


def test_metric_columns_match_model_fields() -> None:
    assert tuple(
        PublishedSweepMetric.model_fields
    ) == PUBLISHED_V1_SWEEP_METRIC_COLUMNS
    assert tuple(
        PublishedFailureMetric.model_fields
    ) == PUBLISHED_V1_FAILURE_METRIC_COLUMNS


def test_metrics_insert_upsert_sql_targets_metric_key() -> None:
    statement = insert_upsert_sql(
        PUBLISHED_V1_SWEEP_METRICS_TABLE,
        PUBLISHED_V1_SWEEP_METRIC_COLUMNS,
        "metric_key",
    )
    assert statement.startswith(f"INSERT INTO {PUBLISHED_V1_SWEEP_METRICS_TABLE}")
    assert "ON CONFLICT (metric_key)" in statement

    failure_statement = insert_upsert_sql(
        PUBLISHED_V1_FAILURE_METRICS_TABLE,
        PUBLISHED_V1_FAILURE_METRIC_COLUMNS,
        "metric_key",
    )
    assert "ON CONFLICT (metric_key)" in failure_statement
