"""Сегмент транскрипта (реплика с идентификацией говорящего)."""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.meeting import Meeting
    from app.models.participant import Participant


class TranscriptSegment(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "transcript_segments"

    meeting_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    speaker_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("participants.id", ondelete="SET NULL"), nullable=True
    )

    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    start_sec: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    end_sec: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)

    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="transcript")
    speaker: Mapped["Participant | None"] = relationship("Participant", lazy="joined")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<TranscriptSegment #{self.order_index} {self.start_sec:.0f}s>"
