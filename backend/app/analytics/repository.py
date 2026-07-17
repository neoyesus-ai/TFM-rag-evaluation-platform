import uuid
from collections.abc import Iterable
from typing import Any

from sqlalchemy import (
    delete,
    func,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.models import (
    ExperimentRunMetric,
    ExperimentRunParameter,
    ExperimentRunStageMetric,
    ExperimentRunSummary,
)
from app.models.experiment import ExperimentRun


class AnalyticsRepository:
    """
    Acceso a datos de la capa analítica.

    Las operaciones están diseñadas para ser idempotentes. Una misma
    ejecución puede sincronizarse varias veces sin generar duplicados.
    """

    def __init__(
        self,
        session: AsyncSession,
    ) -> None:
        self.session = session

    async def get_summary_by_run_id(
        self,
        run_id: uuid.UUID,
    ) -> ExperimentRunSummary | None:
        result = await self.session.execute(
            select(ExperimentRunSummary).where(
                ExperimentRunSummary.run_id == run_id
            )
        )

        return result.scalar_one_or_none()

    async def get_summary_by_mlflow_run_id(
        self,
        mlflow_run_id: str,
    ) -> ExperimentRunSummary | None:
        result = await self.session.execute(
            select(ExperimentRunSummary).where(
                ExperimentRunSummary.mlflow_run_id
                == mlflow_run_id
            )
        )

        return result.scalar_one_or_none()

    async def upsert_summary(
        self,
        *,
        run_id: uuid.UUID,
        experiment_id: uuid.UUID,
        experiment_version_id: uuid.UUID,
        dataset_id: uuid.UUID | None,
        mlflow_run_id: str,
        experiment_name: str,
        experiment_version: int,
        configuration_hash: str,
        values: dict[str, Any],
    ) -> ExperimentRunSummary:
        summary = await self.get_summary_by_run_id(
            run_id
        )

        if summary is None:
            summary = ExperimentRunSummary(
                run_id=run_id,
                experiment_id=experiment_id,
                experiment_version_id=(
                    experiment_version_id
                ),
                dataset_id=dataset_id,
                mlflow_run_id=mlflow_run_id,
                experiment_name=experiment_name,
                experiment_version=(
                    experiment_version
                ),
                configuration_hash=(
                    configuration_hash
                ),
            )

            self.session.add(summary)

        summary.experiment_id = experiment_id
        summary.experiment_version_id = (
            experiment_version_id
        )
        summary.dataset_id = dataset_id
        summary.mlflow_run_id = mlflow_run_id
        summary.experiment_name = experiment_name
        summary.experiment_version = (
            experiment_version
        )
        summary.configuration_hash = (
            configuration_hash
        )

        allowed_fields = {
            "overall_score",
            "groundedness",
            "answer_f1",
            "context_precision",
            "context_recall",
            "retrieval_mean_similarity",
            "generation_mean_latency_ms",
            "runner_total_ms",
            "prompt_tokens",
            "completion_tokens",
            "total_tokens",
            "tokens_per_second",
            "generation_provider",
            "generation_model",
            "embedding_provider",
            "embedding_model",
            "chunking_strategy",
            "chunk_size",
            "chunk_overlap",
            "retrieval_strategy",
            "retrieval_top_k",
            "recommendation_score",
            "run_started_at",
            "run_finished_at",
        }

        for field_name, field_value in (
            values.items()
        ):
            if field_name not in allowed_fields:
                continue

            setattr(
                summary,
                field_name,
                field_value,
            )

        await self.session.flush()
        await self.session.refresh(summary)

        return summary

    async def replace_metrics(
        self,
        run_id: uuid.UUID,
        metrics: dict[str, float],
    ) -> list[ExperimentRunMetric]:
        await self.session.execute(
            delete(ExperimentRunMetric).where(
                ExperimentRunMetric.run_id
                == run_id
            )
        )

        records: list[
            ExperimentRunMetric
        ] = []

        for metric_name, metric_value in (
            metrics.items()
        ):
            record = ExperimentRunMetric(
                run_id=run_id,
                metric_name=metric_name,
                metric_value=float(
                    metric_value
                ),
                metric_group=(
                    self.get_metric_group(
                        metric_name
                    )
                ),
                metric_unit=(
                    self.get_metric_unit(
                        metric_name
                    )
                ),
            )

            self.session.add(record)
            records.append(record)

        await self.session.flush()

        return records

    async def replace_parameters(
        self,
        run_id: uuid.UUID,
        parameters: dict[str, Any],
    ) -> list[ExperimentRunParameter]:
        await self.session.execute(
            delete(
                ExperimentRunParameter
            ).where(
                ExperimentRunParameter.run_id
                == run_id
            )
        )

        records: list[
            ExperimentRunParameter
        ] = []

        for (
            parameter_name,
            parameter_value,
        ) in parameters.items():
            record = ExperimentRunParameter(
                run_id=run_id,
                parameter_name=(
                    parameter_name
                ),
                parameter_value=str(
                    parameter_value
                ),
                parameter_group=(
                    self.get_parameter_group(
                        parameter_name
                    )
                ),
            )

            self.session.add(record)
            records.append(record)

        await self.session.flush()

        return records

    async def replace_stage_metrics(
        self,
        run_id: uuid.UUID,
        stages: Iterable[
            tuple[str, float]
        ],
    ) -> list[ExperimentRunStageMetric]:
        await self.session.execute(
            delete(
                ExperimentRunStageMetric
            ).where(
                ExperimentRunStageMetric.run_id
                == run_id
            )
        )

        records: list[
            ExperimentRunStageMetric
        ] = []

        for stage_name, duration_ms in stages:
            record = ExperimentRunStageMetric(
                run_id=run_id,
                stage_name=stage_name,
                duration_ms=float(
                    duration_ms
                ),
            )

            self.session.add(record)
            records.append(record)

        await self.session.flush()

        return records

    async def list_summaries(
        self,
        *,
        limit: int = 100,
        offset: int = 0,
    ) -> list[ExperimentRunSummary]:
        result = await self.session.execute(
            select(ExperimentRunSummary)
            .order_by(
                ExperimentRunSummary
                .run_started_at
                .desc()
            )
            .offset(offset)
            .limit(limit)
        )

        return list(
            result.scalars().all()
        )

    async def get_dashboard_aggregates(
        self,
    ) -> dict[str, Any]:
        run_counts_result = (
            await self.session.execute(
                select(
                    func.count(
                        ExperimentRun.id
                    ).label("total_runs"),
                    func.count(
                        ExperimentRun.id
                    )
                    .filter(
                        ExperimentRun.status
                        == "completed"
                    )
                    .label(
                        "completed_runs"
                    ),
                    func.count(
                        ExperimentRun.id
                    )
                    .filter(
                        ExperimentRun.status
                        == "failed"
                    )
                    .label(
                        "failed_runs"
                    ),
                )
            )
        )

        run_counts = (
            run_counts_result.one()
        )

        metrics_result = (
            await self.session.execute(
                select(
                    func.max(
                        ExperimentRunSummary
                        .overall_score
                    ).label(
                        "best_overall_score"
                    ),
                    func.avg(
                        ExperimentRunSummary
                        .overall_score
                    ).label(
                        "mean_overall_score"
                    ),
                    func.max(
                        ExperimentRunSummary
                        .groundedness
                    ).label(
                        "best_groundedness"
                    ),
                    func.avg(
                        ExperimentRunSummary
                        .groundedness
                    ).label(
                        "mean_groundedness"
                    ),
                    func.avg(
                        ExperimentRunSummary
                        .answer_f1
                    ).label(
                        "mean_answer_f1"
                    ),
                    func.avg(
                        ExperimentRunSummary
                        .generation_mean_latency_ms
                    ).label(
                        "mean_generation_latency_ms"
                    ),
                    func.avg(
                        ExperimentRunSummary
                        .runner_total_ms
                    ).label(
                        "mean_runner_total_ms"
                    ),
                    func.avg(
                        ExperimentRunSummary
                        .total_tokens
                    ).label(
                        "mean_total_tokens"
                    ),
                    func.avg(
                        ExperimentRunSummary
                        .recommendation_score
                    ).label(
                        "mean_recommendation_score"
                    ),
                    func.max(
                        ExperimentRunSummary
                        .run_started_at
                    ).label(
                        "latest_run_at"
                    ),
                )
            )
        )

        metrics = metrics_result.one()

        return {
            "total_runs": int(
                run_counts.total_runs or 0
            ),
            "completed_runs": int(
                run_counts.completed_runs
                or 0
            ),
            "failed_runs": int(
                run_counts.failed_runs or 0
            ),
            "best_overall_score": (
                float(
                    metrics.best_overall_score
                )
                if metrics.best_overall_score
                is not None
                else None
            ),
            "mean_overall_score": (
                float(
                    metrics.mean_overall_score
                )
                if metrics.mean_overall_score
                is not None
                else None
            ),
            "best_groundedness": (
                float(
                    metrics.best_groundedness
                )
                if metrics.best_groundedness
                is not None
                else None
            ),
            "mean_groundedness": (
                float(
                    metrics.mean_groundedness
                )
                if metrics.mean_groundedness
                is not None
                else None
            ),
            "mean_answer_f1": (
                float(
                    metrics.mean_answer_f1
                )
                if metrics.mean_answer_f1
                is not None
                else None
            ),
            "mean_generation_latency_ms": (
                float(
                    metrics.mean_generation_latency_ms
                )
                if metrics.mean_generation_latency_ms
                is not None
                else None
            ),
            "mean_runner_total_ms": (
                float(
                    metrics.mean_runner_total_ms
                )
                if metrics.mean_runner_total_ms
                is not None
                else None
            ),
            "mean_total_tokens": (
                float(
                    metrics.mean_total_tokens
                )
                if metrics.mean_total_tokens
                is not None
                else None
            ),
            "mean_recommendation_score": (
                float(
                    metrics.mean_recommendation_score
                )
                if metrics.mean_recommendation_score
                is not None
                else None
            ),
            "latest_run_at": (
                metrics.latest_run_at
            ),
        }

    async def list_metrics_for_run(
        self,
        run_id: uuid.UUID,
    ) -> list[ExperimentRunMetric]:
        result = await self.session.execute(
            select(ExperimentRunMetric)
            .where(
                ExperimentRunMetric.run_id
                == run_id
            )
            .order_by(
                ExperimentRunMetric
                .metric_name
            )
        )

        return list(
            result.scalars().all()
        )

    async def list_parameters_for_run(
        self,
        run_id: uuid.UUID,
    ) -> list[ExperimentRunParameter]:
        result = await self.session.execute(
            select(
                ExperimentRunParameter
            )
            .where(
                ExperimentRunParameter.run_id
                == run_id
            )
            .order_by(
                ExperimentRunParameter
                .parameter_name
            )
        )

        return list(
            result.scalars().all()
        )

    async def list_stage_metrics_for_run(
        self,
        run_id: uuid.UUID,
    ) -> list[
        ExperimentRunStageMetric
    ]:
        result = await self.session.execute(
            select(
                ExperimentRunStageMetric
            )
            .where(
                ExperimentRunStageMetric.run_id
                == run_id
            )
            .order_by(
                ExperimentRunStageMetric
                .stage_name
            )
        )

        return list(
            result.scalars().all()
        )

    @staticmethod
    def get_metric_group(
        metric_name: str,
    ) -> str | None:
        if metric_name.startswith(
            "evaluation_"
        ):
            return "evaluation"

        if metric_name.startswith(
            "retrieval_"
        ):
            return "retrieval"

        if metric_name.startswith(
            "generation_"
        ):
            return "generation"

        if metric_name.startswith(
            "embedding_"
        ):
            return "embeddings"

        if metric_name.startswith(
            "indexing_"
        ):
            return "indexing"

        if metric_name.startswith(
            "stage."
        ):
            return "stages"

        if metric_name.startswith(
            "runner_"
        ):
            return "runner"

        if metric_name.startswith(
            "analytics_"
        ):
            return "analytics"

        if metric_name in {
            "document_count",
            "character_count",
        }:
            return "input"

        if metric_name in {
            "chunk_count",
            "mean_chunk_size",
            "min_chunk_size",
            "max_chunk_size",
        }:
            return "chunking"

        return None

    @staticmethod
    def get_metric_unit(
        metric_name: str,
    ) -> str | None:
        if metric_name.endswith(
            "_duration_ms"
        ):
            return "ms"

        if metric_name.endswith(
            "_latency_ms"
        ):
            return "ms"

        if metric_name.endswith(
            "_total_ms"
        ):
            return "ms"

        if metric_name.endswith(
            "_tokens"
        ):
            return "tokens"

        if metric_name.endswith(
            "_count"
        ):
            return "count"

        if metric_name.endswith(
            "_size_bytes"
        ):
            return "bytes"

        if metric_name.endswith(
            "_per_second"
        ):
            return "per_second"

        if any(
            fragment in metric_name
            for fragment in (
                "score",
                "precision",
                "recall",
                "f1",
                "groundedness",
                "relevancy",
                "similarity",
                "exact_match",
            )
        ):
            return "ratio"

        return None

    @staticmethod
    def get_parameter_group(
        parameter_name: str,
    ) -> str | None:
        if "." not in parameter_name:
            return "general"

        return parameter_name.split(
            ".",
            maxsplit=1,
        )[0]
