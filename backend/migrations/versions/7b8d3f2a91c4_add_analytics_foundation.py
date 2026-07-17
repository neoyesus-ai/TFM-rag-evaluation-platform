"""add analytics foundation

Revision ID: 7b8d3f2a91c4
Revises: f4704ff1422c
Create Date: 2026-07-16
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "7b8d3f2a91c4"
down_revision: str | Sequence[str] | None = "f4704ff1422c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Crear las tablas de la capa analítica."""

    op.create_table(
        "experiment_run_summaries",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "run_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "experiment_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "experiment_version_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "dataset_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "mlflow_run_id",
            sa.String(length=64),
            nullable=False,
        ),
        sa.Column(
            "experiment_name",
            sa.String(length=200),
            nullable=False,
        ),
        sa.Column(
            "experiment_version",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "configuration_hash",
            sa.String(length=64),
            nullable=False,
        ),
        sa.Column(
            "overall_score",
            sa.Float(),
            nullable=True,
        ),
        sa.Column(
            "groundedness",
            sa.Float(),
            nullable=True,
        ),
        sa.Column(
            "answer_f1",
            sa.Float(),
            nullable=True,
        ),
        sa.Column(
            "context_precision",
            sa.Float(),
            nullable=True,
        ),
        sa.Column(
            "context_recall",
            sa.Float(),
            nullable=True,
        ),
        sa.Column(
            "retrieval_mean_similarity",
            sa.Float(),
            nullable=True,
        ),
        sa.Column(
            "generation_mean_latency_ms",
            sa.Float(),
            nullable=True,
        ),
        sa.Column(
            "runner_total_ms",
            sa.Float(),
            nullable=True,
        ),
        sa.Column(
            "prompt_tokens",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "completion_tokens",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "total_tokens",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "tokens_per_second",
            sa.Float(),
            nullable=True,
        ),
        sa.Column(
            "generation_provider",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "generation_model",
            sa.String(length=200),
            nullable=True,
        ),
        sa.Column(
            "embedding_provider",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "embedding_model",
            sa.String(length=200),
            nullable=True,
        ),
        sa.Column(
            "chunking_strategy",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "chunk_size",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "chunk_overlap",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "retrieval_strategy",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "retrieval_top_k",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "recommendation_score",
            sa.Float(),
            nullable=True,
        ),
        sa.Column(
            "run_started_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "run_finished_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["experiment_runs.id"],
            name="fk_run_summaries_run_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["experiment_id"],
            ["experiments.id"],
            name="fk_run_summaries_experiment_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["experiment_version_id"],
            ["experiment_versions.id"],
            name="fk_run_summaries_version_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["dataset_id"],
            ["evaluation_datasets.id"],
            name="fk_run_summaries_dataset_id",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint(
            "id",
            name="experiment_run_summaries_pkey",
        ),
        sa.UniqueConstraint(
            "run_id",
            name="uq_experiment_run_summaries_run_id",
        ),
        sa.UniqueConstraint(
            "mlflow_run_id",
            name="uq_experiment_run_summaries_mlflow_run_id",
        ),
    )

    op.create_index(
        "ix_run_summaries_run_id",
        "experiment_run_summaries",
        ["run_id"],
        unique=True,
    )

    op.create_index(
        "ix_run_summaries_experiment_id",
        "experiment_run_summaries",
        ["experiment_id"],
        unique=False,
    )

    op.create_index(
        "ix_run_summaries_version_id",
        "experiment_run_summaries",
        ["experiment_version_id"],
        unique=False,
    )

    op.create_index(
        "ix_run_summaries_dataset_id",
        "experiment_run_summaries",
        ["dataset_id"],
        unique=False,
    )

    op.create_index(
        "ix_run_summaries_mlflow_run_id",
        "experiment_run_summaries",
        ["mlflow_run_id"],
        unique=True,
    )

    op.create_index(
        "ix_run_summaries_configuration_hash",
        "experiment_run_summaries",
        ["configuration_hash"],
        unique=False,
    )

    op.create_index(
        "ix_run_summaries_overall_score",
        "experiment_run_summaries",
        ["overall_score"],
        unique=False,
    )

    op.create_index(
        "ix_run_summaries_recommendation_score",
        "experiment_run_summaries",
        ["recommendation_score"],
        unique=False,
    )

    op.create_index(
        "ix_run_summaries_generation_provider",
        "experiment_run_summaries",
        ["generation_provider"],
        unique=False,
    )

    op.create_index(
        "ix_run_summaries_generation_model",
        "experiment_run_summaries",
        ["generation_model"],
        unique=False,
    )

    op.create_index(
        "ix_run_summaries_embedding_provider",
        "experiment_run_summaries",
        ["embedding_provider"],
        unique=False,
    )

    op.create_index(
        "ix_run_summaries_embedding_model",
        "experiment_run_summaries",
        ["embedding_model"],
        unique=False,
    )

    op.create_index(
        "ix_run_summaries_chunking_strategy",
        "experiment_run_summaries",
        ["chunking_strategy"],
        unique=False,
    )

    op.create_index(
        "ix_run_summaries_chunk_size",
        "experiment_run_summaries",
        ["chunk_size"],
        unique=False,
    )

    op.create_index(
        "ix_run_summaries_retrieval_strategy",
        "experiment_run_summaries",
        ["retrieval_strategy"],
        unique=False,
    )

    op.create_index(
        "ix_run_summaries_retrieval_top_k",
        "experiment_run_summaries",
        ["retrieval_top_k"],
        unique=False,
    )

    op.create_index(
        "ix_run_summaries_run_started_at",
        "experiment_run_summaries",
        ["run_started_at"],
        unique=False,
    )

    op.create_table(
        "experiment_run_metrics",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "run_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "metric_name",
            sa.String(length=250),
            nullable=False,
        ),
        sa.Column(
            "metric_value",
            sa.Float(),
            nullable=False,
        ),
        sa.Column(
            "metric_group",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "metric_unit",
            sa.String(length=50),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["experiment_runs.id"],
            name="fk_run_metrics_run_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "id",
            name="experiment_run_metrics_pkey",
        ),
        sa.UniqueConstraint(
            "run_id",
            "metric_name",
            name="uq_experiment_run_metric",
        ),
    )

    op.create_index(
        "ix_run_metrics_run_id",
        "experiment_run_metrics",
        ["run_id"],
        unique=False,
    )

    op.create_index(
        "ix_run_metrics_metric_name",
        "experiment_run_metrics",
        ["metric_name"],
        unique=False,
    )

    op.create_index(
        "ix_run_metrics_metric_group",
        "experiment_run_metrics",
        ["metric_group"],
        unique=False,
    )

    op.create_table(
        "experiment_run_parameters",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "run_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "parameter_name",
            sa.String(length=250),
            nullable=False,
        ),
        sa.Column(
            "parameter_value",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "parameter_group",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["experiment_runs.id"],
            name="fk_run_parameters_run_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "id",
            name="experiment_run_parameters_pkey",
        ),
        sa.UniqueConstraint(
            "run_id",
            "parameter_name",
            name="uq_experiment_run_parameter",
        ),
    )

    op.create_index(
        "ix_run_parameters_run_id",
        "experiment_run_parameters",
        ["run_id"],
        unique=False,
    )

    op.create_index(
        "ix_run_parameters_parameter_name",
        "experiment_run_parameters",
        ["parameter_name"],
        unique=False,
    )

    op.create_index(
        "ix_run_parameters_parameter_group",
        "experiment_run_parameters",
        ["parameter_group"],
        unique=False,
    )

    op.create_table(
        "experiment_run_stage_metrics",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "run_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "stage_name",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column(
            "duration_ms",
            sa.Float(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["experiment_runs.id"],
            name="fk_run_stage_metrics_run_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "id",
            name="experiment_run_stage_metrics_pkey",
        ),
        sa.UniqueConstraint(
            "run_id",
            "stage_name",
            name="uq_experiment_run_stage_metric",
        ),
    )

    op.create_index(
        "ix_run_stage_metrics_run_id",
        "experiment_run_stage_metrics",
        ["run_id"],
        unique=False,
    )

    op.create_index(
        "ix_run_stage_metrics_stage_name",
        "experiment_run_stage_metrics",
        ["stage_name"],
        unique=False,
    )


