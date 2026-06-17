"""Схемы пользователя."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import UserRole
from app.schemas.common import ORMModel


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    position: str | None = None
    department: str | None = None
    role: UserRole = UserRole.employee


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    position: str | None = None
    department: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserRead(ORMModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    position: str | None
    department: str | None
    role: UserRole
    is_active: bool
    created_at: datetime


class UserDirectory(ORMModel):
    """Облегчённая запись для выбора участников совещания."""

    id: uuid.UUID
    full_name: str
    position: str | None
    department: str | None
    email: EmailStr
    role: UserRole
