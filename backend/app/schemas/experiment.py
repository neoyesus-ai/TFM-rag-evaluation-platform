import uuid
from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)


class ChunkingConfiguration(BaseModel):
    strategy: Literal[
        "recursive",
        "fixed",
        "semantic",
    ] = "recursive"

    chunk_size: int = Field(
        default=512,
        ge=64,
        le=4096,
    )

    chunk_overlap: int = Field(
        default=64,
        ge=0,
        le=1024,
    )

    @model_validator(mode="after")
    def validate_overlap(
        self,
    ) -> "ChunkingConfiguration":
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError(
                "chunk_overlap debe ser menor que chunk_size."
            )

        return self


class EmbeddingConfiguration(BaseModel):
    provider: Literal["ollama"] = "ollama"

    model: str = Field(
        default="nomic-embed-text",
        min_length=1,
    )


class RetrievalConfiguration(BaseModel):
    strategy: Literal[
        "similarity",
        "mmr",
    ] = "similarity"

    top_k: int = Field(
        default=5,
        ge=1,
        le=50,
    )


class GenerationConfiguration(BaseModel):
    provider: Literal["ollama"] = "ollama"

    model: str = Field(
        default="llama3.1",
        min_length=1,
    )

    temperature: float = Field(
        default=0.0,
        ge=0.0,
        le=2.0,
    )


class EvaluationConfiguration(BaseModel):
    metrics: list[
        Literal[
            "faithfulness",
            "answer_relevancy",
            "context_precision",
            "context_recall",
            "latency_ms",
        ]
    ] = Field(
        default_factory=lambda: [
            "faithfulness",
            "answer_relevancy",
            "context_precision",
            "context_recall",
            "latency_ms",
        ]
    )


class PipelineConfiguration(BaseModel):
    schema_version: str = "1.0"

    chunking: ChunkingConfiguration = Field(
        default_factory=ChunkingConfiguration,
    )

    embedding: EmbeddingConfiguration = Field(
        default_factory=EmbeddingConfiguration,
    )

    retrieval: RetrievalConfiguration = Field(
        default_factory=RetrievalConfiguration,
    )

    generation: GenerationConfiguration = Field(
        default_factory=GenerationConfiguration,
    )

    evaluation: EvaluationConfiguration = Field(
        default_factory=EvaluationConfiguration,
    )


class ExperimentCreate(BaseModel):
    name: str = Field(
        min_length=3,
        max_length=200,
    )

    description: str | None = Field(
        default=None,
        max_length=4000,
    )

    corpus_id: uuid.UUID
    dataset_id: uuid.UUID | None = None

    configuration: PipelineConfiguration

    source_template_key: str | None = None

    git_commit: str | None = Field(
        default=None,
        max_length=64,
    )


class ExperimentVersionCreate(BaseModel):
    configuration: PipelineConfiguration
    source_template_key: str | None = None

    git_commit: str | None = Field(
        default=None,
        max_length=64,
    )


class ExperimentDatasetUpdate(BaseModel):
    dataset_id: uuid.UUID


class ExperimentVersionResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: uuid.UUID
    experiment_id: uuid.UUID
    version_number: int
    schema_version: str
    configuration: dict
    configuration_hash: str
    source_template_key: str | None
    git_commit: str | None
    created_at: datetime


class ExperimentResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: uuid.UUID
    name: str
    description: str | None
    corpus_id: uuid.UUID
    dataset_id: uuid.UUID | None
    status: str
    created_at: datetime
    updated_at: datetime


class ExperimentDetailResponse(
    ExperimentResponse
):
    versions: list[ExperimentVersionResponse]
