from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from pwdlib import PasswordHash

from app.core.config import settings


password_hasher = PasswordHash.recommended()


def hash_password(
    password: str,
) -> str:
    if not password:
        raise ValueError(
            "La contraseña no puede estar vacía."
        )

    return password_hasher.hash(password)


def verify_password(
    plain_password: str,
    password_hash: str,
) -> bool:
    try:
        return password_hasher.verify(
            plain_password,
            password_hash,
        )
    except Exception:
        return False


def create_access_token(
    *,
    user_id: str,
    username: str,
    role: str,
) -> tuple[str, int]:
    if not settings.jwt_secret_key:
        raise RuntimeError(
            "JWT_SECRET_KEY no está configurada."
        )

    expires_in_seconds = (
        settings.jwt_access_token_expire_minutes
        * 60
    )

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(
        seconds=expires_in_seconds,
    )

    payload: dict[str, Any] = {
        "sub": user_id,
        "username": username,
        "role": role,
        "iat": now,
        "exp": expires_at,
    }

    encoded_token = jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    return encoded_token, expires_in_seconds


def decode_access_token(
    token: str,
) -> dict[str, Any]:
    if not settings.jwt_secret_key:
        raise RuntimeError(
            "JWT_SECRET_KEY no está configurada."
        )

    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[
            settings.jwt_algorithm,
        ],
        options={
            "require": [
                "sub",
                "username",
                "role",
                "exp",
            ],
        },
    )
