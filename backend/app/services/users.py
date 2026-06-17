"""Сервис пользователей."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


class UserAlreadyExistsError(Exception):
    pass


class UserService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, user_id: uuid.UUID) -> User | None:
        return await self.db.get(User, user_id)

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email.lower()))
        return result.scalar_one_or_none()

    async def list(self, limit: int = 50, offset: int = 0) -> tuple[list[User], int]:
        from sqlalchemy import func

        total = (await self.db.execute(select(func.count()).select_from(User))).scalar_one()
        rows = (
            await self.db.execute(
                select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
            )
        ).scalars().all()
        return list(rows), int(total)

    async def directory(self) -> list[User]:
        """Справочник активных пользователей для выбора участников совещания."""
        rows = (
            await self.db.execute(
                select(User).where(User.is_active.is_(True)).order_by(User.full_name)
            )
        ).scalars().all()
        return list(rows)

    async def create(self, payload: UserCreate) -> User:
        if await self.get_by_email(payload.email):
            raise UserAlreadyExistsError(payload.email)
        user = User(
            email=payload.email.lower(),
            full_name=payload.full_name,
            position=payload.position,
            department=payload.department,
            role=payload.role,
            hashed_password=hash_password(payload.password),
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update(self, user: User, payload: UserUpdate) -> User:
        data = payload.model_dump(exclude_unset=True)
        if "password" in data and data["password"]:
            user.hashed_password = hash_password(data.pop("password"))
        else:
            data.pop("password", None)
        for field, value in data.items():
            setattr(user, field, value)
        await self.db.commit()
        await self.db.refresh(user)
        return user
