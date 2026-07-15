import json
import time

import numpy as np

from app.experiment.context import ExperimentContext
from app.experiment.stages.base import ExperimentStage
from app.providers.embeddings import (
    create_embedding_provider,
)


class EmbeddingStage(ExperimentStage):
    name = "embeddings"

    async def execute(
        self,
        context: ExperimentContext,
    ) -> None:
        if not context.chunks:
            raise ValueError(
                "No existen chunks para generar embeddings."
            )

        configuration = context.version.configuration[
            "embedding"
        ]

        provider_name = configuration["provider"]
        model_name = configuration["model"]

        provider = create_embedding_provider(
            provider=provider_name,
            model=model_name,
        )

        texts = [
            chunk.text
            for chunk in context.chunks
        ]

        embedding_started = time.perf_counter()

        embeddings = await provider.embed_documents(
            texts
        )

        embedding_duration_ms = int(
            (
                time.perf_counter()
                - embedding_started
            )
            * 1000
        )

        if not embeddings:
            raise RuntimeError(
                "No se generaron embeddings."
            )

        if len(embeddings) != len(context.chunks):
            raise RuntimeError(
                "El número de embeddings no coincide "
                "con el número de chunks."
            )

        dimensions = {
            len(embedding)
            for embedding in embeddings
        }

        if len(dimensions) != 1:
            raise RuntimeError(
                "Los embeddings tienen dimensiones diferentes."
            )

        embedding_dimension = dimensions.pop()

        vectors = np.asarray(
            embeddings,
            dtype=np.float32,
        )

        embeddings_directory = (
            context.working_directory / "embeddings"
        )
        embeddings_directory.mkdir(
            parents=True,
            exist_ok=True,
        )

        vectors_path = (
            embeddings_directory / "embeddings.npy"
        )

        metadata_path = (
            embeddings_directory
            / "embeddings-metadata.json"
        )

        np.save(
            vectors_path,
            vectors,
            allow_pickle=False,
        )

        metadata = {
            "provider": provider_name,
            "model": model_name,
            "embedding_count": len(embeddings),
            "embedding_dimension": embedding_dimension,
            "dtype": str(vectors.dtype),
            "shape": list(vectors.shape),
            "duration_ms": embedding_duration_ms,
            "vectors_per_second": (
                len(embeddings)
                / (embedding_duration_ms / 1000)
                if embedding_duration_ms > 0
                else float(len(embeddings))
            ),
            "chunks": [
                {
                    "embedding_index": index,
                    "chunk_id": chunk.chunk_id,
                    "document_id": chunk.document_id,
                    "filename": chunk.filename,
                    "position": chunk.position,
                }
                for index, chunk in enumerate(
                    context.chunks
                )
            ],
        }

        metadata_path.write_text(
            json.dumps(
                metadata,
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        context.embeddings = embeddings
        context.metadata[
            "embedding_provider"
        ] = provider_name
        context.metadata[
            "embedding_model"
        ] = model_name
        context.metadata[
            "embedding_dimension"
        ] = embedding_dimension

        context.artifacts[
            "embeddings"
        ] = embeddings_directory

        context.metrics[
            "embedding_count"
        ] = float(len(embeddings))

        context.metrics[
            "embedding_dimension"
        ] = float(embedding_dimension)

        context.metrics[
            "embedding_duration_ms"
        ] = float(embedding_duration_ms)

        context.metrics[
            "embedding_vectors_per_second"
        ] = float(
            metadata["vectors_per_second"]
        )

        context.metrics[
            "embedding_artifact_size_bytes"
        ] = float(vectors_path.stat().st_size)
