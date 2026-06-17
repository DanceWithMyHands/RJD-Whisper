"""Схемы участника совещания."""
from __future__ import annotations

import uuid

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import ConsentStatus
from app.schemas.common import ORMModel


class ParticipantBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    role: str | None = None
    email: EmailStr | None = None
    speaker_color: str | None = Field(default=None, max_length=16)


class ParticipantCreate(ParticipantBase):
    user_id: uuid.UUID | None = None


class ParticipantUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    email: EmailStr | None = None
    speaker_color: str | None = None


class ConsentUpdate(BaseModel):
    consent: ConsentStatus


class ParticipantRead(ORMModel):
    id: uuid.UUID
    meeting_id: uuid.UUID
    user_id: uuid.UUID | None
    name: str
    role: str | None
    email: EmailStr | None
    consent: ConsentStatus
    speaker_color: str | None
    speaker_label: str | None
