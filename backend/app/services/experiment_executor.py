import logging
import uuid

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import AsyncSessionLocal
from app.experiment.runner import execute_experiment_run
from app.models.experiment import (
    ExperimentRun,
    ExperimentVersion,
)

logger = logging.getLogger(__name__)


async def execute_experiment_run_by_id(
    run_id: uuid.UUID,
) -> None:
    """
    Ejecuta un experimento utilizando una sesión
    independiente de la petición HTTP.
    """

    async with AsyncSessionLocal() as session:
        try:
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

            run = result.scalar_one_or_none()

            if run is None:
                logger.error(
                    "Run %s no encontrado.",
                    run_id,
                )
                return

            version = run.experiment_version
            experiment = version.experiment

            logger.info(
                "Ejecutando run %s en background",
                run.id,
            )

            await execute_experiment_run(
                session=session,
                experiment=experiment,
                version=version,
                run=run,
            )

            logger.info(
                "Run %s finalizado (%s)",
                run.id,
                run.status,
            )

        except Exception:
            await session.rollback()
            logger.exception(
                "Error ejecutando el run %s",
                run_id,
            )
