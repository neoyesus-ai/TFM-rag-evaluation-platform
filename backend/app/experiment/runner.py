import json
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import mlflow
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.experiment import (
    Experiment,
    ExperimentRun,
    ExperimentVersion,
)


def flatten_configuration(
    source: dict[str, Any],
    prefix: str = "",
) -> dict[str, str | int | float | bool]:
    flattened: dict[str, str | int | float | bool] = {}

    for key, value in source.items():
        full_key = f"{prefix}.{key}" if prefix else key

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
    experiment: Experiment,
    version: ExperimentVersion,
) -> dict[str, Any]:
    return {
        "experiment": {
            "id": str(experiment.id),
            "name": experiment.name,
            "description": experiment.description,
            "corpus_id": str(experiment.corpus_id),
        },
        "version": {
            "id": str(version.id),
            "number": version.version_number,
            "schema_version": version.schema_version,
            "configuration_hash": version.configuration_hash,
            "source_template_key": version.source_template_key,
            "git_commit": version.git_commit,
        },
        "configuration": version.configuration,
    }


async def execute_experiment_run(
    session: AsyncSession,
    experiment: Experiment,
    version: ExperimentVersion,
    run: ExperimentRun,
) -> ExperimentRun:
    started_monotonic = time.perf_counter()

    run.status = "running"
    run.started_at = datetime.now(timezone.utc)
    run.finished_at = None
    run.duration_ms = None
    run.error_message = None

    await session.commit()
    await session.refresh(run)

    try:
        mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
        mlflow.set_experiment(settings.mlflow_experiment_name)

        tags = {
            "project": "TFM-rag-evaluation-platform",
            "run_type": "experiment",
            "environment": settings.environment,
            "experiment_id": str(experiment.id),
            "experiment_version_id": str(version.id),
            "experiment_version": str(version.version_number),
            "configuration_hash": version.configuration_hash,
            "source_template_key": (
                version.source_template_key or ""
            ),
            "git_commit": version.git_commit or "",
        }

        run_name = (
            f"{experiment.name}-v{version.version_number}"
        )

        with mlflow.start_run(
            run_name=run_name,
            tags=tags,
        ) as active_mlflow_run:
            run.mlflow_run_id = active_mlflow_run.info.run_id

            await session.commit()
            await session.refresh(run)

            parameters = flatten_configuration(
                version.configuration
            )

            mlflow.log_params(parameters)

            with tempfile.TemporaryDirectory() as temp_dir:
                temporary_directory = Path(temp_dir)

                configuration_path = (
                    temporary_directory
                    / "resolved-configuration.json"
                )

                artifact = create_configuration_artifact(
                    experiment=experiment,
                    version=version,
                )

                configuration_path.write_text(
                    json.dumps(
                        artifact,
                        ensure_ascii=False,
                        indent=2,
                    ),
                    encoding="utf-8",
                )

                mlflow.log_artifact(
                    local_path=str(configuration_path),
                    artifact_path="configuration",
                )

            elapsed_ms = int(
                (
                    time.perf_counter()
                    - started_monotonic
                )
                * 1000
            )

            mlflow.log_metric(
                key="runner_initialization_ms",
                value=elapsed_ms,
            )

        run.status = "completed"
        run.finished_at = datetime.now(timezone.utc)
        run.duration_ms = int(
            (
                time.perf_counter()
                - started_monotonic
            )
            * 1000
        )
        run.error_message = None

    except Exception as exc:
        run.status = "failed"
        run.finished_at = datetime.now(timezone.utc)
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

    return run
