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
    EvaluationDatasetGenerateRequest,
    EvaluationDatasetResponse,
    EvaluationDatasetStatusUpdate,
    EvaluationDatasetSummaryResponse,
    EvaluationDatasetUpdate,
    EvaluationQuestionCreate,
    EvaluationQuestionResponse,
    EvaluationQuestionUpdate,
)


from app.services.dataset_generation import generate_dataset_from_corpus


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
            selectinload(
                EvaluationDataset.questions
            )
        )

    result = await session.execute(query)
    dataset = result.scalar_one_or_none()

    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset no encontrado.",
        )

    return dataset


async def get_question_or_404(
    question_id: uuid.UUID,
    session: AsyncSession,
) -> EvaluationQuestion:
    result = await session.execute(
        select(EvaluationQuestion).where(
            EvaluationQuestion.id
            == question_id
        )
    )

    question = result.scalar_one_or_none()

    if question is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pregunta no encontrada.",
        )

    return question


async def load_dataset_with_questions(
    dataset_id: uuid.UUID,
    session: AsyncSession,
) -> EvaluationDataset:
    result = await session.execute(
        select(EvaluationDataset)
        .options(
            selectinload(
                EvaluationDataset.questions
            )
        )
        .where(
            EvaluationDataset.id
            == dataset_id
        )
    )

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
            if question_payload.order_index
            is not None
            else position
        )

        dataset.questions.append(
            EvaluationQuestion(
                question=(
                    question_payload.question
                ),
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
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Ya existe un dataset con "
                "ese nombre y número de "
                "versión."
            ),
        ) from exc

    return await load_dataset_with_questions(
        dataset_id=dataset.id,
        session=session,
    )


@router.get(
    "",
    response_model=list[
        EvaluationDatasetSummaryResponse
    ],
)
async def list_datasets(
    session: DatabaseSession,
) -> list[dict]:
    result = await session.execute(
        select(
            EvaluationDataset,
            func.count(
                EvaluationQuestion.id
            ).label(
                "question_count"
            ),
        )
        .outerjoin(
            EvaluationQuestion,
            EvaluationQuestion.dataset_id
            == EvaluationDataset.id,
        )
        .group_by(
            EvaluationDataset.id
        )
        .order_by(
            EvaluationDataset.created_at.desc()
        )
    )

    return [
        {
            "id": dataset.id,
            "name": dataset.name,
            "description": (
                dataset.description
            ),
            "version": dataset.version,
            "status": dataset.status,
            "created_at": (
                dataset.created_at
            ),
            "updated_at": (
                dataset.updated_at
            ),
            "question_count": (
                question_count
            ),
        }
        for dataset, question_count
        in result.all()
    ]


@router.post(
    "/generate-from-corpus",
    response_model=EvaluationDatasetResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_dataset(
    payload: EvaluationDatasetGenerateRequest,
    session: DatabaseSession,
) -> EvaluationDataset:
    return await generate_dataset_from_corpus(
        payload=payload,
        session=session,
    )


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


@router.patch(
    "/{dataset_id}",
    response_model=EvaluationDatasetResponse,
)
async def update_dataset(
    dataset_id: uuid.UUID,
    payload: EvaluationDatasetUpdate,
    session: DatabaseSession,
) -> EvaluationDataset:
    dataset = await get_dataset_or_404(
        dataset_id=dataset_id,
        session=session,
    )

    update_data = payload.model_dump(
        exclude_unset=True,
    )

    for field, value in update_data.items():
        setattr(
            dataset,
            field,
            value,
        )

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Ya existe un dataset con "
                "ese nombre y número de "
                "versión."
            ),
        ) from exc

    return await load_dataset_with_questions(
        dataset_id=dataset.id,
        session=session,
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

        maximum_order = (
            result.scalar_one_or_none()
        )

        order_index = (
            -1
            if maximum_order is None
            else maximum_order
        ) + 1
    else:
        order_index = payload.order_index

    question = EvaluationQuestion(
        dataset_id=dataset_id,
        question=payload.question,
        expected_answer=(
            payload.expected_answer
        ),
        expected_contexts=(
            payload.expected_contexts
        ),
        question_metadata=(
            payload.metadata
        ),
        order_index=order_index,
    )

    session.add(question)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Ya existe una pregunta con "
                "ese order_index en el "
                "dataset."
            ),
        ) from exc

    await session.refresh(question)

    return question


@router.patch(
    "/questions/{question_id}",
    response_model=EvaluationQuestionResponse,
)
async def update_dataset_question(
    question_id: uuid.UUID,
    payload: EvaluationQuestionUpdate,
    session: DatabaseSession,
) -> EvaluationQuestion:
    question = await get_question_or_404(
        question_id=question_id,
        session=session,
    )

    update_data = payload.model_dump(
        exclude_unset=True,
    )

    metadata = update_data.pop(
        "metadata",
        None,
    )

    for field, value in update_data.items():
        setattr(
            question,
            field,
            value,
        )

    if "metadata" in payload.model_fields_set:
        question.question_metadata = (
            metadata
            if metadata is not None
            else {}
        )

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "Ya existe una pregunta con "
                "ese order_index en el "
                "dataset."
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
    )

    dataset.status = payload.status

    await session.commit()

    return await load_dataset_with_questions(
        dataset_id=dataset.id,
        session=session,
    )


@router.delete(
    "/questions/{question_id}",
    status_code=(
        status.HTTP_204_NO_CONTENT
    ),
)
async def delete_dataset_question(
    question_id: uuid.UUID,
    session: DatabaseSession,
) -> Response:
    question = await get_question_or_404(
        question_id=question_id,
        session=session,
    )

    dataset_id = question.dataset_id
    deleted_order = question.order_index

    await session.delete(question)
    await session.flush()

    result = await session.execute(
        select(EvaluationQuestion)
        .where(
            EvaluationQuestion.dataset_id
            == dataset_id,
            EvaluationQuestion.order_index
            > deleted_order,
        )
        .order_by(
            EvaluationQuestion.order_index
        )
    )

    following_questions = list(
        result.scalars().all()
    )

    for following_question in (
        following_questions
    ):
        following_question.order_index -= 1

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
            ),
            detail=(
                "No se pudo reorganizar el "
                "orden de las preguntas."
            ),
        ) from exc

    return Response(
        status_code=(
            status.HTTP_204_NO_CONTENT
        )
    )


@router.delete(
    "/{dataset_id}",
    status_code=(
        status.HTTP_204_NO_CONTENT
    ),
)
async def delete_dataset(
    dataset_id: uuid.UUID,
    session: DatabaseSession,
) -> Response:
    result = await session.execute(
        delete(EvaluationDataset)
        .where(
            EvaluationDataset.id
            == dataset_id
        )
        .returning(
            EvaluationDataset.id
        )
    )

    deleted_id = (
        result.scalar_one_or_none()
    )

    if deleted_id is None:
        await session.rollback()

        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
            ),
            detail="Dataset no encontrado.",
        )

    await session.commit()

    return Response(
        status_code=(
            status.HTTP_204_NO_CONTENT
        )
    )
