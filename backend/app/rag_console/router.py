from fastapi import APIRouter

from .endpoints import router

api_router = APIRouter(
    prefix="/rag-console",
    tags=["RAG Console"],
)

api_router.include_router(router)
