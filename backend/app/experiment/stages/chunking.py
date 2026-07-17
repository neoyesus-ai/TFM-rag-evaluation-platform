import json
import statistics

from app.experiment.chunking import TextChunk, create_chunks
from app.experiment.context import ExperimentContext
from app.experiment.stages.base import ExperimentStage


class ChunkingStage(ExperimentStage):
    name = "chunking"

    async def execute(
        self,
        context: ExperimentContext,
    ) -> None:
        configuration = context.version.configuration[
            "chunking"
        ]

        chunks: list[TextChunk] = []
        manifest_by_document: dict[str, int] = {}

        for document in context.loaded_documents:
            document_chunks = create_chunks(
                text=document.text,
                document_id=document.document_id,
                filename=document.filename,
                strategy=configuration["strategy"],
                chunk_size=configuration["chunk_size"],
                chunk_overlap=configuration[
                    "chunk_overlap"
                ],
            )

            chunks.extend(document_chunks)
            manifest_by_document[
                document.document_id
            ] = len(document_chunks)

        if not chunks:
            raise ValueError(
                "El proceso de chunking no generó fragmentos."
            )

        processing_directory = (
            context.working_directory / "processing"
        )
        processing_directory.mkdir(
            parents=True,
            exist_ok=True,
        )

        chunks_path = (
            processing_directory / "chunks.jsonl"
        )

        chunks_path.write_text(
            "\n".join(
                json.dumps(
                    {
                        "chunk_id": chunk.chunk_id,
                        "document_id": chunk.document_id,
                        "filename": chunk.filename,
                        "position": chunk.position,
                        "character_count": (
                            chunk.character_count
                        ),
                        "text": chunk.text,
                    },
                    ensure_ascii=False,
                )
                for chunk in chunks
            ),
            encoding="utf-8",
        )

        chunk_sizes = [
            chunk.character_count
            for chunk in chunks
        ]

        summary = {
            "document_count": len(
                context.loaded_documents
            ),
            "chunk_count": len(chunks),
            "mean_chunk_size": statistics.mean(
                chunk_sizes
            ),
            "min_chunk_size": min(chunk_sizes),
            "max_chunk_size": max(chunk_sizes),
            "chunks_by_document": (
                manifest_by_document
            ),
            "configuration": configuration,
        }

        summary_path = (
            processing_directory
            / "chunking-summary.json"
        )

        summary_path.write_text(
            json.dumps(
                summary,
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        context.chunks = chunks
        context.artifacts[
            "processing"
        ] = processing_directory

        context.metrics["chunk_count"] = float(
            len(chunks)
        )
        context.metrics["mean_chunk_size"] = float(
            statistics.mean(chunk_sizes)
        )
        context.metrics["min_chunk_size"] = float(
            min(chunk_sizes)
        )
        context.metrics["max_chunk_size"] = float(
            max(chunk_sizes)
        )
