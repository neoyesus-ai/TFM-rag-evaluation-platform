import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    corpus_id: uuid.UUID
    filename: str
    content_type: str | None
    size_bytes: int
    checksum_sha256: str
    status: str
    error_message: str | None
    created_at: datetime
    updated_at: datetime
