from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.models.corpus import Corpus
from app.rag_console.schemas import (
    HealthResponse,
    RagConsoleCorpusResponse,
)


router = APIRouter()

DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_db_session),
]


@router.get(
    "/health",
    response_model=HealthResponse,
)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        module="rag_console",
    )


@router.get(
    "/corpora",
    response_model=list[RagConsoleCorpusResponse],
)
async def list_corpora(
    session: DatabaseSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[Corpus]:
    result = await session.execute(
        select(Corpus)
        .order_by(Corpus.name.asc())
        .limit(limit)
        .offset(offset)
    )

    return list(result.scalars().all())
