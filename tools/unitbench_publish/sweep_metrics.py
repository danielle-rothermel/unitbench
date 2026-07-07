"""Build the published_v1_sweep_metrics / published_v1_failure_metrics projections.

Aggregates the dr-dspy v1 prediction population (including generation errors,
via the LEFT-JOIN canonical query) into small grouped metric tables that feed
the R1 sweep dashboard. Fetchers read the whetstone source DB; the builders are
pure functions over validated rows so they are unit-testable without a DB.
"""

from __future__ import annotations

import math
from collections import Counter, defaultdict
from collections.abc import Iterable, Mapping, Sequence
from datetime import datetime
from statistics import mean, stdev
from typing import Any

from psycopg import Connection
from psycopg.rows import DictRow
from pydantic import BaseModel, ConfigDict, Field, StrictInt, StrictStr

from unitbench_publish.dr_dspy_v1 import (
    build_canonical_query,
    display_model_label,
    experiment_kind_for_layout,
    extract_encoder_decoder_models,
)
from unitbench_publish.models import (
    ExperimentKind,
    MetricsGrouping,
    PublishedFailureMetric,
    PublishedSweepMetric,
    ResultState,
    SourceName,
    SweepMetricsDataset,
    result_state_for_v1_prediction,
)

SOURCE = SourceName.DR_DSPY_V1
SWEEP_METRIC_KEY_PREFIX = "dr-dspy-v1/metrics"
FAILURE_METRIC_KEY_PREFIX = "dr-dspy-v1/failures"
EMPTY_KEY_SEGMENT = "-"

RATE_LIMITED_FAILURE_CLASS = "rate_limited"
UNKNOWN_FAILURE_CLASS = "unknown"
UNKNOWN_MODEL = "unknown"

# Q3 rule: scored outcomes where the extraction+testing flow did not complete
# are infra noise inside the flow, so they leave the pass-rate denominator.
PASS_RATE_EXCLUDED_OUTCOMES = frozenset({"evaluation_incomplete"})

# Provider-reported timing keys (ms) probed at either nesting level of
# response_metadata. The v0 OpenRouter backfill payloads carry none of these,
# so the proxy stays NULL there; kept for providers that do report timing.
PROVIDER_LATENCY_METADATA_KEYS = (
    "response_ms",
    "generation_time_ms",
    "latency_ms",
    "generation_time",
)
NESTED_RESPONSE_METADATA_KEY = "response_metadata"

P95_QUANTILE = 0.95

SCORE_SUCCESS_STATUS = "success"
NODE_ATTEMPT_ERROR_STATUS = "error"

METRICS_PREDICTIONS_SQL = """
SELECT
    prediction_id,
    task_id,
    graph_layout,
    model,
    dimensions,
    provider_configs,
    generation_run_id,
    generation_status,
    generation_summary,
    score_status,
    score,
    generated_code_outcome
FROM ({canonical_query}) canonical
"""

METRICS_NODE_ATTEMPTS_SQL = """
SELECT
    generation_run_id,
    node_id,
    attempt_index,
    status,
    (usage_cost->>'provider_cost')::double precision AS provider_cost,
    {latency_proxy_expression} AS provider_latency_ms_proxy,
    started_at,
    completed_at
FROM dr_dspy_node_attempts
WHERE generation_run_id = ANY(%(generation_run_ids)s)
ORDER BY generation_run_id, node_id, attempt_index
"""

FAILED_NODE_ATTEMPTS_SQL = f"""
SELECT
    prediction_id,
    generation_run_id,
    node_id,
    attempt_index,
    model,
    provider_config->>'model' AS provider_config_model,
    failure
FROM dr_dspy_node_attempts
WHERE status = '{NODE_ATTEMPT_ERROR_STATUS}'
ORDER BY prediction_id, node_id, attempt_index
"""


class MetricsPredictionRow(BaseModel):
    """Slim projection of one canonical prediction, straight off the source DB."""

    model_config = ConfigDict(extra="forbid")

    prediction_id: StrictStr
    task_id: StrictStr
    graph_layout: StrictStr
    model: StrictStr
    dimensions: dict[str, Any] = Field(default_factory=dict)
    provider_configs: list[Any] = Field(default_factory=list)
    generation_run_id: StrictStr
    generation_status: StrictStr
    generation_summary: dict[str, Any] = Field(default_factory=dict)
    score_status: StrictStr | None
    score: float | None
    generated_code_outcome: StrictStr | None

    def display_model(self) -> str:
        return display_model_label(
            graph_layout=self.graph_layout,
            model=self.model,
            dimensions=self.dimensions,
            provider_configs=self.provider_configs,
        )

    def node_model(self, node_id: str) -> str | None:
        if self.graph_layout == "encdec":
            encoder, decoder = extract_encoder_decoder_models(
                self.dimensions, self.provider_configs
            )
            if node_id == "encoder":
                return encoder
            if node_id == "decoder":
                return decoder
        return self.model


class MetricsNodeAttemptRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    generation_run_id: StrictStr
    node_id: StrictStr
    attempt_index: StrictInt
    status: StrictStr
    provider_cost: float | None
    provider_latency_ms_proxy: float | None
    started_at: datetime | None
    completed_at: datetime | None


class FailedNodeAttemptRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prediction_id: StrictStr
    generation_run_id: StrictStr
    node_id: StrictStr
    attempt_index: StrictInt
    model: StrictStr | None
    provider_config_model: StrictStr | None
    failure: dict[str, Any] | None = None

    def failure_class(self) -> str:
        if isinstance(self.failure, dict):
            value = self.failure.get("failure_class")
            if value is not None:
                return str(value)
        return UNKNOWN_FAILURE_CLASS

    def error_type(self) -> str | None:
        if isinstance(self.failure, dict):
            value = self.failure.get("error_type")
            if value is not None:
                return str(value)
        return None


class PredictionMetricsRecord(BaseModel):
    """Per-prediction derivation the grouped aggregates are computed from."""

    model_config = ConfigDict(extra="forbid")

    prediction_id: StrictStr
    model: StrictStr
    task_id: StrictStr
    experiment_kind: ExperimentKind
    result_state: ResultState
    scored: bool
    included_in_pass_rate: bool
    score: float | None
    provider_cost: float | None
    failure_class: StrictStr | None
    latency_ms: float | None
    provider_latency_ms_proxy: float | None


def terminal_failure_class(generation_summary: Mapping[str, Any]) -> str | None:
    terminal_error = generation_summary.get("terminal_error")
    if not isinstance(terminal_error, dict):
        return None
    failure = terminal_error.get("failure")
    if not isinstance(failure, dict):
        return None
    value = failure.get("failure_class")
    return str(value) if value is not None else None


def has_v0_source_marker(generation_summary: Mapping[str, Any]) -> bool:
    metadata = generation_summary.get("metadata")
    return isinstance(metadata, dict) and "v0_source" in metadata


def prediction_included_in_pass_rate(
    *,
    result_state: ResultState,
    generated_code_outcome: str | None,
) -> bool:
    """Q3 denominator rule.

    Included: predictions whose model output genuinely exercised extraction +
    testing — scored passed/failed rows, including model-caused failures such
    as unparseable output (those score as failed with outcomes like
    extraction_failed / empty_generation, so they stay in the denominator).
    Excluded: provider/infra errors (result_state error — every generation
    failure_class is provider-side), pending rows, and scored rows whose
    evaluation did not complete (infra noise inside the flow).
    """
    if result_state not in (ResultState.PASSED, ResultState.FAILED):
        return False
    return generated_code_outcome not in PASS_RATE_EXCLUDED_OUTCOMES


def provider_latency_proxy_sql_expression() -> str:
    """COALESCE over known provider timing keys at both nesting levels (ms)."""
    casts = []
    for key in PROVIDER_LATENCY_METADATA_KEYS:
        casts.append(f"(response_metadata->>'{key}')::double precision")
        casts.append(
            f"(response_metadata->'{NESTED_RESPONSE_METADATA_KEY}'->>'{key}')"
            "::double precision"
        )
    return f"COALESCE({', '.join(casts)})"


def latest_attempt_per_node(
    attempts: Iterable[MetricsNodeAttemptRow],
) -> dict[str, MetricsNodeAttemptRow]:
    latest: dict[str, MetricsNodeAttemptRow] = {}
    for attempt in attempts:
        existing = latest.get(attempt.node_id)
        if existing is None or attempt.attempt_index > existing.attempt_index:
            latest[attempt.node_id] = attempt
    return latest


def run_provider_cost(attempts: Sequence[MetricsNodeAttemptRow]) -> float | None:
    costs = [a.provider_cost for a in attempts if a.provider_cost is not None]
    return sum(costs) if costs else None


