import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.models.corpus import Corpus
from app.schemas.corpus import (
    CorpusCreate,
    CorpusResponse,
    CorpusUpdate,
)


router = APIRouter(
    prefix="/corpora",
    tags=["corpora"],
)

DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_db_session),
]


@router.post(
    "",
    response_model=CorpusResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_corpus(
    payload: CorpusCreate,
    session: DatabaseSession,
) -> Corpus:
    corpus = Corpus(
        name=payload.name,
        description=payload.description,
    )

    session.add(corpus)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un corpus con ese nombre.",
        ) from exc

    await session.refresh(corpus)
    return corpus


@router.get(
    "",
    response_model=list[CorpusResponse],
)
async def list_corpora(
    session: DatabaseSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[Corpus]:
    result = await session.execute(
        select(Corpus)
        .order_by(Corpus.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    return list(result.scalars().all())


@router.get(
    "/{corpus_id}",
    response_model=CorpusResponse,
)
async def get_corpus(
    corpus_id: uuid.UUID,
    session: DatabaseSession,
) -> Corpus:
    corpus = await session.get(Corpus, corpus_id)

    if corpus is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Corpus no encontrado.",
        )

    return corpus


@router.patch(
    "/{corpus_id}",
    response_model=CorpusResponse,
)
async def update_corpus(
    corpus_id: uuid.UUID,
    payload: CorpusUpdate,
    session: DatabaseSession,
) -> Corpus:
    corpus = await session.get(Corpus, corpus_id)

    if corpus is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Corpus no encontrado.",
        )

    update_data = payload.model_dump(
        exclude_unset=True,
    )

    for field, value in update_data.items():
        setattr(corpus, field, value)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un corpus con ese nombre.",
        ) from exc

    await session.refresh(corpus)
    return corpus


@router.delete(
    "/{corpus_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_corpus(
    corpus_id: uuid.UUID,
    session: DatabaseSession,
) -> None:
    corpus = await session.get(Corpus, corpus_id)

    if corpus is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Corpus no encontrado.",
        )

    await session.delete(corpus)
    await session.commit()
