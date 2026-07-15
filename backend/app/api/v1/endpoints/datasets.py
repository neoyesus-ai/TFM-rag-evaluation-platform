import uuid
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Response,
    status,
)
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db_session
from app.models.dataset import (
    EvaluationDataset,
    EvaluationQuestion,
)
from app.schemas.dataset import (
    EvaluationDatasetCreate,
    EvaluationDatasetResponse,
    EvaluationDatasetStatusUpdate,
    EvaluationDatasetSummaryResponse,
    EvaluationQuestionCreate,
    EvaluationQuestionResponse,
)


router = APIRouter(
    prefix="/datasets",
    tags=["datasets"],
)

DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_db_session),
]


async def get_dataset_or_404(
    dataset_id: uuid.UUID,
    session: AsyncSession,
    load_questions: bool = False,
) -> EvaluationDataset:
    query = select(EvaluationDataset).where(
        EvaluationDataset.id == dataset_id
    )

    if load_questions:
        query = query.options(
            selectinload(EvaluationDataset.questions)
        )

    result = await session.execute(query)
    dataset = result.scalar_one_or_none()

    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset no encontrado.",
        )

    return dataset


@router.post(
    "",
    response_model=EvaluationDatasetResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_dataset(
    payload: EvaluationDatasetCreate,
    session: DatabaseSession,
) -> EvaluationDataset:
    dataset = EvaluationDataset(
        name=payload.name,
        description=payload.description,
        version=payload.version,
        status=payload.status,
    )

    for position, question_payload in enumerate(
        payload.questions
    ):
        order_index = (
            question_payload.order_index
            if question_payload.order_index is not None
            else position
        )

        dataset.questions.append(
            EvaluationQuestion(
                question=question_payload.question,
                expected_answer=(
                    question_payload.expected_answer
                ),
                expected_contexts=(
                    question_payload.expected_contexts
                ),
                question_metadata=(
                    question_payload.metadata
                ),
                order_index=order_index,
            )
        )

    session.add(dataset)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Ya existe un dataset con ese nombre "
                "y número de versión."
            ),
        ) from exc

    result = await session.execute(
        select(EvaluationDataset)
        .options(
            selectinload(EvaluationDataset.questions)
        )
        .where(EvaluationDataset.id == dataset.id)
    )

    return result.scalar_one()


@router.get(
    "",
    response_model=list[EvaluationDatasetSummaryResponse],
)
async def list_datasets(
    session: DatabaseSession,
) -> list[dict]:
    result = await session.execute(
        select(
            EvaluationDataset,
            func.count(EvaluationQuestion.id).label(
                "question_count"
            ),
        )
        .outerjoin(
            EvaluationQuestion,
            EvaluationQuestion.dataset_id
            == EvaluationDataset.id,
        )
        .group_by(EvaluationDataset.id)
        .order_by(
            EvaluationDataset.created_at.desc()
        )
    )

    return [
        {
            "id": dataset.id,
            "name": dataset.name,
            "description": dataset.description,
            "version": dataset.version,
            "status": dataset.status,
            "created_at": dataset.created_at,
            "updated_at": dataset.updated_at,
            "question_count": question_count,
        }
        for dataset, question_count in result.all()
    ]


@router.get(
    "/{dataset_id}",
    response_model=EvaluationDatasetResponse,
)
async def get_dataset(
    dataset_id: uuid.UUID,
    session: DatabaseSession,
) -> EvaluationDataset:
    return await get_dataset_or_404(
        dataset_id=dataset_id,
        session=session,
        load_questions=True,
    )


@router.post(
    "/{dataset_id}/questions",
    response_model=EvaluationQuestionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_dataset_question(
    dataset_id: uuid.UUID,
    payload: EvaluationQuestionCreate,
    session: DatabaseSession,
) -> EvaluationQuestion:
    await get_dataset_or_404(
        dataset_id=dataset_id,
        session=session,
    )

    if payload.order_index is None:
        result = await session.execute(
            select(
                func.max(
                    EvaluationQuestion.order_index
                )
            ).where(
                EvaluationQuestion.dataset_id
                == dataset_id
            )
        )

        order_index = (
            result.scalar_one_or_none() or -1
        ) + 1
    else:
        order_index = payload.order_index

    question = EvaluationQuestion(
        dataset_id=dataset_id,
        question=payload.question,
        expected_answer=payload.expected_answer,
        expected_contexts=payload.expected_contexts,
        question_metadata=payload.metadata,
        order_index=order_index,
    )

    session.add(question)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Ya existe una pregunta con ese "
                "order_index en el dataset."
            ),
        ) from exc

    await session.refresh(question)

    return question


@router.patch(
    "/{dataset_id}/status",
    response_model=EvaluationDatasetResponse,
)
async def update_dataset_status(
    dataset_id: uuid.UUID,
    payload: EvaluationDatasetStatusUpdate,
    session: DatabaseSession,
) -> EvaluationDataset:
    dataset = await get_dataset_or_404(
        dataset_id=dataset_id,
        session=session,
        load_questions=True,
    )

    dataset.status = payload.status

    await session.commit()
    await session.refresh(dataset)

    return dataset


@router.delete(
    "/questions/{question_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_dataset_question(
    question_id: uuid.UUID,
    session: DatabaseSession,
) -> Response:
    result = await session.execute(
        delete(EvaluationQuestion)
        .where(EvaluationQuestion.id == question_id)
        .returning(EvaluationQuestion.id)
    )

    deleted_id = result.scalar_one_or_none()

    if deleted_id is None:
        await session.rollback()

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pregunta no encontrada.",
        )

    await session.commit()

    return Response(
        status_code=status.HTTP_204_NO_CONTENT
    )


@router.delete(
    "/{dataset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_dataset(
    dataset_id: uuid.UUID,
    session: DatabaseSession,
) -> Response:
    result = await session.execute(
        delete(EvaluationDataset)
        .where(EvaluationDataset.id == dataset_id)
        .returning(EvaluationDataset.id)
    )

    deleted_id = result.scalar_one_or_none()

    if deleted_id is None:
        await session.rollback()

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset no encontrado.",
        )

    await session.commit()

    return Response(
        status_code=status.HTTP_204_NO_CONTENT
    )
