from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from fastapi.security import (
    OAuth2PasswordRequestForm,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    get_current_active_user,
)
from app.auth.schemas import (
    TokenResponse,
    UserResponse,
)
from app.auth.security import (
    create_access_token,
)
from app.auth.service import (
    authenticate_user,
)
from app.db.session import get_db_session
from app.models.user import User


router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
)

DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_db_session),
]

LoginForm = Annotated[
    OAuth2PasswordRequestForm,
    Depends(),
]

CurrentUser = Annotated[
    User,
    Depends(get_current_active_user),
]


@router.post(
    "/login",
    response_model=TokenResponse,
)
async def login(
    form_data: LoginForm,
    session: DatabaseSession,
) -> TokenResponse:
    user = await authenticate_user(
        session=session,
        username=form_data.username,
        password=form_data.password,
    )

    if user is None:
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Usuario o contraseña "
                "incorrectos."
            ),
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    access_token, expires_in = (
        create_access_token(
            user_id=str(user.id),
            username=user.username,
            role=user.role,
        )
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
    )


@router.get(
    "/me",
    response_model=UserResponse,
)
async def get_me(
    current_user: CurrentUser,
) -> User:
    return current_user


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def logout(
    current_user: CurrentUser,
) -> None:
    del current_user
    return None
