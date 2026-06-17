"""Схемы совещаний."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import MeetingPlatform, RecordingState
from app.schemas.assignment import AssignmentRead
from app.schemas.common import ORMModel
from app.schemas.participant import ParticipantRead
from app.schemas.transcript import TranscriptSegmentRead


class MeetingBase(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    platform: MeetingPlatform
    conference_url: str | None = None
    department: str | None = None
    organizer_name: str | None = None
    scheduled_at: datetime | None = None


class MeetingCreate(MeetingBase):
    # Участники добавляются только из справочника пользователей (по их id)
    participant_ids: list[uuid.UUID] = Field(default_factory=list)


class MeetingUpdate(BaseModel):
    title: str | None = None
    department: str | None = None
    organizer_name: str | None = None
    scheduled_at: datetime | None = None


class MeetingRead(ORMModel):
    id: uuid.UUID
    title: str
    platform: MeetingPlatform
    conference_url: str | None
    department: str | None
    organizer_name: str | None
    scheduled_at: datetime | None
    started_at: datetime | None
    finished_at: datetime | None
    duration_sec: int
    recording_state: RecordingState
    audio_object_key: str | None
    summary: str | None
    created_at: datetime


class MeetingDetail(MeetingRead):
    participants: list[ParticipantRead]
    transcript: list[TranscriptSegmentRead]
    assignments: list[AssignmentRead]


class RecordingStateRead(BaseModel):
    meeting_id: uuid.UUID
    recording_state: RecordingState
    duration_sec: int
