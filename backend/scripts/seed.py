"""Наполнение БД демонстрационными данными.

Создаёт пользователей с разными ролями и демо-совещание, прогоняет пайплайн
обработки (ASR-stub → LLM-stub), чтобы появились транскрипт и поручения.

Запуск:  python -m scripts.seed
"""
from __future__ import annotations

import asyncio
import logging

from app.core.config import settings
from app.core.database import SessionLocal, engine
from app.models import Base
from app.models.enums import MeetingPlatform, UserRole
from app.schemas.meeting import MeetingCreate
from app.schemas.user import UserCreate
from app.services.meetings import MeetingService
from app.services.users import UserService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rzd.seed")

ADMIN_EMAIL = "admin@rzd.ru"
ADMIN_PASSWORD = "admin12345"

# (ФИО, должность, email, роль, пароль)
PEOPLE = [
    ("Соколов Андрей Петрович", "Начальник дистанции пути", "a.sokolov@rzd.ru", UserRole.manager, "manager123"),
    ("Михеева Елена Сергеевна", "Заместитель по ИТ", "e.miheeva@rzd.ru", UserRole.deputy, "deputy123"),
    ("Громов Виктор Иванович", "Инженер по охране труда", "v.gromov@rzd.ru", UserRole.employee, "employee123"),
    ("Зайцева Ольга Николаевна", "Специалист отдела логистики", "o.zaytseva@rzd.ru", UserRole.employee, "employee123"),
]


async def create_tables_if_needed() -> None:
    """Для быстрого старта без alembic (dev). В проде схему создаёт alembic."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def seed() -> None:
    async with SessionLocal() as db:
        users = UserService(db)

        admin = await users.get_by_email(ADMIN_EMAIL)
        if admin is None:
            admin = await users.create(
                UserCreate(
                    email=ADMIN_EMAIL, full_name="Администратор системы",
                    role=UserRole.admin, password=ADMIN_PASSWORD, department="Аппарат управления",
                )
            )
            logger.info("Создан администратор %s / %s", ADMIN_EMAIL, ADMIN_PASSWORD)

        participant_ids = []
        for full_name, position, email, role, password in PEOPLE:
            user = await users.get_by_email(email)
            if user is None:
                user = await users.create(
                    UserCreate(
                        email=email, full_name=full_name, position=position,
                        role=role, password=password,
                        department="Дистанция пути Москва-Сортировочная",
                    )
                )
                logger.info("Создан пользователь %s (%s)", email, role.value)
            participant_ids.append(user.id)

        meetings = MeetingService(db)
        existing, _total = await meetings.list(limit=1)
        if existing:
            logger.info("Демо-совещание уже существует, пропускаю")
            return

        meeting = await meetings.create(
            MeetingCreate(
                title="Оперативное совещание дистанции пути",
                platform=MeetingPlatform.cisco_jabber,
                conference_url="https://jabber.rzd.ru/meet/operativka",
                department="Дистанция пути Москва-Сортировочная",
                organizer_name="Соколов Андрей Петрович",
                participant_ids=participant_ids,
            ),
            created_by_id=admin.id,
        )
        logger.info("Создано демо-совещание %s", meeting.id)

        await meetings.connect_bot(meeting.id)
        await meetings.grant_all_consent(meeting.id)
        await meetings.start_recording(meeting.id)
        processed = await meetings.stop_and_process(meeting.id)
        logger.info(
            "Пайплайн завершён: %d реплик, %d поручений",
            len(processed.transcript), len(processed.assignments),
        )


async def main() -> None:
    logger.info("Сидирование БД (%s)", settings.environment)
    await create_tables_if_needed()
    await seed()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
