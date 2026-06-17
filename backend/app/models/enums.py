"""Перечисления предметной области."""
from __future__ import annotations

import enum


class UserRole(str, enum.Enum):
    admin = "admin"          # рут — полный доступ, управление пользователями
    manager = "manager"      # начальник — создаёт совещания и поручения
    deputy = "deputy"        # заместитель — права уровня начальника
    organizer = "organizer"  # (legacy) — оставлено для совместимости
    employee = "employee"    # работяга — видит только своё


# Роли с управленческими правами (создание совещаний, поручений, рассылка)
MANAGERIAL_ROLES: frozenset[UserRole] = frozenset(
    {UserRole.admin, UserRole.manager, UserRole.deputy, UserRole.organizer}
)


class MeetingPlatform(str, enum.Enum):
    cisco_jabber = "cisco_jabber"
    yandex_telemost = "yandex_telemost"


class RecordingState(str, enum.Enum):
    idle = "idle"
    connecting = "connecting"
    awaiting_consent = "awaiting_consent"
    recording = "recording"
    paused = "paused"
    processing = "processing"
    done = "done"
    failed = "failed"


class ConsentStatus(str, enum.Enum):
    pending = "pending"
    granted = "granted"
    declined = "declined"


class TaskStatus(str, enum.Enum):
    draft = "draft"
    confirmed = "confirmed"
    sent = "sent"


class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class MailStatus(str, enum.Enum):
    queued = "queued"
    sent = "sent"
    failed = "failed"
