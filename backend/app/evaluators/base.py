from abc import ABC, abstractmethod
from typing import Any


class Evaluator(ABC):
    """
    Interfaz base para todos los evaluadores.
    """

    @abstractmethod
    async def evaluate(
        self,
        result: dict[str, Any],
    ) -> dict[str, Any]:
        raise NotImplementedError
