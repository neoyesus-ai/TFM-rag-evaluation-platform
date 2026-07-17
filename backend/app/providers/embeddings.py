from abc import ABC, abstractmethod

import httpx

from app.core.config import settings


class EmbeddingProvider(ABC):
    @abstractmethod
    async def embed_documents(
        self,
        texts: list[str],
    ) -> list[list[float]]:
        raise NotImplementedError

    @abstractmethod
    async def embed_query(
        self,
        text: str,
    ) -> list[float]:
        raise NotImplementedError


class OllamaEmbeddingProvider(EmbeddingProvider):
    def __init__(
        self,
        model: str,
        batch_size: int = 16,
        timeout_seconds: float = 300.0,
    ) -> None:
        if batch_size < 1:
            raise ValueError(
                "El tamaño del lote debe ser mayor que cero."
            )

        self.model = model
        self.batch_size = batch_size
        self.timeout = httpx.Timeout(timeout_seconds)

        self.endpoint = (
            f"http://{settings.ollama_host}:"
            f"{settings.ollama_port}/api/embed"
        )

    async def _embed_batch(
        self,
        texts: list[str],
    ) -> list[list[float]]:
        async with httpx.AsyncClient(
            timeout=self.timeout,
        ) as client:
            response = await client.post(
                self.endpoint,
                json={
                    "model": self.model,
                    "input": texts,
                    "truncate": True,
                },
            )

        if response.status_code != 200:
            raise RuntimeError(
                "Ollama no pudo generar los embeddings: "
                f"HTTP {response.status_code}: "
                f"{response.text[:1000]}"
            )

        payload = response.json()
        embeddings = payload.get("embeddings")

        if not isinstance(embeddings, list):
            raise RuntimeError(
                "La respuesta de Ollama no contiene embeddings."
            )

        if len(embeddings) != len(texts):
            raise RuntimeError(
                "Ollama devolvió un número inesperado "
                "de embeddings."
            )

        return embeddings

    async def embed_documents(
        self,
        texts: list[str],
    ) -> list[list[float]]:
        if not texts:
            return []

        embeddings: list[list[float]] = []

        for start in range(
            0,
            len(texts),
            self.batch_size,
        ):
            batch = texts[
                start:start + self.batch_size
            ]

            batch_embeddings = await self._embed_batch(
                batch
            )

            embeddings.extend(batch_embeddings)

        return embeddings

    async def embed_query(
        self,
        text: str,
    ) -> list[float]:
        embeddings = await self._embed_batch([text])

        if not embeddings:
            raise RuntimeError(
                "Ollama no devolvió el embedding de la consulta."
            )

        return embeddings[0]


def create_embedding_provider(
    provider: str,
    model: str,
) -> EmbeddingProvider:
    if provider == "ollama":
        return OllamaEmbeddingProvider(
            model=model,
        )

    raise ValueError(
        f"Proveedor de embeddings no soportado: {provider}"
    )
