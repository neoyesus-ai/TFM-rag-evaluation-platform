import uuid
from typing import Any

from pydantic import BaseModel, Field, field_validator


class RagConsoleQueryRequest(BaseModel):
    run_id: uuid.UUID

    question: str = Field(
        min_length=1,
        max_length=5000,
    )

    @field_validator("question")
    @classmethod
    def validate_question(
        cls,
        value: str,
    ) -> str:
        normalized = value.strip()

        if not normalized:
            raise ValueError(
                "La pregunta no puede estar vacía."
            )

        return normalized


class RagConsoleRetrievedContext(BaseModel):
    rank: int
    chunk_id: str
    text: str
    metadata: dict[str, Any]
    distance: float
    similarity: float


class RagConsoleQueryResponse(BaseModel):
    run_id: uuid.UUID
    question: str
    answer: str

    contexts: list[
        RagConsoleRetrievedContext
    ]

    collection_name: str

    embedding_provider: str
    embedding_model: str

    generation_provider: str
    generation_model: str

    retrieval_strategy: str
    top_k: int
    temperature: float

    retrieval_time_ms: int
    generation_time_ms: int
    total_time_ms: int

    prompt_eval_count: int
    generated_token_count: int
    done_reason: str | None