def run_provider_latency_ms_proxy(
    attempts: Sequence[MetricsNodeAttemptRow],
) -> float | None:
    proxies = [
        attempt.provider_latency_ms_proxy
        for attempt in latest_attempt_per_node(attempts).values()
        if attempt.provider_latency_ms_proxy is not None
    ]
    return sum(proxies) if proxies else None


def run_measured_latency_ms(
    attempts: Sequence[MetricsNodeAttemptRow],
    *,
    is_v0_backfill: bool,
) -> float | None:
    """Sum of latest-attempt durations; None on backfill (timestamps synthetic)."""
    if is_v0_backfill:
        return None
    durations = [
        (attempt.completed_at - attempt.started_at).total_seconds() * 1000.0
        for attempt in latest_attempt_per_node(attempts).values()
        if attempt.started_at is not None and attempt.completed_at is not None
    ]
    return sum(durations) if durations else None


def prediction_metrics_record(
    row: MetricsPredictionRow,
    run_attempts: Sequence[MetricsNodeAttemptRow],
) -> PredictionMetricsRecord:
    result_state = result_state_for_v1_prediction(
        generation_status=row.generation_status,
        scoring_status=row.score_status,
        score=row.score,
        generated_code_outcome=row.generated_code_outcome,
    )
    return PredictionMetricsRecord(
        prediction_id=row.prediction_id,
        model=row.display_model(),
        task_id=row.task_id,
        experiment_kind=experiment_kind_for_layout(row.graph_layout),
        result_state=result_state,
        scored=row.score_status == SCORE_SUCCESS_STATUS,
        included_in_pass_rate=prediction_included_in_pass_rate(
            result_state=result_state,
            generated_code_outcome=row.generated_code_outcome,
        ),
        score=row.score,
        provider_cost=run_provider_cost(run_attempts),
        failure_class=terminal_failure_class(row.generation_summary),
        latency_ms=run_measured_latency_ms(
            run_attempts,
            is_v0_backfill=has_v0_source_marker(row.generation_summary),
        ),
        provider_latency_ms_proxy=run_provider_latency_ms_proxy(run_attempts),
    )


GroupKey = tuple[str | None, str | None, ExperimentKind | None]


MODEL_KEYED_GROUPINGS = (
    MetricsGrouping.MODEL,
    MetricsGrouping.MODEL_KIND,
    MetricsGrouping.MODEL_TASK,
)


def group_key_for(
    grouping: MetricsGrouping, record: PredictionMetricsRecord
) -> GroupKey:
    model = record.model if grouping in MODEL_KEYED_GROUPINGS else None
    task_id = (
        record.task_id
        if grouping in (MetricsGrouping.TASK, MetricsGrouping.MODEL_TASK)
        else None
    )
    kind = (
        record.experiment_kind if grouping is MetricsGrouping.MODEL_KIND else None
    )
    return (model, task_id, kind)


def sweep_metric_key(
    grouping: MetricsGrouping,
    *,
    model: str | None,
    task_id: str | None,
    experiment_kind: ExperimentKind | None,
) -> str:
    kind_segment = experiment_kind.value if experiment_kind else EMPTY_KEY_SEGMENT
    return "/".join(
        (
            SWEEP_METRIC_KEY_PREFIX,
            grouping.value,
            f"model={model or EMPTY_KEY_SEGMENT}",
            f"task={task_id or EMPTY_KEY_SEGMENT}",
            f"kind={kind_segment}",
        )
    )


def percentile(values: Sequence[float], quantile: float) -> float | None:
    """percentile_cont-equivalent linear interpolation."""
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * quantile
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    fraction = position - lower
    return ordered[lower] * (1 - fraction) + ordered[upper] * fraction


def mean_or_none(values: Sequence[float]) -> float | None:
    return mean(values) if values else None


def stddev_or_none(values: Sequence[float]) -> float | None:
    return stdev(values) if len(values) >= 2 else None


