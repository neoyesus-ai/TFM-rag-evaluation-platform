from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.models import (
    ExperimentRunSummary,
)
from app.analytics.repository import (
    AnalyticsRepository,
)
from app.experiment.context import ExperimentContext


QUALITY_SCORE_WEIGHTS = {
    "overall_score": 0.40,
    "groundedness": 0.25,
    "answer_f1": 0.20,
    "context_precision": 0.075,
    "context_recall": 0.075,
}


def get_float(
    source: dict[str, Any],
    key: str,
) -> float | None:
    value = source.get(key)

    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def get_integer(
    source: dict[str, Any],
    key: str,
) -> int | None:
    value = source.get(key)

    if value is None:
        return None

    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def get_nested_value(
    source: dict[str, Any],
    *path: str,
) -> Any:
    current: Any = source

    for key in path:
        if not isinstance(current, dict):
            return None

        current = current.get(key)

        if current is None:
            return None

    return current


def get_optional_string(
    value: Any,
) -> str | None:
    if value is None:
        return None

    normalized = str(value).strip()

    return normalized or None


def get_optional_float(
    value: Any,
) -> float | None:
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def get_optional_integer(
    value: Any,
) -> int | None:
    if value is None:
        return None

    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def calculate_quality_score(
    metrics: dict[str, Any],
) -> float | None:
    values = {
        "overall_score": get_float(
            metrics,
            "evaluation_overall_score",
        ),
        "groundedness": get_float(
            metrics,
            "evaluation_groundedness_proxy",
        ),
        "answer_f1": get_float(
            metrics,
            "evaluation_answer_token_f1",
        ),
        "context_precision": get_float(
            metrics,
            "evaluation_context_precision_proxy",
        ),
        "context_recall": get_float(
            metrics,
            "evaluation_context_recall_proxy",
        ),
    }

    weighted_total = 0.0
    available_weight = 0.0

    for metric_name, weight in (
        QUALITY_SCORE_WEIGHTS.items()
    ):
        value = values[metric_name]

        if value is None:
            continue

        bounded_value = max(
            0.0,
            min(1.0, value),
        )

        weighted_total += (
            bounded_value * weight
        )
        available_weight += weight

    if available_weight == 0:
        return None

    return weighted_total / available_weight


def calculate_efficiency_score(
    metrics: dict[str, Any],
) -> float | None:
    latency_ms = get_float(
        metrics,
        "generation_mean_latency_ms",
    )

    total_tokens = get_float(
        metrics,
        "generation_total_tokens",
    )

    components: list[float] = []

    if latency_ms is not None:
        latency_efficiency = 1.0 / (
            1.0 + latency_ms / 10000.0
        )

        components.append(
            latency_efficiency
        )

    if total_tokens is not None:
        token_efficiency = 1.0 / (
            1.0 + total_tokens / 1000.0
        )

        components.append(
            token_efficiency
        )

    if not components:
        return None

    return sum(components) / len(
        components
    )


def calculate_recommendation_score(
    metrics: dict[str, Any],
) -> float | None:
    quality_score = calculate_quality_score(
        metrics
    )

    efficiency_score = (
        calculate_efficiency_score(
            metrics
        )
    )

    if quality_score is None:
        return None

    if efficiency_score is None:
        return quality_score

    return (
        quality_score * 0.85
        + efficiency_score * 0.15
    )


def build_summary_values(
    context: ExperimentContext,
) -> dict[str, Any]:
    metrics = context.metrics
    configuration = (
        context.version.configuration
    )

    generation_configuration = (
        get_nested_value(
            configuration,
            "generation",
        )
        or {}
    )

    embedding_configuration = (
        get_nested_value(
            configuration,
            "embedding",
        )
        or get_nested_value(
            configuration,
            "embeddings",
        )
        or {}
    )

    chunking_configuration = (
        get_nested_value(
            configuration,
            "chunking",
        )
        or {}
    )

    retrieval_configuration = (
        get_nested_value(
            configuration,
            "retrieval",
        )
        or {}
    )

    return {
        "overall_score": get_float(
            metrics,
            "evaluation_overall_score",
        ),
        "groundedness": get_float(
            metrics,
            "evaluation_groundedness_proxy",
        ),
        "answer_f1": get_float(
            metrics,
            "evaluation_answer_token_f1",
        ),
        "context_precision": get_float(
            metrics,
            "evaluation_context_precision_proxy",
        ),
        "context_recall": get_float(
            metrics,
            "evaluation_context_recall_proxy",
        ),
        "retrieval_mean_similarity": get_float(
            metrics,
            "retrieval_mean_similarity",
        ),
        "generation_mean_latency_ms": get_float(
            metrics,
            "generation_mean_latency_ms",
        ),
        "runner_total_ms": get_float(
            metrics,
            "runner_total_ms",
        ),
        "prompt_tokens": get_integer(
            metrics,
            "generation_prompt_tokens",
        ),
        "completion_tokens": get_integer(
            metrics,
            "generation_completion_tokens",
        ),
        "total_tokens": get_integer(
            metrics,
            "generation_total_tokens",
        ),
        "tokens_per_second": get_float(
            metrics,
            "generation_completion_tokens_per_second",
        ),
        "generation_provider": get_optional_string(
            generation_configuration.get(
                "provider"
            )
        ),
        "generation_model": get_optional_string(
            generation_configuration.get(
                "model"
            )
        ),
        "embedding_provider": get_optional_string(
            embedding_configuration.get(
                "provider"
            )
        ),
        "embedding_model": get_optional_string(
            embedding_configuration.get(
                "model"
            )
        ),
        "chunking_strategy": get_optional_string(
            chunking_configuration.get(
                "strategy"
            )
        ),
        "chunk_size": get_optional_integer(
            chunking_configuration.get(
                "chunk_size",
                chunking_configuration.get(
                    "size"
                ),
            )
        ),
        "chunk_overlap": get_optional_integer(
            chunking_configuration.get(
                "chunk_overlap",
                chunking_configuration.get(
                    "overlap"
                ),
            )
        ),
        "retrieval_strategy": get_optional_string(
            retrieval_configuration.get(
                "strategy"
            )
        ),
        "retrieval_top_k": get_optional_integer(
            retrieval_configuration.get(
                "top_k"
            )
        ),
        "recommendation_score": (
            calculate_recommendation_score(
                metrics
            )
        ),
        "run_started_at": (
            context.run.started_at
        ),
        "run_finished_at": (
            context.run.finished_at
        ),
    }


