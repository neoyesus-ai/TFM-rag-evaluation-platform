from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.experiment.chunking import TextChunk
from app.experiment.document_loader import LoadedDocument
from app.models.dataset import EvaluationQuestion
from app.models.document import Document
from app.models.experiment import (
    Experiment,
    ExperimentRun,
    ExperimentVersion,
)


@dataclass
class ExperimentContext:
    experiment: Experiment
    version: ExperimentVersion
    run: ExperimentRun
    working_directory: Path

    document_records: list[Document] = field(
        default_factory=list,
    )

    loaded_documents: list[LoadedDocument] = field(
        default_factory=list,
    )

    chunks: list[TextChunk] = field(
        default_factory=list,
    )

    embeddings: list[list[float]] = field(
        default_factory=list,
    )

    evaluation_questions: list[EvaluationQuestion] = field(
        default_factory=list,
    )

    retrieval_results: list[dict[str, Any]] = field(
        default_factory=list,
    )

    vector_collection_name: str | None = None

    metrics: dict[str, float] = field(
        default_factory=dict,
    )

    artifacts: dict[str, Path] = field(
        default_factory=dict,
    )

    metadata: dict[str, Any] = field(
        default_factory=dict,
    )