def sweep_metric_for_group(
    grouping: MetricsGrouping,
    key: GroupKey,
    records: Sequence[PredictionMetricsRecord],
    *,
    computed_at: datetime,
) -> PublishedSweepMetric:
    model, task_id, experiment_kind = key
    states = Counter(record.result_state for record in records)
    pass_count = states[ResultState.PASSED]
    included_count = sum(1 for r in records if r.included_in_pass_rate)
    scores = [r.score for r in records if r.score is not None]
    costs = [r.provider_cost for r in records if r.provider_cost is not None]
    latencies = [r.latency_ms for r in records if r.latency_ms is not None]
    proxies = [
        r.provider_latency_ms_proxy
        for r in records
        if r.provider_latency_ms_proxy is not None
    ]
    return PublishedSweepMetric(
        metric_key=sweep_metric_key(
            grouping, model=model, task_id=task_id, experiment_kind=experiment_kind
        ),
        source=SOURCE,
        grouping=grouping,
        model=model,
        task_id=task_id,
        experiment_kind=experiment_kind,
        n=len(records),
        pass_count=pass_count,
        fail_count=states[ResultState.FAILED],
        pending_count=states[ResultState.PENDING],
        error_count=states[ResultState.ERROR],
        rate_limit_count=sum(
            1 for r in records if r.failure_class == RATE_LIMITED_FAILURE_CLASS
        ),
        included_in_pass_rate_count=included_count,
        scored_n=sum(1 for r in records if r.scored),
        pass_rate=pass_count / included_count if included_count else None,
        avg_score=mean_or_none(scores),
        stddev_score=stddev_or_none(scores),
        avg_cost=mean_or_none(costs),
        total_cost=sum(costs) if costs else None,
        avg_latency_ms=mean_or_none(latencies),
        p95_latency_ms=percentile(latencies, P95_QUANTILE),
        avg_provider_latency_ms_proxy=mean_or_none(proxies),
        p95_provider_latency_ms_proxy=percentile(proxies, P95_QUANTILE),
        pass_rate_rank=None,
        computed_at=computed_at,
        updated_at=computed_at,
    )


def assign_pass_rate_ranks(metrics: Iterable[PublishedSweepMetric]) -> None:
    """Dense-rank pass_rate (DESC) within each (grouping, experiment_kind)."""
    partitions: dict[
        tuple[MetricsGrouping, ExperimentKind | None], list[PublishedSweepMetric]
    ] = defaultdict(list)
    for metric in metrics:
        partitions[(metric.grouping, metric.experiment_kind)].append(metric)
    for partition in partitions.values():
        rates = sorted(
            {m.pass_rate for m in partition if m.pass_rate is not None},
            reverse=True,
        )
        rank_by_rate = {rate: rank for rank, rate in enumerate(rates, start=1)}
        for metric in partition:
            metric.pass_rate_rank = (
                rank_by_rate[metric.pass_rate]
                if metric.pass_rate is not None
                else None
            )


def build_sweep_metrics(
    records: Sequence[PredictionMetricsRecord],
    *,
    computed_at: datetime,
) -> list[PublishedSweepMetric]:
    metrics: list[PublishedSweepMetric] = []
    for grouping in MetricsGrouping:
        groups: dict[GroupKey, list[PredictionMetricsRecord]] = defaultdict(list)
        for record in records:
            groups[group_key_for(grouping, record)].append(record)
        for key in sorted(
            groups, key=lambda k: tuple(str(part) if part else "" for part in k)
        ):
            metrics.append(
                sweep_metric_for_group(
                    grouping, key, groups[key], computed_at=computed_at
                )
            )
    assign_pass_rate_ranks(metrics)
    return metrics


def failure_attempt_model(
    attempt: FailedNodeAttemptRow,
    prediction: MetricsPredictionRow | None,
) -> str:
    if attempt.model:
        return attempt.model
    if attempt.provider_config_model:
        return attempt.provider_config_model
    if prediction is not None:
        node_model = prediction.node_model(attempt.node_id)
        if node_model:
            return node_model
    return UNKNOWN_MODEL


def failure_metric_key(
    *,
    model: str,
    node_id: str,
    failure_class: str,
    display_model: str | None,
) -> str:
    return "/".join(
        (
            FAILURE_METRIC_KEY_PREFIX,
            model,
            node_id,
            failure_class,
            f"display={display_model or EMPTY_KEY_SEGMENT}",
        )
    )


def most_common_error_type(attempts: Sequence[FailedNodeAttemptRow]) -> str | None:
    error_types = [
        error_type
        for error_type in (attempt.error_type() for attempt in attempts)
        if error_type is not None
    ]
    if not error_types:
        return None
    counts = Counter(error_types)
    top_count = max(counts.values())
    return min(name for name, count in counts.items() if count == top_count)


