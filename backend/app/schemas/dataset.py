import uuid
from datetime import datetime
from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)


class EvaluationQuestionCreate(BaseModel):
    question: str = Field(
        min_length=3,
        max_length=10000,
    )

    expected_answer: str | None = Field(
        default=None,
        max_length=20000,
    )

    expected_contexts: list[str] | None = None

    metadata: dict[str, Any] = Field(
        default_factory=dict,
    )

    order_index: int | None = Field(
        default=None,
        ge=0,
    )


class EvaluationQuestionUpdate(BaseModel):
    question: str | None = Field(
        default=None,
        min_length=3,
        max_length=10000,
    )

    expected_answer: str | None = Field(
        default=None,
        max_length=20000,
    )

    expected_contexts: list[str] | None = None

    metadata: dict[str, Any] | None = None

    order_index: int | None = Field(
        default=None,
        ge=0,
    )

    @model_validator(mode="after")
    def validate_update_payload(
        self,
    ) -> "EvaluationQuestionUpdate":
        if not self.model_fields_set:
            raise ValueError(
                "Debe indicarse al menos un campo para actualizar."
            )

        return self


class EvaluationQuestionResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )

    id: uuid.UUID
    dataset_id: uuid.UUID
    question: str
    expected_answer: str | None
    expected_contexts: list[str] | None

    question_metadata: dict[str, Any] = Field(
        serialization_alias="metadata",
    )

    order_index: int
    created_at: datetime
    updated_at: datetime


class EvaluationDatasetCreate(BaseModel):
    name: str = Field(
        min_length=3,
        max_length=200,
    )

    description: str | None = Field(
        default=None,
        max_length=5000,
    )

    version: int = Field(
        default=1,
        ge=1,
    )

    status: str = Field(
        default="draft",
        pattern="^(draft|ready|archived)$",
    )

    questions: list[EvaluationQuestionCreate] = Field(
        default_factory=list,
    )

    @model_validator(mode="after")
    def validate_question_order(
        self,
    ) -> "EvaluationDatasetCreate":
        explicit_orders = [
            question.order_index
            for question in self.questions
            if question.order_index is not None
        ]

        if len(explicit_orders) != len(
            set(explicit_orders)
        ):
            raise ValueError(
                "Los valores order_index no pueden repetirse."
            )

        return self


class EvaluationDatasetUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=3,
        max_length=200,
    )

    description: str | None = Field(
        default=None,
        max_length=5000,
    )

    version: int | None = Field(
        default=None,
        ge=1,
    )

    status: str | None = Field(
        default=None,
        pattern="^(draft|ready|archived)$",
    )

    @model_validator(mode="after")
    def validate_update_payload(
        self,
    ) -> "EvaluationDatasetUpdate":
        if not self.model_fields_set:
            raise ValueError(
                "Debe indicarse al menos un campo para actualizar."
            )

        return self


class EvaluationDatasetSummaryResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: uuid.UUID
    name: str
    description: str | None
    version: int
    status: str
    created_at: datetime
    updated_at: datetime
    question_count: int = 0


class EvaluationDatasetResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: uuid.UUID
    name: str
    description: str | None
    version: int
    status: str
    created_at: datetime
    updated_at: datetime
    questions: list[
        EvaluationQuestionResponse
    ]


class EvaluationDatasetStatusUpdate(BaseModel):
    status: str = Field(
        pattern="^(draft|ready|archived)$",
    )
