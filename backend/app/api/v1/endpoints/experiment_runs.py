import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db_session
from app.experiment.runner import execute_experiment_run
from app.models.experiment import (
    Experiment,
    ExperimentRun,
    ExperimentVersion,
)
from app.schemas.experiment_run import ExperimentRunResponse


router = APIRouter(
    prefix="/experiment-runs",
    tags=["experiment-runs"],
)

DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_db_session),
]


@router.post(
    "/versions/{version_id}",
    response_model=ExperimentRunResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_and_execute_run(
    version_id: uuid.UUID,
    session: DatabaseSession,
) -> ExperimentRun:
    result = await session.execute(
        select(ExperimentVersion)
        .options(
            selectinload(ExperimentVersion.experiment)
        )
        .where(ExperimentVersion.id == version_id)
    )

    version = result.scalar_one_or_none()

    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Versión de experimento no encontrada.",
        )

    experiment = version.experiment

    run = ExperimentRun(
        experiment_version_id=version.id,
        status="pending",
    )

    session.add(run)
    await session.commit()
    await session.refresh(run)

    return await execute_experiment_run(
        session=session,
        experiment=experiment,
        version=version,
        run=run,
    )


@router.get(
    "",
    response_model=list[ExperimentRunResponse],
)
async def list_experiment_runs(
    session: DatabaseSession,
) -> list[ExperimentRun]:
    result = await session.execute(
        select(ExperimentRun)
        .order_by(ExperimentRun.created_at.desc())
    )

    return list(result.scalars().all())


@router.get(
    "/{run_id}",
    response_model=ExperimentRunResponse,
)
async def get_experiment_run(
    run_id: uuid.UUID,
    session: DatabaseSession,
) -> ExperimentRun:
    run = await session.get(ExperimentRun, run_id)

    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ejecución no encontrada.",
        )

    return run
