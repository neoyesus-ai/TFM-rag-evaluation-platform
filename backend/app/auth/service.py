import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import (
    hash_password,
    verify_password,
)
from app.core.config import settings
from app.models.user import User


async def get_user_by_username(
    session: AsyncSession,
    username: str,
) -> User | None:
    normalized_username = username.strip().lower()

    result = await session.execute(
        select(User).where(
            User.username == normalized_username
        )
    )

    return result.scalar_one_or_none()


async def get_user_by_id(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> User | None:
    return await session.get(
        User,
        user_id,
    )


async def authenticate_user(
    session: AsyncSession,
    username: str,
    password: str,
) -> User | None:
    user = await get_user_by_username(
        session=session,
        username=username,
    )

    if user is None:
        return None

    if not user.is_active:
        return None

    if not verify_password(
        plain_password=password,
        password_hash=user.password_hash,
    ):
        return None

    return user


async def ensure_admin_user(
    session: AsyncSession,
) -> User | None:
    username = (
        settings.auth_admin_username
        .strip()
        .lower()
    )

    password = (
        settings.auth_admin_password
    )

    if not username or not password:
        return None

    existing_user = await get_user_by_username(
        session=session,
        username=username,
    )

    if existing_user is not None:
        changed = False

        if existing_user.role != "admin":
            existing_user.role = "admin"
            changed = True

        if not existing_user.is_active:
            existing_user.is_active = True
            changed = True
        
        if not verify_password(
            plain_password=password,
            password_hash=existing_user.password_hash,
        ):
            existing_user.password_hash = hash_password(
                password
            )
            changed = True

        if changed:
            await session.commit()
            await session.refresh(
                existing_user
            )

        return existing_user

    user = User(
        username=username,
        email=(
            settings.auth_admin_email
            or None
        ),
        full_name=(
            settings.auth_admin_full_name
            or "Administrador"
        ),
        password_hash=hash_password(
            password
        ),
        role="admin",
        is_active=True,
    )

    session.add(user)
    await session.commit()
    await session.refresh(user)

    return user