def build_dynamic_metrics(
    context: ExperimentContext,
) -> dict[str, float]:
    dynamic_metrics: dict[
        str,
        float,
    ] = {}

    for metric_name, metric_value in (
        context.metrics.items()
    ):
        try:
            dynamic_metrics[
                metric_name
            ] = float(metric_value)
        except (TypeError, ValueError):
            continue

    quality_score = calculate_quality_score(
        context.metrics
    )

    efficiency_score = (
        calculate_efficiency_score(
            context.metrics
        )
    )

    recommendation_score = (
        calculate_recommendation_score(
            context.metrics
        )
    )

    if quality_score is not None:
        dynamic_metrics[
            "analytics_quality_score"
        ] = quality_score

    if efficiency_score is not None:
        dynamic_metrics[
            "analytics_efficiency_score"
        ] = efficiency_score

    if recommendation_score is not None:
        dynamic_metrics[
            "analytics_recommendation_score"
        ] = recommendation_score

    return dynamic_metrics


def build_dynamic_parameters(
    context: ExperimentContext,
) -> dict[str, Any]:
    parameters: dict[str, Any] = {}

    def flatten(
        source: dict[str, Any],
        prefix: str = "",
    ) -> None:
        for key, value in source.items():
            full_key = (
                f"{prefix}.{key}"
                if prefix
                else key
            )

            if isinstance(value, dict):
                flatten(
                    value,
                    full_key,
                )
            elif isinstance(value, list):
                parameters[full_key] = (
                    ", ".join(
                        str(item)
                        for item in value
                    )
                )
            elif value is not None:
                parameters[full_key] = value

    flatten(
        context.version.configuration
    )

    parameters[
        "analytics.experiment_name"
    ] = context.experiment.name

    parameters[
        "analytics.experiment_version"
    ] = context.version.version_number

    parameters[
        "analytics.configuration_hash"
    ] = context.version.configuration_hash

    if context.experiment.dataset_id:
        parameters[
            "analytics.dataset_id"
        ] = str(
            context.experiment.dataset_id
        )

    return parameters


def build_stage_metrics(
    context: ExperimentContext,
) -> list[tuple[str, float]]:
    completed_stages = (
        context.metadata.get(
            "completed_stages",
            [],
        )
    )

    stage_metrics: list[
        tuple[str, float]
    ] = []

    if not isinstance(
        completed_stages,
        list,
    ):
        return stage_metrics

    for stage in completed_stages:
        if not isinstance(stage, dict):
            continue

        stage_name = get_optional_string(
            stage.get("name")
        )

        duration_ms = get_optional_float(
            stage.get("duration_ms")
        )

        if (
            stage_name is None
            or duration_ms is None
        ):
            continue

        stage_metrics.append(
            (
                stage_name,
                duration_ms,
            )
        )

    return stage_metrics


async def persist_experiment_analytics(
    session: AsyncSession,
    context: ExperimentContext,
) -> ExperimentRunSummary:
    if context.run.mlflow_run_id is None:
        raise ValueError(
            "No se pueden persistir los datos "
            "analíticos sin mlflow_run_id."
        )

    repository = AnalyticsRepository(
        session
    )

    summary = await repository.upsert_summary(
        run_id=context.run.id,
        experiment_id=(
            context.experiment.id
        ),
        experiment_version_id=(
            context.version.id
        ),
        dataset_id=(
            context.experiment.dataset_id
        ),
        mlflow_run_id=(
            context.run.mlflow_run_id
        ),
        experiment_name=(
            context.experiment.name
        ),
        experiment_version=(
            context.version.version_number
        ),
        configuration_hash=(
            context.version.configuration_hash
        ),
        values=build_summary_values(
            context
        ),
    )

    await repository.replace_metrics(
        run_id=context.run.id,
        metrics=build_dynamic_metrics(
            context
        ),
    )

    await repository.replace_parameters(
        run_id=context.run.id,
        parameters=build_dynamic_parameters(
            context
        ),
    )

    await repository.replace_stage_metrics(
        run_id=context.run.id,
        stages=build_stage_metrics(
            context
        ),
    )

    return summary
