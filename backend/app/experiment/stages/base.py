from abc import ABC, abstractmethod
from dataclasses import dataclass
import time

from app.experiment.context import ExperimentContext


@dataclass
class StageResult:
    name: str
    duration_ms: int


class ExperimentStage(ABC):
    name: str

    async def run(
        self,
        context: ExperimentContext,
    ) -> StageResult:
        started = time.perf_counter()

        await self.execute(context)

        duration_ms = int(
            (time.perf_counter() - started) * 1000
        )

        context.metrics[f"stage.{self.name}.duration_ms"] = float(
            duration_ms
        )

        return StageResult(
            name=self.name,
            duration_ms=duration_ms,
        )

    @abstractmethod
    async def execute(
        self,
        context: ExperimentContext,
    ) -> None:
        raise NotImplementedError
