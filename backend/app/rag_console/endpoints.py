from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.models.corpus import Corpus
from app.rag_console.query_schemas import (
    RagConsoleQueryRequest,
    RagConsoleQueryResponse,
)
from app.rag_console.query_service import (
    RagConsoleConfigurationError,
    RagConsoleQueryService,
    RagConsoleRunNotFoundError,
    RagConsoleRunUnavailableError,
)
from app.rag_console.schemas import (
    HealthResponse,
    RagConsoleCorpusResponse,
    RagConsoleRunResponse,
)
from app.rag_console.service import RagConsoleService


router = APIRouter()

service = RagConsoleService()
query_service = RagConsoleQueryService()

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
    response_model=list[
        RagConsoleCorpusResponse
    ],
)
async def list_corpora(
    session: DatabaseSession,
    limit: Annotated[
        int,
        Query(
            ge=1,
            le=100,
        ),
    ] = 100,
    offset: Annotated[
        int,
        Query(
            ge=0,
        ),
    ] = 0,
) -> list[Corpus]:
    result = await session.execute(
        select(Corpus)
        .order_by(
            Corpus.name.asc()
        )
        .limit(limit)
        .offset(offset)
    )

    return list(
        result.scalars().all()
    )


@router.get(
    "/runs",
    response_model=list[
        RagConsoleRunResponse
    ],
)
async def list_runs(
    session: DatabaseSession,
) -> list[
    RagConsoleRunResponse
]:
    return await service.list_runs(
        session
    )


@router.post(
    "/query",
    response_model=(
        RagConsoleQueryResponse
    ),
)
async def query_rag_console(
    request: RagConsoleQueryRequest,
    session: DatabaseSession,
) -> RagConsoleQueryResponse:
    try:
        return await query_service.query(
            session=session,
            request=request,
        )

    except RagConsoleRunNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    except (
        RagConsoleRunUnavailableError,
        RagConsoleConfigurationError,
        ValueError,
    ) as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except RuntimeError as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc
