import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ExperimentRunResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: uuid.UUID
    experiment_version_id: uuid.UUID
    mlflow_run_id: str | None
    status: str
    started_at: datetime | None
    finished_at: datetime | None
    duration_ms: int | None
    error_message: str | None
    created_at: datetime


class MlflowArtifactResponse(BaseModel):
    path: str
    is_dir: bool
    file_size: int | None = None


class ExperimentRunMetricsResponse(BaseModel):
    overall_score: float | None = None
    groundedness: float | None = None
    answer_token_f1: float | None = None
    answer_token_precision: float | None = None
    answer_token_recall: float | None = None
    answer_relevancy: float | None = None

    context_precision: float | None = None
    context_recall: float | None = None

    retrieval_mean_similarity: float | None = None
    retrieval_min_similarity: float | None = None
    retrieval_max_similarity: float | None = None
    retrieval_duration_ms: float | None = None
    retrieval_mean_question_latency_ms: float | None = None

    generation_duration_ms: float | None = None
    generation_mean_latency_ms: float | None = None
    generation_min_latency_ms: float | None = None
    generation_max_latency_ms: float | None = None

    prompt_tokens: float | None = None
    completion_tokens: float | None = None
    total_tokens: float | None = None
    completion_tokens_per_second: float | None = None

    document_count: float | None = None
    chunk_count: float | None = None
    embedding_count: float | None = None
    indexed_chunk_count: float | None = None
    question_count: float | None = None

    runner_total_ms: float | None = None


class ExperimentRunConfigurationResponse(BaseModel):
    generation_provider: str | None = None
    generation_model: str | None = None
    generation_temperature: str | None = None

    embedding_provider: str | None = None
    embedding_model: str | None = None

    chunking_strategy: str | None = None
    chunk_size: str | None = None
    chunk_overlap: str | None = None

    retrieval_strategy: str | None = None
    retrieval_top_k: str | None = None


class ExperimentRunResultsResponse(BaseModel):
    run: ExperimentRunResponse

    experiment_id: uuid.UUID
    experiment_name: str
    experiment_version: int
    configuration_hash: str

    mlflow_run_id: str
    mlflow_experiment_id: str
    mlflow_status: str
    mlflow_start_time: datetime | None
    mlflow_end_time: datetime | None
    artifact_uri: str | None

    metrics: ExperimentRunMetricsResponse
    configuration: ExperimentRunConfigurationResponse

    raw_metrics: dict[str, float] = Field(
        default_factory=dict,
    )

    parameters: dict[str, str] = Field(
        default_factory=dict,
    )

    tags: dict[str, str] = Field(
        default_factory=dict,
    )

    artifacts: list[MlflowArtifactResponse] = Field(
        default_factory=list,
    )


class ExperimentRunArtifactsResponse(BaseModel):
    run_id: uuid.UUID
    mlflow_run_id: str
    artifact_uri: str | None
    artifacts: list[MlflowArtifactResponse] = Field(
        default_factory=list,
    )


class ExperimentRunResultsErrorResponse(BaseModel):
    detail: str
    context: dict[str, Any] = Field(
        default_factory=dict,
    )
