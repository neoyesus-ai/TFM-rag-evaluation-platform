from abc import ABC, abstractmethod
from typing import Any

import chromadb
from chromadb.api.models.Collection import Collection

from app.core.config import settings


class VectorStoreProvider(ABC):
    @abstractmethod
    def create_collection(
        self,
        collection_name: str,
        metadata: dict[str, Any] | None = None,
    ) -> Collection:
        raise NotImplementedError

    @abstractmethod
    def add(
        self,
        collection: Collection,
        ids: list[str],
        documents: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict[str, Any]],
    ) -> None:
        raise NotImplementedError


class ChromaVectorStoreProvider(VectorStoreProvider):
    def __init__(self) -> None:
        self.client = chromadb.HttpClient(
            host=settings.chroma_host,
            port=settings.chroma_port,
        )

    def create_collection(
        self,
        collection_name: str,
        metadata: dict[str, Any] | None = None,
    ) -> Collection:
        try:
            self.client.delete_collection(
                name=collection_name
            )
        except Exception:
            pass

        return self.client.create_collection(
            name=collection_name,
            metadata=metadata or {},
        )

    def add(
        self,
        collection: Collection,
        ids: list[str],
        documents: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict[str, Any]],
    ) -> None:
        collection.add(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
        )


def create_vector_store_provider(
    provider: str = "chroma",
) -> VectorStoreProvider:
    if provider == "chroma":
        return ChromaVectorStoreProvider()

    raise ValueError(
        f"Vector store no soportado: {provider}"
    )
