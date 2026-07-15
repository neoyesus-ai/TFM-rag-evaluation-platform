import json
import re
import time

from app.experiment.context import ExperimentContext
from app.experiment.stages.base import ExperimentStage
from app.providers.vector_store import (
    create_vector_store_provider,
)


def sanitize_collection_name(
    value: str,
) -> str:
    sanitized = re.sub(
        r"[^a-zA-Z0-9_-]",
        "_",
        value,
    )

    sanitized = sanitized.strip("_")

    if len(sanitized) < 3:
        sanitized = f"run_{sanitized}"

    return sanitized[:63]


class IndexingStage(ExperimentStage):
    name = "indexing"

    async def execute(
        self,
        context: ExperimentContext,
    ) -> None:
        if not context.chunks:
            raise ValueError(
                "No existen chunks para indexar."
            )

        if not context.embeddings:
            raise ValueError(
                "No existen embeddings para indexar."
            )

        if len(context.chunks) != len(
            context.embeddings
        ):
            raise ValueError(
                "El número de chunks y embeddings no coincide."
            )

        collection_name = sanitize_collection_name(
            f"run_{context.run.mlflow_run_id or context.run.id}"
        )

        provider = create_vector_store_provider(
            provider="chroma"
        )

        indexing_started = time.perf_counter()

        collection = provider.create_collection(
            collection_name=collection_name,
            metadata={
                "experiment_id": str(
                    context.experiment.id
                ),
                "experiment_version_id": str(
                    context.version.id
                ),
                "experiment_run_id": str(
                    context.run.id
                ),
                "mlflow_run_id": (
                    context.run.mlflow_run_id or ""
                ),
                "configuration_hash": (
                    context.version.configuration_hash
                ),
            },
        )

        ids = [
            chunk.chunk_id
            for chunk in context.chunks
        ]

        documents = [
            chunk.text
            for chunk in context.chunks
        ]

        metadatas = [
            {
                "document_id": chunk.document_id,
                "filename": chunk.filename,
                "position": chunk.position,
                "character_count": (
                    chunk.character_count
                ),
                "experiment_id": str(
                    context.experiment.id
                ),
                "experiment_version_id": str(
                    context.version.id
                ),
                "experiment_run_id": str(
                    context.run.id
                ),
            }
            for chunk in context.chunks
        ]

        provider.add(
            collection=collection,
            ids=ids,
            documents=documents,
            embeddings=context.embeddings,
            metadatas=metadatas,
        )

        indexed_count = collection.count()

        indexing_duration_ms = int(
            (
                time.perf_counter()
                - indexing_started
            )
            * 1000
        )

        if indexed_count != len(context.chunks):
            raise RuntimeError(
                "Chroma no indexó todos los chunks."
            )

        indexing_directory = (
            context.working_directory / "indexing"
        )

        indexing_directory.mkdir(
            parents=True,
            exist_ok=True,
        )

        manifest_path = (
            indexing_directory
            / "index-manifest.json"
        )

        manifest = {
            "provider": "chroma",
            "collection_name": collection_name,
            "indexed_chunk_count": indexed_count,
            "embedding_dimension": len(
                context.embeddings[0]
            ),
            "indexing_duration_ms": (
                indexing_duration_ms
            ),
            "experiment_id": str(
                context.experiment.id
            ),
            "experiment_version_id": str(
                context.version.id
            ),
            "experiment_run_id": str(
                context.run.id
            ),
            "mlflow_run_id": (
                context.run.mlflow_run_id
            ),
        }

        manifest_path.write_text(
            json.dumps(
                manifest,
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        context.vector_collection_name = (
            collection_name
        )

        context.metadata[
            "vector_store_provider"
        ] = "chroma"

        context.metadata[
            "vector_collection_name"
        ] = collection_name

        context.artifacts[
            "indexing"
        ] = indexing_directory

        context.metrics[
            "indexed_chunk_count"
        ] = float(indexed_count)

        context.metrics[
            "indexing_duration_ms"
        ] = float(indexing_duration_ms)
