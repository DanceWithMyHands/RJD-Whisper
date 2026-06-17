"""Схемы сегментов транскрипта."""
from __future__ import annotations

import uuid

from pydantic import BaseModel

from app.schemas.common import ORMModel


class TranscriptSegmentRead(ORMModel):
    id: uuid.UUID
    meeting_id: uuid.UUID
    speaker_id: uuid.UUID | None
    order_index: int
    start_sec: float
    end_sec: float
    text: str


class TranscriptSegmentCreate(BaseModel):
    speaker_id: uuid.UUID | None = None
    order_index: int = 0
    start_sec: float = 0.0
    end_sec: float = 0.0
    text: str
