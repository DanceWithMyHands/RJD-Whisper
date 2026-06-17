"""Аутентификация: регистрация, вход (OAuth2 password flow), обновление токена."""
from __future__ import annotations

import uuid
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import CurrentUser, DbSession
from app.core.security import decode_token
from app.models.enums import UserRole
from app.schemas.auth import RefreshRequest, Token
from app.schemas.user import UserCreate, UserRead
from app.services.auth import AuthService, InactiveUserError, InvalidCredentialsError
from app.services.users import UserAlreadyExistsError, UserService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: DbSession) -> UserRead:
    service = UserService(db)
    # Самостоятельная регистрация всегда создаёт учётку с минимальными правами;
    # привилегированные роли назначает только администратор через /users.
    payload = payload.model_copy(update={"role": UserRole.employee})
    try:
        user = await service.create(payload)
    except UserAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким email уже существует",
        ) from None
    return UserRead.model_validate(user)


@router.post("/login", response_model=Token)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DbSession,
) -> Token:
    service = AuthService(db)
    try:
        # username в OAuth2-форме используется как email
        user = await service.authenticate(form_data.username, form_data.password)
    except InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except InactiveUserError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Учётная запись отключена"
        ) from None
    return service.issue_tokens(user)


@router.post("/refresh", response_model=Token)
async def refresh(payload: RefreshRequest, db: DbSession) -> Token:
    service = AuthService(db)
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise ValueError("not a refresh token")
        subject = data["sub"]
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Невалидный refresh-токен"
        ) from None
    user = await UserService(db).get(uuid.UUID(subject))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь недоступен")
    return service.issue_tokens(user)


@router.get("/me", response_model=UserRead)
async def me(current: CurrentUser) -> UserRead:
    return UserRead.model_validate(current)
