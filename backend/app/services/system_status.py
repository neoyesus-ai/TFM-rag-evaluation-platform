from collections.abc import Awaitable, Callable

import httpx
import psycopg

from app.core.config import settings
from app.schemas.system import ServiceStatus, SystemStatusResponse


async def check_postgres() -> ServiceStatus:
    try:
        connection_string = (
            f"host={settings.postgres_host} "
            f"port={settings.postgres_port} "
            f"dbname={settings.postgres_db} "
            f"user={settings.postgres_user} "
            f"password={settings.postgres_password} "
            "connect_timeout=5"
        )

        async with await psycopg.AsyncConnection.connect(
            connection_string
        ) as connection:
            async with connection.cursor() as cursor:
                await cursor.execute("SELECT 1")
                result = await cursor.fetchone()

        if result == (1,):
            return ServiceStatus(status="ok")

        return ServiceStatus(
            status="error",
            detail="PostgreSQL devolvió una respuesta inesperada.",
        )
    except Exception as exc:
        return ServiceStatus(
            status="error",
            detail=str(exc),
        )


async def check_http_service(
    url: str,
    expected_status: int = 200,
) -> ServiceStatus:
    try:
        timeout = httpx.Timeout(5.0)

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url)

        if response.status_code == expected_status:
            return ServiceStatus(status="ok")

        return ServiceStatus(
            status="error",
            detail=f"HTTP {response.status_code}",
        )
    except Exception as exc:
        return ServiceStatus(
            status="error",
            detail=str(exc),
        )


async def check_chroma() -> ServiceStatus:
    url = (
        f"http://{settings.chroma_host}:"
        f"{settings.chroma_port}/api/v2/heartbeat"
    )
    return await check_http_service(url)


async def check_ollama() -> ServiceStatus:
    url = (
        f"http://{settings.ollama_host}:"
        f"{settings.ollama_port}/api/tags"
    )
    return await check_http_service(url)


async def check_minio() -> ServiceStatus:
    url = (
        f"http://{settings.minio_host}:"
        f"{settings.minio_port}/minio/health/live"
    )
    return await check_http_service(url)


async def get_system_status() -> SystemStatusResponse:
    checks: dict[str, Callable[[], Awaitable[ServiceStatus]]] = {
        "postgres": check_postgres,
        "chroma": check_chroma,
        "ollama": check_ollama,
        "minio": check_minio,
    }

    services: dict[str, ServiceStatus] = {}

    for service_name, check in checks.items():
        services[service_name] = await check()

    global_status = (
        "ok"
        if all(service.status == "ok" for service in services.values())
        else "error"
    )

    return SystemStatusResponse(
        status=global_status,
        services=services,
    )
