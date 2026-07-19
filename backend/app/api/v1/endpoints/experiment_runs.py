import uuid
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    status,
)
from mlflow.exceptions import MlflowException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db_session
from app.models.experiment import (
    ExperimentRun,
    ExperimentVersion,
)
from app.schemas.experiment_run import (
    ExperimentRunArtifactsResponse,
    ExperimentRunResponse,
    ExperimentRunResultsResponse,
)
from app.services.experiment_executor import (
    execute_experiment_run_by_id,
)
from app.services.mlflow_results import (
    get_experiment_run_artifacts,
    get_experiment_run_results,
)


router = APIRouter(
    prefix="/experiment-runs",
    tags=["experiment-runs"],
)

DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_db_session),
]


async def load_run_with_relations(
    session: AsyncSession,
    run_id: uuid.UUID,
) -> ExperimentRun | None:
    result = await session.execute(
        select(ExperimentRun)
        .options(
            selectinload(
                ExperimentRun.experiment_version
            ).selectinload(
                ExperimentVersion.experiment
            )
        )
        .where(
            ExperimentRun.id == run_id
        )
    )

    return result.scalar_one_or_none()


@router.post(
    "/versions/{version_id}",
    response_model=ExperimentRunResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_and_execute_run(
    version_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    session: DatabaseSession,
) -> ExperimentRun:
    result = await session.execute(
        select(ExperimentVersion)
        .where(
            ExperimentVersion.id == version_id
        )
    )

    version = result.scalar_one_or_none()

    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Versión de experimento "
                "no encontrada."
            ),
        )

    run = ExperimentRun(
        experiment_version_id=version.id,
        status="pending",
    )

    session.add(run)
    await session.commit()
    await session.refresh(run)

    background_tasks.add_task(
        execute_experiment_run_by_id,
        run.id,
    )

    return run


@router.get(
    "",
    response_model=list[ExperimentRunResponse],
)
async def list_experiment_runs(
    session: DatabaseSession,
) -> list[ExperimentRun]:
    result = await session.execute(
        select(ExperimentRun)
        .order_by(
            ExperimentRun.created_at.desc()
        )
    )

    return list(
        result.scalars().all()
    )


@router.get(
    "/{run_id}/results",
    response_model=ExperimentRunResultsResponse,
)
async def get_experiment_run_results_endpoint(
    run_id: uuid.UUID,
    session: DatabaseSession,
) -> ExperimentRunResultsResponse:
    run = await load_run_with_relations(
        session=session,
        run_id=run_id,
    )

    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ejecución no encontrada.",
        )

    if run.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Los resultados solo están disponibles "
                "para ejecuciones completadas."
            ),
        )

    if run.mlflow_run_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "La ejecución no tiene un run "
                "de MLflow asociado."
            ),
        )

    try:
        return await get_experiment_run_results(
            run
        )
    except MlflowException as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "MLflow no pudo recuperar "
                f"los resultados: {exc}"
            ),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "No se pudieron recuperar "
                "los resultados de MLflow: "
                f"{type(exc).__name__}: {exc}"
            ),
        ) from exc


@router.get(
    "/{run_id}/artifacts",
    response_model=ExperimentRunArtifactsResponse,
)
async def get_experiment_run_artifacts_endpoint(
    run_id: uuid.UUID,
    session: DatabaseSession,
) -> ExperimentRunArtifactsResponse:
    run = await load_run_with_relations(
        session=session,
        run_id=run_id,
    )

    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ejecución no encontrada.",
        )

    if run.mlflow_run_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "La ejecución no tiene un run "
                "de MLflow asociado."
            ),
        )

    try:
        return await get_experiment_run_artifacts(
            run
        )
    except MlflowException as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "MLflow no pudo recuperar "
                f"los artefactos: {exc}"
            ),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "No se pudieron recuperar "
                "los artefactos de MLflow: "
                f"{type(exc).__name__}: {exc}"
            ),
        ) from exc


@router.get(
    "/{run_id}",
    response_model=ExperimentRunResponse,
)
async def get_experiment_run(
    run_id: uuid.UUID,
    session: DatabaseSession,
) -> ExperimentRun:
    run = await session.get(
        ExperimentRun,
        run_id,
    )

    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ejecución no encontrada.",
        )

    return run
