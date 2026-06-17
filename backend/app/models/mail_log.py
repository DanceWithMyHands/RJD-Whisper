"""Журнал рассылки писем по поручениям (аудит)."""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import MailStatus

if TYPE_CHECKING:
    from app.models.meeting import Meeting


class MailLog(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "mail_logs"

    meeting_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), nullable=True, index=True
    )
    recipient_email: Mapped[str] = mapped_column(String(320), nullable=False)
    recipient_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[MailStatus] = mapped_column(
        Enum(MailStatus, name="mail_status"),
        default=MailStatus.queued,
        nullable=False,
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    meeting: Mapped["Meeting | None"] = relationship("Meeting", lazy="select")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<MailLog -> {self.recipient_email} [{self.status.value}]>"
