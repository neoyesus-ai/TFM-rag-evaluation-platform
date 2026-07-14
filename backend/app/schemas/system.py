from typing import Literal

from pydantic import BaseModel


ServiceState = Literal["ok", "error"]


class ServiceStatus(BaseModel):
    status: ServiceState
    detail: str | None = None


class SystemStatusResponse(BaseModel):
    status: ServiceState
    services: dict[str, ServiceStatus]