def build_failure_metrics(
    failed_attempts: Sequence[FailedNodeAttemptRow],
    predictions_by_id: Mapping[str, MetricsPredictionRow],
    *,
    computed_at: datetime,
) -> list[PublishedFailureMetric]:
    FailureKey = tuple[str, str | None, str, str]
    groups: dict[FailureKey, list[FailedNodeAttemptRow]] = defaultdict(list)
    for attempt in failed_attempts:
        prediction = predictions_by_id.get(attempt.prediction_id)
        model = failure_attempt_model(attempt, prediction)
        display = prediction.display_model() if prediction is not None else None
        groups[(model, display, attempt.node_id, attempt.failure_class())].append(
            attempt
        )
    metrics: list[PublishedFailureMetric] = []
    for key in sorted(groups, key=lambda k: tuple(str(part) for part in k)):
        model, display, node_id, failure_class = key
        attempts = groups[key]
        metrics.append(
            PublishedFailureMetric(
                metric_key=failure_metric_key(
                    model=model,
                    node_id=node_id,
                    failure_class=failure_class,
                    display_model=display,
                ),
                source=SOURCE,
                model=model,
                display_model=display,
                node_id=node_id,
                failure_class=failure_class,
                error_type=most_common_error_type(attempts),
                attempt_count=len(attempts),
                prediction_count=len({a.prediction_id for a in attempts}),
                computed_at=computed_at,
                updated_at=computed_at,
            )
        )
    return metrics


def build_metrics_predictions_query() -> tuple[str, dict[str, Any]]:
    canonical_query, params = build_canonical_query(
        experiment_names=None, graph_layout=None
    )
    return METRICS_PREDICTIONS_SQL.format(canonical_query=canonical_query), params


def fetch_metrics_predictions(
    connection: Connection[DictRow],
) -> list[MetricsPredictionRow]:
    query, params = build_metrics_predictions_query()
    with connection.cursor() as cursor:
        cursor.execute(query, params)
        rows = [dict(row) for row in cursor.fetchall()]
    return [MetricsPredictionRow(**row) for row in rows]


def fetch_metrics_node_attempts(
    connection: Connection[DictRow],
    generation_run_ids: Sequence[str],
) -> list[MetricsNodeAttemptRow]:
    if not generation_run_ids:
        return []
    query = METRICS_NODE_ATTEMPTS_SQL.format(
        latency_proxy_expression=provider_latency_proxy_sql_expression()
    )
    with connection.cursor() as cursor:
        cursor.execute(query, {"generation_run_ids": list(generation_run_ids)})
        rows = [dict(row) for row in cursor.fetchall()]
    return [MetricsNodeAttemptRow(**row) for row in rows]


def fetch_failed_node_attempts(
    connection: Connection[DictRow],
) -> list[FailedNodeAttemptRow]:
    with connection.cursor() as cursor:
        cursor.execute(FAILED_NODE_ATTEMPTS_SQL)
        rows = [dict(row) for row in cursor.fetchall()]
    return [FailedNodeAttemptRow(**row) for row in rows]


def group_attempts_by_run(
    attempts: Iterable[MetricsNodeAttemptRow],
) -> dict[str, list[MetricsNodeAttemptRow]]:
    grouped: dict[str, list[MetricsNodeAttemptRow]] = defaultdict(list)
    for attempt in attempts:
        grouped[attempt.generation_run_id].append(attempt)
    return grouped


def build_prediction_records(
    prediction_rows: Sequence[MetricsPredictionRow],
    node_attempts: Sequence[MetricsNodeAttemptRow],
) -> list[PredictionMetricsRecord]:
    attempts_by_run = group_attempts_by_run(node_attempts)
    return [
        prediction_metrics_record(
            row, attempts_by_run.get(row.generation_run_id, [])
        )
        for row in prediction_rows
    ]


def fetch_sweep_metrics_dataset(
    connection: Connection[DictRow],
    *,
    computed_at: datetime,
) -> SweepMetricsDataset:
    prediction_rows = fetch_metrics_predictions(connection)
    generation_run_ids = sorted({row.generation_run_id for row in prediction_rows})
    node_attempts = fetch_metrics_node_attempts(connection, generation_run_ids)
    records = build_prediction_records(prediction_rows, node_attempts)
    failed_attempts = fetch_failed_node_attempts(connection)
    predictions_by_id = {row.prediction_id: row for row in prediction_rows}
    return SweepMetricsDataset(
        sweep_metrics=build_sweep_metrics(records, computed_at=computed_at),
        failure_metrics=build_failure_metrics(
            failed_attempts, predictions_by_id, computed_at=computed_at
        ),
    )
