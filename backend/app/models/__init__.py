"""ORM-модели предметной области."""
from app.models.assignment import Assignment
from app.models.base import Base
from app.models.enums import (
    ConsentStatus,
    MeetingPlatform,
    RecordingState,
    TaskPriority,
    TaskStatus,
    UserRole,
)
from app.models.mail_log import MailLog
from app.models.meeting import Meeting
from app.models.participant import Participant
from app.models.transcript import TranscriptSegment
from app.models.user import User

__all__ = [
    "Base",
    "User",
    "Meeting",
    "Participant",
    "TranscriptSegment",
    "Assignment",
    "MailLog",
    "ConsentStatus",
    "MeetingPlatform",
    "RecordingState",
    "TaskPriority",
    "TaskStatus",
    "UserRole",
]
