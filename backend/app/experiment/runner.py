import asyncio
import json
import logging
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import mlflow
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.service import (
    persist_experiment_analytics,
)
from app.core.config import settings
from app.experiment.context import ExperimentContext
from app.experiment.stages import (
    ChunkingStage,
    EmbeddingStage,
    EvaluationStage,
    ExperimentStage,
    GenerationStage,
    IndexingStage,
    LoadDocumentsStage,
    RetrievalStage,
)
from app.models.experiment import (
    Experiment,
    ExperimentRun,
    ExperimentVersion,
)


logger = logging.getLogger(__name__)


# La API fluida de MLflow mantiene la ejecución activa asociada al
# proceso/hilo. Varias tareas asíncronas de FastAPI pueden compartir ese
# estado y provocar el error "Run ... is already active". Este bloqueo
# serializa la sección completa de seguimiento de cada experimento.
_MLFLOW_RUN_LOCK = asyncio.Lock()


def flatten_configuration(
    source: dict[str, Any],
    prefix: str = "",
) -> dict[str, str | int | float | bool]:
    flattened: dict[
        str,
        str | int | float | bool,
    ] = {}

    for key, value in source.items():
        full_key = (
            f"{prefix}.{key}"
            if prefix
            else key
        )

        if isinstance(value, dict):
            flattened.update(
                flatten_configuration(
                    source=value,
                    prefix=full_key,
                )
            )
        elif isinstance(value, list):
            flattened[full_key] = json.dumps(
                value,
                ensure_ascii=False,
            )
        elif value is not None:
            flattened[full_key] = value

    return flattened


