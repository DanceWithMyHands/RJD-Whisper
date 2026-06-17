"""Отправка электронной почты (aiosmtplib).

Если SMTP не сконфигурирован (smtp_host пуст), письма не теряются, а пишутся
в лог в режиме «console» и считаются доставленными — удобно для локальной
разработки. В продакшене задаётся реальный SMTP через переменные окружения.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from email.message import EmailMessage

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger("rzd.email")


@dataclass(slots=True)
class SendResult:
    ok: bool
    error: str | None = None


class EmailService:
    def _build_message(self, to_email: str, to_name: str | None, subject: str, body: str) -> EmailMessage:
        msg = EmailMessage()
        msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
        msg["To"] = f"{to_name} <{to_email}>" if to_name else to_email
        msg["Subject"] = subject
        msg.set_content(body)
        return msg

    async def send(self, to_email: str, to_name: str | None, subject: str, body: str) -> SendResult:
        if not settings.smtp_host:
            logger.info(
                "[CONSOLE EMAIL] -> %s | %s\n%s", to_email, subject, body
            )
            return SendResult(ok=True)

        message = self._build_message(to_email, to_name, subject, body)
        try:
            await aiosmtplib.send(
                message,
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_user,
                password=settings.smtp_password,
                start_tls=settings.smtp_use_tls,
                timeout=20,
            )
            return SendResult(ok=True)
        except Exception as exc:  # noqa: BLE001 — логируем любую ошибку доставки
            logger.warning("Ошибка отправки письма на %s: %s", to_email, exc)
            return SendResult(ok=False, error=str(exc))


def get_email_service() -> EmailService:
    return EmailService()
