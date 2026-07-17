import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenPayload(BaseModel):
    sub: str
    username: str
    role: str
    exp: int


class UserResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: uuid.UUID
    username: str
    email: str | None
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
