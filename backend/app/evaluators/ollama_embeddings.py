import asyncio
from typing import Any

import httpx
from ragas.embeddings import BaseRagasEmbeddings
from ragas.run_config import RunConfig

from app.core.config import settings


class OllamaRagasEmbeddings(BaseRagasEmbeddings):
    """
    Adaptador entre RAGAS y el endpoint nativo de embeddings de Ollama.

    Utiliza POST /api/embed, evitando las incompatibilidades detectadas
    en el endpoint compatible con OpenAI /v1/embeddings.
    """

    def __init__(
        self,
        model: str = "nomic-embed-text",
        timeout_seconds: float = 300.0,
    ) -> None:
        super().__init__()

        self.model = model
        self.timeout_seconds = timeout_seconds
        self.endpoint = (
            f"http://{settings.ollama_host}:"
            f"{settings.ollama_port}/api/embed"
        )

        self.run_config = RunConfig(
            timeout=timeout_seconds,
            max_retries=1,
        )

    def _extract_embeddings(
        self,
        payload: dict[str, Any],
    ) -> list[list[float]]:
        embeddings = payload.get("embeddings")

        if not isinstance(embeddings, list):
            raise RuntimeError(
                "Ollama no devolvió el campo 'embeddings'."
            )

        if not embeddings:
            raise RuntimeError(
                "Ollama devolvió una lista de embeddings vacía."
            )

        return [
            [float(value) for value in embedding]
            for embedding in embeddings
        ]

    def embed_documents(
        self,
        texts: list[str],
    ) -> list[list[float]]:
        if not texts:
            return []

        with httpx.Client(
            timeout=self.timeout_seconds,
        ) as client:
            response = client.post(
                self.endpoint,
                json={
                    "model": self.model,
                    "input": texts,
                },
            )

            response.raise_for_status()

            return self._extract_embeddings(
                response.json()
            )

    def embed_query(
        self,
        text: str,
    ) -> list[float]:
        embeddings = self.embed_documents([text])
        return embeddings[0]

    async def aembed_documents(
        self,
        texts: list[str],
    ) -> list[list[float]]:
        if not texts:
            return []

        async with httpx.AsyncClient(
            timeout=self.timeout_seconds,
        ) as client:
            response = await client.post(
                self.endpoint,
                json={
                    "model": self.model,
                    "input": texts,
                },
            )

            response.raise_for_status()

            return self._extract_embeddings(
                response.json()
            )

    async def aembed_query(
        self,
        text: str,
    ) -> list[float]:
        embeddings = await self.aembed_documents(
            [text]
        )

        return embeddings[0]
