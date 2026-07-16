from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.repository import (
    AnalyticsRepository,
)
from app.analytics.schemas import (
    AnalyticsDashboardResponse,
    AnalyticsSummaryResponse,
)
from app.db.session import get_db_session


router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
)

DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_db_session),
]


@router.get(
    "/dashboard",
    response_model=AnalyticsDashboardResponse,
)
async def get_analytics_dashboard(
    session: DatabaseSession,
) -> AnalyticsDashboardResponse:
    repository = AnalyticsRepository(
        session
    )

    values = (
        await repository
        .get_dashboard_aggregates()
    )

    total_runs = values[
        "total_runs"
    ]
    completed_runs = values[
        "completed_runs"
    ]

    success_rate = (
        completed_runs / total_runs
        if total_runs > 0
        else None
    )

    return AnalyticsDashboardResponse(
        **values,
        success_rate=success_rate,
    )


@router.get(
    "/summaries",
    response_model=list[
        AnalyticsSummaryResponse
    ],
)
async def list_analytics_summaries(
    session: DatabaseSession,
    limit: int = 100,
    offset: int = 0,
) -> list[AnalyticsSummaryResponse]:
    normalized_limit = max(
        1,
        min(limit, 500),
    )

    normalized_offset = max(
        0,
        offset,
    )

    repository = AnalyticsRepository(
        session
    )

    summaries = (
        await repository.list_summaries(
            limit=normalized_limit,
            offset=normalized_offset,
        )
    )

    return [
        AnalyticsSummaryResponse(
            run_id=str(summary.run_id),
            experiment_name=(
                summary.experiment_name
            ),
            experiment_version=(
                summary.experiment_version
            ),
            generation_model=(
                summary.generation_model
            ),
            embedding_model=(
                summary.embedding_model
            ),
            chunk_size=summary.chunk_size,
            chunk_overlap=(
                summary.chunk_overlap
            ),
            retrieval_top_k=(
                summary.retrieval_top_k
            ),
            overall_score=(
                summary.overall_score
            ),
            groundedness=(
                summary.groundedness
            ),
            answer_f1=(
                summary.answer_f1
            ),
            generation_mean_latency_ms=(
                summary.generation_mean_latency_ms
            ),
            total_tokens=(
                summary.total_tokens
            ),
            recommendation_score=(
                summary.recommendation_score
            ),
            run_started_at=(
                summary.run_started_at
            ),
            run_finished_at=(
                summary.run_finished_at
            ),
        )
        for summary in summaries
    ]
