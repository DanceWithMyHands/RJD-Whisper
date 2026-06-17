"""Схемы поручений."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.enums import TaskPriority, TaskStatus
from app.schemas.common import ORMModel


class AssignmentBase(BaseModel):
    title: str = Field(min_length=1, max_length=1000)
    description: str | None = None
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None
    priority: TaskPriority = TaskPriority.medium


class AssignmentCreate(AssignmentBase):
    source_segment_id: uuid.UUID | None = None


class AssignmentUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=1000)
    description: str | None = None
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None
    priority: TaskPriority | None = None
    status: TaskStatus | None = None


class AssignmentRead(ORMModel):
    id: uuid.UUID
    meeting_id: uuid.UUID
    assignee_id: uuid.UUID | None
    source_segment_id: uuid.UUID | None
    title: str
    description: str | None
    due_date: date | None
    priority: TaskPriority
    status: TaskStatus
    confirmed_at: datetime | None
    sent_at: datetime | None
    created_at: datetime


class BulkIdsRequest(BaseModel):
    ids: list[uuid.UUID] = Field(min_length=1)


class BulkActionResult(BaseModel):
    affected: int
    ids: list[uuid.UUID]