def create_configuration_artifact(
    context: ExperimentContext,
) -> Path:
    directory = (
        context.working_directory
        / "configuration"
    )

    directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    path = (
        directory
        / "resolved-configuration.json"
    )

    payload = {
        "experiment": {
            "id": str(
                context.experiment.id
            ),
            "name": (
                context.experiment.name
            ),
            "description": (
                context.experiment.description
            ),
            "corpus_id": str(
                context.experiment.corpus_id
            ),
            "dataset_id": (
                str(
                    context.experiment.dataset_id
                )
                if context.experiment.dataset_id
                else None
            ),
        },
        "version": {
            "id": str(
                context.version.id
            ),
            "number": (
                context.version.version_number
            ),
            "schema_version": (
                context.version.schema_version
            ),
            "configuration_hash": (
                context.version.configuration_hash
            ),
            "source_template_key": (
                context.version.source_template_key
            ),
            "git_commit": (
                context.version.git_commit
            ),
        },
        "configuration": (
            context.version.configuration
        ),
    }

    path.write_text(
        json.dumps(
            payload,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    context.artifacts[
        "configuration"
    ] = directory

    return path


def build_pipeline(
    session: AsyncSession,
) -> list[ExperimentStage]:
    return [
        LoadDocumentsStage(
            session=session,
        ),
        ChunkingStage(),
        EmbeddingStage(),
        IndexingStage(),
        RetrievalStage(
            session=session,
        ),
        GenerationStage(),
        EvaluationStage(),
    ]


async def execute_pipeline(
    context: ExperimentContext,
    pipeline: list[ExperimentStage],
) -> None:
    completed_stages: list[
        dict[str, Any]
    ] = []

    for stage in pipeline:
        result = await stage.run(
            context
        )

        completed_stages.append(
            {
                "name": result.name,
                "duration_ms": (
                    result.duration_ms
                ),
            }
        )

    context.metadata[
        "completed_stages"
    ] = completed_stages


def create_pipeline_manifest(
    context: ExperimentContext,
) -> Path:
    directory = (
        context.working_directory
        / "pipeline"
    )

    directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    path = (
        directory
        / "pipeline-manifest.json"
    )

    payload = {
        "experiment_id": str(
            context.experiment.id
        ),
        "experiment_version_id": str(
            context.version.id
        ),
        "run_id": str(
            context.run.id
        ),
        "mlflow_run_id": (
            context.run.mlflow_run_id
        ),
        "completed_stages": (
            context.metadata.get(
                "completed_stages",
                [],
            )
        ),
        "metrics": (
            context.metrics
        ),
        "metadata": (
            context.metadata
        ),
        "artifacts": {
            key: str(value)
            for key, value
            in context.artifacts.items()
        },
    }

    path.write_text(
        json.dumps(
            payload,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    context.artifacts[
        "pipeline"
    ] = directory

    return path


def log_context_to_mlflow(
    context: ExperimentContext,
) -> None:
    if context.metrics:
        mlflow.log_metrics(
            context.metrics
        )

    for artifact_path, directory in (
        context.artifacts.items()
    ):
        mlflow.log_artifacts(
            local_dir=str(directory),
            artifact_path=artifact_path,
        )


async def persist_analytics_safely(
    session: AsyncSession,
    context: ExperimentContext,
) -> None:
    """
    Persistir Analytics sin invalidar una ejecución RAG correcta.

    La ejecución principal ya debe estar confirmada en PostgreSQL antes
    de llamar a esta función. Si la capa analítica falla, se revierte
    únicamente su transacción y se conserva el run completado.
    """

    try:
        await persist_experiment_analytics(
            session=session,
            context=context,
        )

        await session.commit()

        logger.info(
            "Analytics persistido para el run %s.",
            context.run.id,
        )
    except Exception:
        await session.rollback()

        logger.exception(
            "No se pudo persistir Analytics "
            "para el run %s.",
            context.run.id,
        )


async def execute_experiment_run(
    session: AsyncSession,
    experiment: Experiment,
    version: ExperimentVersion,
    run: ExperimentRun,
) -> ExperimentRun:
    started_monotonic = (
        time.perf_counter()
    )

    completed_context: (
        ExperimentContext | None
    ) = None

    run.status = "running"
    run.started_at = datetime.now(
        timezone.utc
    )
    run.finished_at = None
    run.duration_ms = None
    run.error_message = None

    await session.commit()
    await session.refresh(run)

    try:
        async with _MLFLOW_RUN_LOCK:
            # Con el bloqueo adquirido no puede existir otra ejecución
            # legítima iniciada por este runner. Si MLflow conserva una
            # ejecución activa, se considera residual y se cierra antes
            # de iniciar la nueva.
            stale_run = mlflow.active_run()

            if stale_run is not None:
                logger.warning(
                    "Cerrando la ejecución residual de MLflow %s "
                    "antes de iniciar el run %s.",
                    stale_run.info.run_id,
                    run.id,
                )
                mlflow.end_run(status="KILLED")

            try:
                mlflow.set_tracking_uri(
                    settings.mlflow_tracking_uri
                )

                mlflow.set_experiment(
                    settings.mlflow_experiment_name
                )

                tags = {
                    "project": (
                        "TFM-rag-evaluation-platform"
                    ),
                    "run_type": "experiment",
                    "environment": (
                        settings.environment
                    ),
                    "experiment_id": str(
                        experiment.id
                    ),
                    "experiment_version_id": str(
                        version.id
                    ),
                    "experiment_version": str(
                        version.version_number
                    ),
                    "configuration_hash": (
                        version.configuration_hash
                    ),
                    "source_template_key": (
                        version.source_template_key
                        or ""
                    ),
                    "git_commit": (
                        version.git_commit
                        or ""
                    ),
                    "dataset_id": (
                        str(experiment.dataset_id)
                        if experiment.dataset_id
                        else ""
                    ),
                }

                run_name = (
                    f"{experiment.name}"
                    f"-v{version.version_number}"
                )

                with mlflow.start_run(
                    run_name=run_name,
                    tags=tags,
                ) as active_mlflow_run:
                    run.mlflow_run_id = (
                        active_mlflow_run.info.run_id
                    )

                    await session.commit()
                    await session.refresh(run)

                    parameters = (
                        flatten_configuration(
                            version.configuration
                        )
                    )

                    if parameters:
                        mlflow.log_params(
                            parameters
                        )

                    with tempfile.TemporaryDirectory() as temp:
                        context = ExperimentContext(
                            experiment=experiment,
                            version=version,
                            run=run,
                            working_directory=Path(
                                temp
                            ),
                        )

                        create_configuration_artifact(
                            context
                        )

                        pipeline = build_pipeline(
                            session=session
                        )

                        await execute_pipeline(
                            context=context,
                            pipeline=pipeline,
                        )

                        context.metrics[
                            "runner_total_ms"
                        ] = float(
                            int(
                                (
                                    time.perf_counter()
                                    - started_monotonic
                                )
                                * 1000
                            )
                        )

                        create_pipeline_manifest(
                            context
                        )

                        log_context_to_mlflow(
                            context
                        )

                        completed_context = context
            finally:
                # El context manager de MLflow debe cerrar la ejecución.
                # Esta defensa evita que una excepción inesperada deje el
                # estado global contaminado para la siguiente solicitud.
                remaining_run = mlflow.active_run()

                if remaining_run is not None:
                    logger.warning(
                        "Cerrando la ejecución de MLflow %s que permanecía "
                        "activa al finalizar el run %s.",
                        remaining_run.info.run_id,
                        run.id,
                    )
                    mlflow.end_run(status="KILLED")

        run.status = "completed"
        run.finished_at = datetime.now(
            timezone.utc
        )
        run.duration_ms = int(
            (
                time.perf_counter()
                - started_monotonic
            )
            * 1000
        )
        run.error_message = None

        await session.commit()
        await session.refresh(run)

    except Exception as exc:
        await session.rollback()

        run.status = "failed"
        run.finished_at = datetime.now(
            timezone.utc
        )
        run.duration_ms = int(
            (
                time.perf_counter()
                - started_monotonic
            )
            * 1000
        )
        run.error_message = (
            f"{type(exc).__name__}: {exc}"
        )[:4000]

        await session.commit()
        await session.refresh(run)

        logger.exception(
            "La ejecución experimental %s "
            "ha finalizado con error.",
            run.id,
        )

        return run

    if completed_context is not None:
        await persist_analytics_safely(
            session=session,
            context=completed_context,
        )

        await session.refresh(run)

    return run