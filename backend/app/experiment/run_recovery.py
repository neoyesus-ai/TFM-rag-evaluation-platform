import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.experiment import ExperimentRun


logger = logging.getLogger(__name__)

INTERRUPTED_STATUS = "interrupted"
INTERRUPTION_MESSAGE = (
    "Execution interrupted because the backend restarted "
    "before the experiment finished."
)


async def recover_orphan_experiment_runs(
    session: AsyncSession,
    *,
    recovery_time: datetime | None = None,
) -> int:
    """
    Cierra las ejecuciones que permanecieron en estado ``running``
    después de una parada o reinicio del backend.

    En el arranque de un nuevo proceso no puede existir una ejecución
    legítima iniciada por ese mismo proceso, por lo que cualquier run
    persistido como ``running`` se considera huérfano.
    """

    finished_at = recovery_time or datetime.now(timezone.utc)

    result = await session.scalars(
        select(ExperimentRun).where(
            ExperimentRun.status == "running"
        )
    )
    orphan_runs = list(result)

    for run in orphan_runs:
        run.status = INTERRUPTED_STATUS
        run.finished_at = finished_at
        run.error_message = INTERRUPTION_MESSAGE

        if run.started_at is None:
            run.duration_ms = None
            continue

        started_at = run.started_at

        # Protección para bases antiguas o datos introducidos sin zona horaria.
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)

        run.duration_ms = max(
            0,
            int(
                (
                    finished_at - started_at
                ).total_seconds()
                * 1000
            ),
        )

    if orphan_runs:
        await session.commit()

        logger.warning(
            "Se recuperaron %s ejecuciones huérfanas: "
            "running -> interrupted.",
            len(orphan_runs),
        )
    else:
        logger.info(
            "No se encontraron ejecuciones huérfanas."
        )

    return len(orphan_runs)
