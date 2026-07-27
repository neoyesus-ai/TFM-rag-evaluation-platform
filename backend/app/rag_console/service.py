from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.corpus import Corpus
from app.models.experiment import (
    Experiment,
    ExperimentRun,
    ExperimentVersion,
)


class RagConsoleService:
    """
    Independent RAG Console service.

    This module is completely isolated from the
    experimental pipeline.
    """

    async def list_runs(
        self,
        session: AsyncSession,
    ):
        stmt = (
            select(
                ExperimentRun,
                ExperimentVersion,
                Experiment,
                Corpus,
            )
            .join(
                ExperimentVersion,
                ExperimentRun.experiment_version_id
                == ExperimentVersion.id,
            )
            .join(
                Experiment,
                ExperimentVersion.experiment_id
                == Experiment.id,
            )
            .join(
                Corpus,
                Experiment.corpus_id == Corpus.id,
            )
            .where(
                ExperimentRun.status == "completed"
            )
            .order_by(
                ExperimentRun.created_at.desc()
            )
        )

        result = await session.execute(stmt)

        rows = result.all()

        runs = []

        for run, version, experiment, corpus in rows:

            embedding = version.configuration["embedding"]
            generation = version.configuration["generation"]

            runs.append(
                {
                    "run_id": run.id,
                    "experiment_id": experiment.id,
                    "experiment_name": experiment.name,
                    "version_id": version.id,
                    "version_number": version.version_number,
                    "corpus_id": corpus.id,
                    "corpus_name": corpus.name,
                    "embedding_provider": embedding["provider"],
                    "embedding_model": embedding["model"],
                    "generation_provider": generation["provider"],
                    "generation_model": generation["model"],
                    "status": run.status,
                    "created_at": run.created_at,
                }
            )

        return runs
