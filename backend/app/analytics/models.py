import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ExperimentRunSummary(Base):
    """
    Resumen analítico de una ejecución.

    Contiene las métricas y parámetros más consultados por dashboards,
    comparadores, leaderboards, recomendaciones y Metabase.
    """

    __tablename__ = "experiment_run_summaries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "experiment_runs.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        unique=True,
        index=True,
    )

    experiment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "experiments.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    experiment_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "experiment_versions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    dataset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "evaluation_datasets.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    mlflow_run_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        unique=True,
        index=True,
    )

    experiment_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    experiment_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    configuration_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )

    overall_score: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        index=True,
    )

    groundedness: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    answer_f1: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    context_precision: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    context_recall: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    retrieval_mean_similarity: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    generation_mean_latency_ms: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    runner_total_ms: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    prompt_tokens: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    completion_tokens: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    total_tokens: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    tokens_per_second: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    generation_provider: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    generation_model: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        index=True,
    )

    embedding_provider: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    embedding_model: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        index=True,
    )

    chunking_strategy: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    chunk_size: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        index=True,
    )

    chunk_overlap: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    retrieval_strategy: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    retrieval_top_k: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        index=True,
    )

    recommendation_score: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        index=True,
    )

    run_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    run_finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ExperimentRunMetric(Base):
    """
    Métrica dinámica asociada a una ejecución.

    Permite registrar métricas nuevas sin modificar el esquema SQL.
    """

    __tablename__ = "experiment_run_metrics"
    __table_args__ = (
        UniqueConstraint(
            "run_id",
            "metric_name",
            name="uq_experiment_run_metric",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "experiment_runs.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    metric_name: Mapped[str] = mapped_column(
        String(250),
        nullable=False,
        index=True,
    )

    metric_value: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    metric_group: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    metric_unit: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ExperimentRunParameter(Base):
    """
    Parámetro dinámico utilizado por una ejecución.
    """

    __tablename__ = "experiment_run_parameters"
    __table_args__ = (
        UniqueConstraint(
            "run_id",
            "parameter_name",
            name="uq_experiment_run_parameter",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "experiment_runs.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    parameter_name: Mapped[str] = mapped_column(
        String(250),
        nullable=False,
        index=True,
    )

    parameter_value: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    parameter_group: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class ExperimentRunStageMetric(Base):
    """
    Duración de una etapa concreta del pipeline RAG.
    """

    __tablename__ = "experiment_run_stage_metrics"
    __table_args__ = (
        UniqueConstraint(
            "run_id",
            "stage_name",
            name="uq_experiment_run_stage_metric",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "experiment_runs.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    stage_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    duration_ms: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
