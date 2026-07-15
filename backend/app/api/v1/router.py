from fastapi import APIRouter

from app.api.v1.endpoints.corpora import router as corpora_router
from app.api.v1.endpoints.documents import router as documents_router
from app.api.v1.endpoints.experiment_runs import (
    router as experiment_runs_router,
)
from app.api.v1.endpoints.experiment_templates import (
    router as experiment_templates_router,
)
from app.api.v1.endpoints.experiments import (
    router as experiments_router,
)
from app.api.v1.endpoints.system import router as system_router


api_router = APIRouter()


@api_router.get(
    "/health",
    tags=["health"],
)
async def api_health() -> dict[str, str]:
    return {"status": "ok"}


api_router.include_router(system_router)
api_router.include_router(corpora_router)
api_router.include_router(documents_router)
api_router.include_router(experiment_templates_router)
api_router.include_router(experiments_router)
api_router.include_router(experiment_runs_router)
