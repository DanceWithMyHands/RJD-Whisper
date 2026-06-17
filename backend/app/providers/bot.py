"""Провайдер бота видеоконференции (подключение, запрос согласия, запись).

Интерфейс BotProvider абстрагирует платформу ВКС (Cisco Jabber, Яндекс Телемост).
StubBotProvider имитирует жизненный цикл бота без реального подключения.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.core.config import settings
from app.models.enums import MeetingPlatform

logger = logging.getLogger("rzd.bot")


@dataclass(slots=True)
class BotSession:
    meeting_id: str
    platform: MeetingPlatform
    joined: bool


class BotProvider(ABC):
    """Контракт бота-участника видеоконференции."""

    @abstractmethod
    async def join(self, meeting_id: str, platform: MeetingPlatform, conference_url: str | None) -> BotSession:
        raise NotImplementedError

    @abstractmethod
    async def request_consent(self, session: BotSession) -> None:
        """Разослать участникам запрос согласия на запись."""
        raise NotImplementedError

    @abstractmethod
    async def leave(self, session: BotSession) -> None:
        raise NotImplementedError


class StubBotProvider(BotProvider):
    async def join(self, meeting_id: str, platform: MeetingPlatform, conference_url: str | None) -> BotSession:
        logger.info("Бот подключается к %s (%s)", conference_url, platform.value)
        return BotSession(meeting_id=meeting_id, platform=platform, joined=True)

    async def request_consent(self, session: BotSession) -> None:
        logger.info("Бот запросил согласие участников совещания %s", session.meeting_id)

    async def leave(self, session: BotSession) -> None:
        logger.info("Бот покинул совещание %s", session.meeting_id)


def get_bot_provider() -> BotProvider:
    """Фабрика провайдера бота согласно настройкам."""
    _ = settings.bot_provider
    return StubBotProvider()
