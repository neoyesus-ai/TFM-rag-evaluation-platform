from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings


@dataclass
class GenerationResult:
    text: str
    model: str
    total_duration_ns: int
    load_duration_ns: int
    prompt_eval_count: int
    prompt_eval_duration_ns: int
    eval_count: int
    eval_duration_ns: int
    done_reason: str | None
    raw_response: dict[str, Any]


class GenerationProvider(ABC):
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        temperature: float,
    ) -> GenerationResult:
        raise NotImplementedError


class OllamaGenerationProvider(GenerationProvider):
    def __init__(
        self,
        model: str,
        timeout_seconds: float = 600.0,
    ) -> None:
        if not model.strip():
            raise ValueError(
                "El nombre del modelo de generación está vacío."
            )

        self.model = model
        self.endpoint = (
            f"http://{settings.ollama_host}:"
            f"{settings.ollama_port}/api/generate"
        )
        self.timeout = httpx.Timeout(
            timeout=timeout_seconds,
            connect=30.0,
        )

    async def generate(
        self,
        prompt: str,
        temperature: float,
    ) -> GenerationResult:
        if not prompt.strip():
            raise ValueError(
                "El prompt de generación está vacío."
            )

        async with httpx.AsyncClient(
            timeout=self.timeout,
        ) as client:
            response = await client.post(
                self.endpoint,
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                    },
                },
            )

        if response.status_code != 200:
            raise RuntimeError(
                "Ollama no pudo generar la respuesta: "
                f"HTTP {response.status_code}: "
                f"{response.text[:2000]}"
            )

        payload = response.json()
        generated_text = payload.get("response")

        if not isinstance(generated_text, str):
            raise RuntimeError(
                "La respuesta de Ollama no contiene "
                "el campo response."
            )

        return GenerationResult(
            text=generated_text.strip(),
            model=str(
                payload.get("model") or self.model
            ),
            total_duration_ns=int(
                payload.get("total_duration") or 0
            ),
            load_duration_ns=int(
                payload.get("load_duration") or 0
            ),
            prompt_eval_count=int(
                payload.get("prompt_eval_count") or 0
            ),
            prompt_eval_duration_ns=int(
                payload.get("prompt_eval_duration") or 0
            ),
            eval_count=int(
                payload.get("eval_count") or 0
            ),
            eval_duration_ns=int(
                payload.get("eval_duration") or 0
            ),
            done_reason=payload.get("done_reason"),
            raw_response=payload,
        )


def create_generation_provider(
    provider: str,
    model: str,
) -> GenerationProvider:
    if provider == "ollama":
        return OllamaGenerationProvider(
            model=model,
        )

    raise ValueError(
        f"Proveedor de generación no soportado: {provider}"
    )
