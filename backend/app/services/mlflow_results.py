import asyncio
from datetime import datetime, timezone

from mlflow import MlflowClient
from mlflow.entities import FileInfo

from app.core.config import settings
from app.models.experiment import ExperimentRun
from app.schemas.experiment_run import (
    ExperimentRunArtifactsResponse,
    ExperimentRunConfigurationResponse,
    ExperimentRunMetricsResponse,
    ExperimentRunResultsResponse,
    MlflowArtifactResponse,
)


def milliseconds_to_datetime(
    value: int | None,
) -> datetime | None:
    if value is None:
        return None

    return datetime.fromtimestamp(
        value / 1000,
        tz=timezone.utc,
    )


def metric_value(
    metrics: dict[str, float],
    key: str,
) -> float | None:
    value = metrics.get(key)

    if value is None:
        return None

    return float(value)


def parameter_value(
    parameters: dict[str, str],
    *keys: str,
) -> str | None:
    for key in keys:
        value = parameters.get(key)

        if value is not None:
            return value

    return None


def build_normalized_metrics(
    raw_metrics: dict[str, float],
) -> ExperimentRunMetricsResponse:
    return ExperimentRunMetricsResponse(
        overall_score=metric_value(
            raw_metrics,
            "evaluation_overall_score",
        ),
        groundedness=metric_value(
            raw_metrics,
            "evaluation_groundedness_proxy",
        ),
        answer_token_f1=metric_value(
            raw_metrics,
            "evaluation_answer_token_f1",
        ),
        answer_token_precision=metric_value(
            raw_metrics,
            "evaluation_answer_token_precision",
        ),
        answer_token_recall=metric_value(
            raw_metrics,
            "evaluation_answer_token_recall",
        ),
        answer_relevancy=metric_value(
            raw_metrics,
            "evaluation_answer_relevancy_proxy",
        ),
        context_precision=metric_value(
            raw_metrics,
            "evaluation_context_precision_proxy",
        ),
        context_recall=metric_value(
            raw_metrics,
            "evaluation_context_recall_proxy",
        ),
        retrieval_mean_similarity=metric_value(
            raw_metrics,
            "retrieval_mean_similarity",
        ),
        retrieval_min_similarity=metric_value(
            raw_metrics,
            "retrieval_min_similarity",
        ),
        retrieval_max_similarity=metric_value(
            raw_metrics,
            "retrieval_max_similarity",
        ),
        retrieval_duration_ms=metric_value(
            raw_metrics,
            "retrieval_duration_ms",
        ),
        retrieval_mean_question_latency_ms=metric_value(
            raw_metrics,
            "retrieval_mean_question_latency_ms",
        ),
        generation_duration_ms=metric_value(
            raw_metrics,
            "generation_duration_ms",
        ),
        generation_mean_latency_ms=metric_value(
            raw_metrics,
            "generation_mean_latency_ms",
        ),
        generation_min_latency_ms=metric_value(
            raw_metrics,
            "generation_min_latency_ms",
        ),
        generation_max_latency_ms=metric_value(
            raw_metrics,
            "generation_max_latency_ms",
        ),
        prompt_tokens=metric_value(
            raw_metrics,
            "generation_prompt_tokens",
        ),
        completion_tokens=metric_value(
            raw_metrics,
            "generation_completion_tokens",
        ),
        total_tokens=metric_value(
            raw_metrics,
            "generation_total_tokens",
        ),
        completion_tokens_per_second=metric_value(
            raw_metrics,
            "generation_completion_tokens_per_second",
        ),
        document_count=metric_value(
            raw_metrics,
            "document_count",
        ),
        chunk_count=metric_value(
            raw_metrics,
            "chunk_count",
        ),
        embedding_count=metric_value(
            raw_metrics,
            "embedding_count",
        ),
        indexed_chunk_count=metric_value(
            raw_metrics,
            "indexed_chunk_count",
        ),
        question_count=metric_value(
            raw_metrics,
            "evaluation_question_count",
        ),
        runner_total_ms=metric_value(
            raw_metrics,
            "runner_total_ms",
        ),
    )


def build_configuration(
    parameters: dict[str, str],
) -> ExperimentRunConfigurationResponse:
    return ExperimentRunConfigurationResponse(
        generation_provider=parameter_value(
            parameters,
            "generation.provider",
        ),
        generation_model=parameter_value(
            parameters,
            "generation.model",
        ),
        generation_temperature=parameter_value(
            parameters,
            "generation.temperature",
        ),
        embedding_provider=parameter_value(
            parameters,
            "embedding.provider",
            "embeddings.provider",
        ),
        embedding_model=parameter_value(
            parameters,
            "embedding.model",
            "embeddings.model",
        ),
        chunking_strategy=parameter_value(
            parameters,
            "chunking.strategy",
        ),
        chunk_size=parameter_value(
            parameters,
            "chunking.chunk_size",
            "chunking.size",
        ),
        chunk_overlap=parameter_value(
            parameters,
            "chunking.chunk_overlap",
            "chunking.overlap",
        ),
        retrieval_strategy=parameter_value(
            parameters,
            "retrieval.strategy",
        ),
        retrieval_top_k=parameter_value(
            parameters,
            "retrieval.top_k",
        ),
    )


