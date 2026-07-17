import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.experiment import PipelineConfiguration


class ExperimentTemplateDefinition(BaseModel):
    template_key: str = Field(min_length=3, max_length=150)
    schema_version: str = "1.0"
    name: str = Field(min_length=3, max_length=200)
    description: str | None = None
    category: str = Field(default="general", max_length=100)
    tags: list[str] = []
    configuration: PipelineConfiguration
    matrix: dict[str, list[str | int | float]] | None = None


class ExperimentTemplateResponse(BaseModel):
    template_key: str
    schema_version: str
    name: str
    description: str | None
    category: str
    tags: list[str]
    configuration: PipelineConfiguration
    matrix: dict[str, list[str | int | float]] | None


class CreateExperimentFromTemplate(BaseModel):
    name: str = Field(min_length=3, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    corpus_id: uuid.UUID
    configuration_overrides: dict = {}
    git_commit: str | None = Field(default=None, max_length=64)


class SavedExperimentTemplateCreate(BaseModel):
    template_key: str = Field(min_length=3, max_length=150)
    name: str = Field(min_length=3, max_length=200)
    description: str | None = None
    category: str = Field(default="custom", max_length=100)
    tags: list[str] = []
    configuration: PipelineConfiguration
    matrix: dict[str, list[str | int | float]] | None = None


class SavedExperimentTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    template_key: str
    name: str
    description: str | None
    category: str
    schema_version: str
    tags: list
    configuration: dict
    matrix: dict | None
    is_builtin: bool
    created_at: datetime
    updated_at: datetime
