import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    status: str
    module: str


class RagConsoleCorpusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class RagConsoleRunResponse(BaseModel):
    run_id: uuid.UUID

    experiment_id: uuid.UUID
    experiment_name: str

    version_id: uuid.UUID
    version_number: int

    corpus_id: uuid.UUID
    corpus_name: str

    embedding_provider: str
    embedding_model: str

    generation_provider: str
    generation_model: str

    status: str
    created_at: datetime
