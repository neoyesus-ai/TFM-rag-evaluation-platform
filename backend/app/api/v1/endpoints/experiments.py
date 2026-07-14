import hashlib
import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db_session
from app.models.corpus import Corpus
from app.models.experiment import Experiment, ExperimentVersion
from app.schemas.experiment import (
    ExperimentCreate,
    ExperimentDetailResponse,
    ExperimentResponse,
    ExperimentVersionCreate,
    ExperimentVersionResponse,
)


router = APIRouter(
    prefix="/experiments",
    tags=["experiments"],
)

DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_db_session),
]


def calculate_configuration_hash(configuration: dict) -> str:
    canonical = json.dumps(
        configuration,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


@router.post(
    "",
    response_model=ExperimentDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_experiment(
    payload: ExperimentCreate,
    session: DatabaseSession,
) -> Experiment:
    corpus = await session.get(Corpus, payload.corpus_id)

    if corpus is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Corpus no encontrado.",
        )

    configuration = payload.configuration.model_dump(mode="json")

    experiment = Experiment(
        name=payload.name,
        description=payload.description,
        corpus_id=payload.corpus_id,
        status="draft",
    )

    version = ExperimentVersion(
        version_number=1,
        schema_version=payload.configuration.schema_version,
        configuration=configuration,
        configuration_hash=calculate_configuration_hash(configuration),
        source_template_key=payload.source_template_key,
        git_commit=payload.git_commit,
    )

    experiment.versions.append(version)
    session.add(experiment)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un experimento con ese nombre.",
        ) from exc

    result = await session.execute(
        select(Experiment)
        .options(selectinload(Experiment.versions))
        .where(Experiment.id == experiment.id)
    )

    return result.scalar_one()


@router.get(
    "",
    response_model=list[ExperimentResponse],
)
async def list_experiments(
    session: DatabaseSession,
) -> list[Experiment]:
    result = await session.execute(
        select(Experiment).order_by(Experiment.created_at.desc())
    )
    return list(result.scalars().all())


@router.get(
    "/{experiment_id}",
    response_model=ExperimentDetailResponse,
)
async def get_experiment(
    experiment_id: uuid.UUID,
    session: DatabaseSession,
) -> Experiment:
    result = await session.execute(
        select(Experiment)
        .options(selectinload(Experiment.versions))
        .where(Experiment.id == experiment_id)
    )

    experiment = result.scalar_one_or_none()

    if experiment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Experimento no encontrado.",
        )

    return experiment


@router.post(
    "/{experiment_id}/versions",
    response_model=ExperimentVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_experiment_version(
    experiment_id: uuid.UUID,
    payload: ExperimentVersionCreate,
    session: DatabaseSession,
) -> ExperimentVersion:
    experiment = await session.get(Experiment, experiment_id)

    if experiment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Experimento no encontrado.",
        )

    result = await session.execute(
        select(func.max(ExperimentVersion.version_number)).where(
            ExperimentVersion.experiment_id == experiment_id
        )
    )

    latest_version = result.scalar_one() or 0
    configuration = payload.configuration.model_dump(mode="json")

    version = ExperimentVersion(
        experiment_id=experiment_id,
        version_number=latest_version + 1,
        schema_version=payload.configuration.schema_version,
        configuration=configuration,
        configuration_hash=calculate_configuration_hash(configuration),
        source_template_key=payload.source_template_key,
        git_commit=payload.git_commit,
    )

    session.add(version)
    await session.commit()
    await session.refresh(version)

    return version
