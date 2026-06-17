"""Пользователи: справочник, управление (admin), поручения по учётке."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import AdminUser, CurrentUser, DbSession, ManagerialUser
from app.schemas.assignment import AssignmentRead
from app.schemas.common import Page
from app.schemas.user import UserCreate, UserDirectory, UserRead, UserUpdate
from app.services.assignments import AssignmentService
from app.services.users import UserAlreadyExistsError, UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def get_me(current: CurrentUser) -> UserRead:
    return UserRead.model_validate(current)


@router.get("/directory", response_model=list[UserDirectory])
async def directory(db: DbSession, _: CurrentUser) -> list[UserDirectory]:
    """Список пользователей для выбора участников совещания (любой авторизованный)."""
    users = await UserService(db).directory()
    return [UserDirectory.model_validate(u) for u in users]


@router.get("", response_model=Page[UserRead])
async def list_users(
    db: DbSession,
    _: AdminUser,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[UserRead]:
    items, total = await UserService(db).list(limit=limit, offset=offset)
    return Page[UserRead](
        items=[UserRead.model_validate(u) for u in items],
        total=total, limit=limit, offset=offset,
    )


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, db: DbSession, _: AdminUser) -> UserRead:
    try:
        user = await UserService(db).create(payload)
    except UserAlreadyExistsError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email занят") from None
    return UserRead.model_validate(user)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(user_id: uuid.UUID, payload: UserUpdate, db: DbSession, _: AdminUser) -> UserRead:
    service = UserService(db)
    user = await service.get(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    user = await service.update(user, payload)
    return UserRead.model_validate(user)


@router.get("/{user_id}/assignments", response_model=list[AssignmentRead])
async def user_assignments(
    user_id: uuid.UUID, db: DbSession, _: ManagerialUser
) -> list[AssignmentRead]:
    """Все поручения по конкретной учётке (для руководителей)."""
    items = await AssignmentService(db).list_for_user(user_id)
    return [AssignmentRead.model_validate(a) for a in items]
