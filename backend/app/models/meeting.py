"""Совещание."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import MeetingPlatform, RecordingState

if TYPE_CHECKING:
    from app.models.assignment import Assignment
    from app.models.participant import Participant
    from app.models.transcript import TranscriptSegment
    from app.models.user import User


class Meeting(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "meetings"

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    platform: Mapped[MeetingPlatform] = mapped_column(
        Enum(MeetingPlatform, name="meeting_platform"), nullable=False
    )
    conference_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)
    organizer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_sec: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    recording_state: Mapped[RecordingState] = mapped_column(
        Enum(RecordingState, name="recording_state"),
        default=RecordingState.idle,
        nullable=False,
    )
    audio_object_key: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_by: Mapped["User | None"] = relationship("User", lazy="joined")
    participants: Mapped[list["Participant"]] = relationship(
        "Participant",
        back_populates="meeting",
        cascade="all, delete-orphan",
        order_by="Participant.created_at",
    )
    transcript: Mapped[list["TranscriptSegment"]] = relationship(
        "TranscriptSegment",
        back_populates="meeting",
        cascade="all, delete-orphan",
        order_by="TranscriptSegment.order_index",
    )
    assignments: Mapped[list["Assignment"]] = relationship(
        "Assignment",
        back_populates="meeting",
        cascade="all, delete-orphan",
        order_by="Assignment.created_at",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Meeting {self.title!r} [{self.recording_state.value}]>"
