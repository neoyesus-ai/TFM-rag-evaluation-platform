from fastapi import APIRouter, Response, status

from app.schemas.system import SystemStatusResponse
from app.services.system_status import get_system_status


router = APIRouter(prefix="/system", tags=["system"])


@router.get(
    "/status",
    response_model=SystemStatusResponse,
)
async def system_status(response: Response) -> SystemStatusResponse:
    result = await get_system_status()

    if result.status == "error":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return result