def downgrade() -> None:
    """Eliminar las tablas de la capa analítica."""

    op.drop_index(
        "ix_run_stage_metrics_stage_name",
        table_name="experiment_run_stage_metrics",
    )

    op.drop_index(
        "ix_run_stage_metrics_run_id",
        table_name="experiment_run_stage_metrics",
    )

    op.drop_table(
        "experiment_run_stage_metrics"
    )

    op.drop_index(
        "ix_run_parameters_parameter_group",
        table_name="experiment_run_parameters",
    )

    op.drop_index(
        "ix_run_parameters_parameter_name",
        table_name="experiment_run_parameters",
    )

    op.drop_index(
        "ix_run_parameters_run_id",
        table_name="experiment_run_parameters",
    )

    op.drop_table(
        "experiment_run_parameters"
    )

    op.drop_index(
        "ix_run_metrics_metric_group",
        table_name="experiment_run_metrics",
    )

    op.drop_index(
        "ix_run_metrics_metric_name",
        table_name="experiment_run_metrics",
    )

    op.drop_index(
        "ix_run_metrics_run_id",
        table_name="experiment_run_metrics",
    )

    op.drop_table(
        "experiment_run_metrics"
    )

    op.drop_index(
        "ix_run_summaries_run_started_at",
        table_name="experiment_run_summaries",
    )

    op.drop_index(
        "ix_run_summaries_retrieval_top_k",
        table_name="experiment_run_summaries",
    )

    op.drop_index(
        "ix_run_summaries_retrieval_strategy",
        table_name="experiment_run_summaries",
    )

    op.drop_index(
        "ix_run_summaries_chunk_size",
        table_name="experiment_run_summaries",
    )

    op.drop_index(
        "ix_run_summaries_chunking_strategy",
        table_name="experiment_run_summaries",
    )

    op.drop_index(
        "ix_run_summaries_embedding_model",
        table_name="experiment_run_summaries",
    )

    op.drop_index(
        "ix_run_summaries_embedding_provider",
        table_name="experiment_run_summaries",
    )

    op.drop_index(
        "ix_run_summaries_generation_model",
        table_name="experiment_run_summaries",
    )

    op.drop_index(
        "ix_run_summaries_generation_provider",
        table_name="experiment_run_summaries",
    )

    op.drop_index(
        "ix_run_summaries_recommendation_score",
        table_name="experiment_run_summaries",
    )

    op.drop_index(
        "ix_run_summaries_overall_score",
        table_name="experiment_run_summaries",
    )

    op.drop_index(
        "ix_run_summaries_configuration_hash",
        table_name="experiment_run_summaries",
    )

    op.drop_index(
        "ix_run_summaries_mlflow_run_id",
        table_name="experiment_run_summaries",
    )

    op.drop_index(
        "ix_run_summaries_dataset_id",
        table_name="experiment_run_summaries",
    )

    op.drop_index(
        "ix_run_summaries_version_id",
        table_name="experiment_run_summaries",
    )

    op.drop_index(
        "ix_run_summaries_experiment_id",
        table_name="experiment_run_summaries",
    )

    op.drop_index(
        "ix_run_summaries_run_id",
        table_name="experiment_run_summaries",
    )

    op.drop_table(
        "experiment_run_summaries"
    )
