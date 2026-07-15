import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ExperimentRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    experiment_version_id: uuid.UUID
    mlflow_run_id: str | None
    status: str
    started_at: datetime | None
    finished_at: datetime | None
    duration_ms: int | None
    error_message: str | None
    created_at: datetime
