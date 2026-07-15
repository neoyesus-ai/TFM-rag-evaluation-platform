import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        unique=True,
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    corpus_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "corpora.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    dataset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "evaluation_datasets.id",
            ondelete="RESTRICT",
        ),
        nullable=True,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="draft",
        server_default="draft",
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

    versions = relationship(
        "ExperimentVersion",
        back_populates="experiment",
        cascade="all, delete-orphan",
        order_by="ExperimentVersion.version_number",
    )


class ExperimentVersion(Base):
    __tablename__ = "experiment_versions"
    __table_args__ = (
        UniqueConstraint(
            "experiment_id",
            "version_number",
            name="uq_experiment_version",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
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

    version_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    schema_version: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="1.0",
        server_default="1.0",
    )

    configuration: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
    )

    configuration_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )

    source_template_key: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    git_commit: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    experiment = relationship(
        "Experiment",
        back_populates="versions",
    )

    runs = relationship(
        "ExperimentRun",
        back_populates="experiment_version",
        cascade="all, delete-orphan",
    )


class ExperimentRun(Base):
    __tablename__ = "experiment_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
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

    mlflow_run_id: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        unique=True,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending",
        server_default="pending",
    )

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    duration_ms: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    experiment_version = relationship(
        "ExperimentVersion",
        back_populates="runs",
    )
