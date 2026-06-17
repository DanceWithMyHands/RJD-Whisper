"""Участник совещания."""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import ConsentStatus

if TYPE_CHECKING:
    from app.models.meeting import Meeting
    from app.models.user import User


class Participant(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "participants"

    meeting_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    consent: Mapped[ConsentStatus] = mapped_column(
        Enum(ConsentStatus, name="consent_status"),
        default=ConsentStatus.pending,
        nullable=False,
    )
    speaker_color: Mapped[str | None] = mapped_column(String(16), nullable=True)
    speaker_label: Mapped[str | None] = mapped_column(String(32), nullable=True)

    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="participants")
    user: Mapped["User | None"] = relationship("User", lazy="joined")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Participant {self.name!r} consent={self.consent.value}>"
