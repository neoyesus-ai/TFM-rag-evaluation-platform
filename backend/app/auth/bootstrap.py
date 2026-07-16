import asyncio

from app.auth.service import (
    ensure_admin_user,
)
from app.db.session import (
    AsyncSessionLocal,
)


async def bootstrap() -> None:
    async with AsyncSessionLocal() as session:
        user = await ensure_admin_user(
            session
        )

        if user is None:
            print(
                "Administrador inicial no creado: "
                "faltan AUTH_ADMIN_USERNAME "
                "o AUTH_ADMIN_PASSWORD."
            )
            return

        print(
            "Administrador inicial disponible: "
            f"{user.username}"
        )


if __name__ == "__main__":
    asyncio.run(bootstrap())
