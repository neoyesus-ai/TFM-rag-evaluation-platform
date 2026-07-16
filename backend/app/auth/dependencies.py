import uuid
from typing import Annotated

import jwt
from fastapi import (
    Depends,
    HTTPException,
    status,
)
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import (
    decode_access_token,
)
from app.auth.service import get_user_by_id
from app.db.session import get_db_session
from app.models.user import User


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
)

DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_db_session),
]

AccessToken = Annotated[
    str,
    Depends(oauth2_scheme),
]


def credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=(
            "No se pudieron validar "
            "las credenciales."
        ),
        headers={
            "WWW-Authenticate": "Bearer",
        },
    )


async def get_current_user(
    token: AccessToken,
    session: DatabaseSession,
) -> User:
    try:
        payload = decode_access_token(
            token
        )

        subject = payload.get("sub")

        if not isinstance(subject, str):
            raise credentials_exception()

        user_id = uuid.UUID(subject)

    except (
        jwt.InvalidTokenError,
        ValueError,
        RuntimeError,
    ) as exc:
        raise credentials_exception() from exc

    user = await get_user_by_id(
        session=session,
        user_id=user_id,
    )

    if user is None:
        raise credentials_exception()

    return user


async def get_current_active_user(
    current_user: Annotated[
        User,
        Depends(get_current_user),
    ],
) -> User:
    if not current_user.is_active:
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail="El usuario está desactivado.",
        )

    return current_user


async def get_current_admin_user(
    current_user: Annotated[
        User,
        Depends(
            get_current_active_user
        ),
    ],
) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "Se requieren permisos "
                "de administración."
            ),
        )

    return current_user
