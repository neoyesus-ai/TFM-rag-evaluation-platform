import json
import statistics
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import mlflow
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.experiment.chunking import TextChunk, create_chunks
from app.experiment.document_loader import load_text_document
from app.models.document import Document
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


async def load_corpus_documents(
    session: AsyncSession,
    corpus_id: Any,
) -> list[Document]:
    result = await session.execute(
        select(Document)
        .where(Document.corpus_id == corpus_id)
        .order_by(Document.created_at.asc())
    )

    return list(result.scalars().all())


def serialize_chunks(chunks: list[TextChunk]) -> str:
    return "\n".join(
        json.dumps(
            {
                "chunk_id": chunk.chunk_id,
                "document_id": chunk.document_id,
                "filename": chunk.filename,
                "position": chunk.position,
                "character_count": chunk.character_count,
                "text": chunk.text,
            },
            ensure_ascii=False,
        )
        for chunk in chunks
    )


def build_chunking_summary(
    documents: list[Document],
    chunks: list[TextChunk],
    character_count: int,
    duration_ms: int,
) -> dict[str, Any]:
    chunk_sizes = [
        chunk.character_count
        for chunk in chunks
    ]

    return {
        "document_count": len(documents),
        "character_count": character_count,
        "chunk_count": len(chunks),
        "mean_chunk_size": (
            statistics.mean(chunk_sizes)
            if chunk_sizes
            else 0
        ),
        "min_chunk_size": min(chunk_sizes) if chunk_sizes else 0,
        "max_chunk_size": max(chunk_sizes) if chunk_sizes else 0,
        "chunking_duration_ms": duration_ms,
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

            documents = await load_corpus_documents(
                session=session,
                corpus_id=experiment.corpus_id,
            )

            if not documents:
                raise ValueError(
                    "El corpus no contiene documentos."
                )

            chunking_configuration = (
                version.configuration["chunking"]
            )

            chunking_started = time.perf_counter()

            chunks: list[TextChunk] = []
            documents_manifest: list[dict[str, Any]] = []
            total_character_count = 0

            for document in documents:
                loaded_document = load_text_document(document)

                total_character_count += len(
                    loaded_document.text
                )

                document_chunks = create_chunks(
                    text=loaded_document.text,
                    document_id=loaded_document.document_id,
                    filename=loaded_document.filename,
                    strategy=chunking_configuration["strategy"],
                    chunk_size=chunking_configuration["chunk_size"],
                    chunk_overlap=chunking_configuration[
                        "chunk_overlap"
                    ],
                )

                chunks.extend(document_chunks)

                documents_manifest.append(
                    {
                        "document_id": loaded_document.document_id,
                        "filename": loaded_document.filename,
                        "content_type": loaded_document.content_type,
                        "character_count": len(
                            loaded_document.text
                        ),
                        "chunk_count": len(document_chunks),
                    }
                )

            chunking_duration_ms = int(
                (
                    time.perf_counter()
                    - chunking_started
                )
                * 1000
            )

            summary = build_chunking_summary(
                documents=documents,
                chunks=chunks,
                character_count=total_character_count,
                duration_ms=chunking_duration_ms,
            )

            mlflow.log_metrics(
                {
                    "document_count": float(
                        summary["document_count"]
                    ),
                    "character_count": float(
                        summary["character_count"]
                    ),
                    "chunk_count": float(
                        summary["chunk_count"]
                    ),
                    "mean_chunk_size": float(
                        summary["mean_chunk_size"]
                    ),
                    "min_chunk_size": float(
                        summary["min_chunk_size"]
                    ),
                    "max_chunk_size": float(
                        summary["max_chunk_size"]
                    ),
                    "chunking_duration_ms": float(
                        summary["chunking_duration_ms"]
                    ),
                }
            )

            with tempfile.TemporaryDirectory() as temp_dir:
                temporary_directory = Path(temp_dir)

                configuration_directory = (
                    temporary_directory / "configuration"
                )
                input_directory = (
                    temporary_directory / "input"
                )
                processing_directory = (
                    temporary_directory / "processing"
                )

                configuration_directory.mkdir()
                input_directory.mkdir()
                processing_directory.mkdir()

                configuration_path = (
                    configuration_directory
                    / "resolved-configuration.json"
                )
                manifest_path = (
                    input_directory
                    / "documents-manifest.json"
                )
                chunks_path = (
                    processing_directory
                    / "chunks.jsonl"
                )
                summary_path = (
                    processing_directory
                    / "chunking-summary.json"
                )

                configuration_path.write_text(
                    json.dumps(
                        create_configuration_artifact(
                            experiment=experiment,
                            version=version,
                        ),
                        ensure_ascii=False,
                        indent=2,
                    ),
                    encoding="utf-8",
                )

                manifest_path.write_text(
                    json.dumps(
                        documents_manifest,
                        ensure_ascii=False,
                        indent=2,
                    ),
                    encoding="utf-8",
                )

                chunks_path.write_text(
                    serialize_chunks(chunks),
                    encoding="utf-8",
                )

                summary_path.write_text(
                    json.dumps(
                        summary,
                        ensure_ascii=False,
                        indent=2,
                    ),
                    encoding="utf-8",
                )

                mlflow.log_artifacts(
                    str(configuration_directory),
                    artifact_path="configuration",
                )
                mlflow.log_artifacts(
                    str(input_directory),
                    artifact_path="input",
                )
                mlflow.log_artifacts(
                    str(processing_directory),
                    artifact_path="processing",
                )

            elapsed_ms = int(
                (
                    time.perf_counter()
                    - started_monotonic
                )
                * 1000
            )

            mlflow.log_metric(
                key="runner_total_ms",
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