def artifact_to_response(
    artifact: FileInfo,
) -> MlflowArtifactResponse:
    file_size = getattr(
        artifact,
        "file_size",
        None,
    )

    return MlflowArtifactResponse(
        path=artifact.path,
        is_dir=artifact.is_dir,
        file_size=(
            int(file_size)
            if file_size is not None
            else None
        ),
    )


def list_artifacts_recursively(
    client: MlflowClient,
    mlflow_run_id: str,
    path: str | None = None,
) -> list[MlflowArtifactResponse]:
    found_artifacts: list[
        MlflowArtifactResponse
    ] = []

    pending_paths: list[str | None] = [
        path,
    ]

    while pending_paths:
        current_path = pending_paths.pop()

        artifacts = client.list_artifacts(
            run_id=mlflow_run_id,
            path=current_path,
        )

        for artifact in artifacts:
            found_artifacts.append(
                artifact_to_response(
                    artifact
                )
            )

            if artifact.is_dir:
                pending_paths.append(
                    artifact.path
                )

    return sorted(
        found_artifacts,
        key=lambda item: (
            item.path.lower(),
            item.is_dir,
        ),
    )


def get_results_synchronously(
    run: ExperimentRun,
) -> ExperimentRunResultsResponse:
    if run.mlflow_run_id is None:
        raise ValueError(
            "La ejecución no tiene un identificador "
            "de MLflow asociado."
        )

    if run.experiment_version is None:
        raise ValueError(
            "No se pudo cargar la versión "
            "del experimento."
        )

    version = run.experiment_version
    experiment = version.experiment

    if experiment is None:
        raise ValueError(
            "No se pudo cargar el experimento "
            "asociado."
        )

    client = MlflowClient(
        tracking_uri=settings.mlflow_tracking_uri,
    )

    mlflow_run = client.get_run(
        run.mlflow_run_id
    )

    raw_metrics = {
        key: float(value)
        for key, value
        in mlflow_run.data.metrics.items()
    }

    parameters = {
        str(key): str(value)
        for key, value
        in mlflow_run.data.params.items()
    }

    tags = {
        str(key): str(value)
        for key, value
        in mlflow_run.data.tags.items()
    }

    artifacts = list_artifacts_recursively(
        client=client,
        mlflow_run_id=run.mlflow_run_id,
    )

    return ExperimentRunResultsResponse(
        run=run,
        experiment_id=experiment.id,
        experiment_name=experiment.name,
        experiment_version=(
            version.version_number
        ),
        configuration_hash=(
            version.configuration_hash
        ),
        mlflow_run_id=run.mlflow_run_id,
        mlflow_experiment_id=(
            mlflow_run.info.experiment_id
        ),
        mlflow_status=str(
            mlflow_run.info.status
        ),
        mlflow_start_time=(
            milliseconds_to_datetime(
                mlflow_run.info.start_time
            )
        ),
        mlflow_end_time=(
            milliseconds_to_datetime(
                mlflow_run.info.end_time
            )
        ),
        artifact_uri=(
            mlflow_run.info.artifact_uri
        ),
        metrics=build_normalized_metrics(
            raw_metrics
        ),
        configuration=build_configuration(
            parameters
        ),
        raw_metrics=raw_metrics,
        parameters=parameters,
        tags=tags,
        artifacts=artifacts,
    )


def get_artifacts_synchronously(
    run: ExperimentRun,
) -> ExperimentRunArtifactsResponse:
    if run.mlflow_run_id is None:
        raise ValueError(
            "La ejecución no tiene un identificador "
            "de MLflow asociado."
        )

    client = MlflowClient(
        tracking_uri=settings.mlflow_tracking_uri,
    )

    mlflow_run = client.get_run(
        run.mlflow_run_id
    )

    artifacts = list_artifacts_recursively(
        client=client,
        mlflow_run_id=run.mlflow_run_id,
    )

    return ExperimentRunArtifactsResponse(
        run_id=run.id,
        mlflow_run_id=run.mlflow_run_id,
        artifact_uri=(
            mlflow_run.info.artifact_uri
        ),
        artifacts=artifacts,
    )


async def get_experiment_run_results(
    run: ExperimentRun,
) -> ExperimentRunResultsResponse:
    return await asyncio.to_thread(
        get_results_synchronously,
        run,
    )


async def get_experiment_run_artifacts(
    run: ExperimentRun,
) -> ExperimentRunArtifactsResponse:
    return await asyncio.to_thread(
        get_artifacts_synchronously,
        run,
    )
