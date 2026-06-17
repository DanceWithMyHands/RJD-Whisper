"""End-to-end smoke-тест backend на SQLite (без Postgres/MinIO).

Проверяет: роли и привилегии, справочник пользователей, выбор участников из БД,
полный цикл совещания (бот → согласие → запись → обработка), поручения,
подтверждение, рассылку, экспорт и видимость данных для работяги.

Запуск:  python -m tests.smoke_test
"""
from __future__ import annotations

import asyncio
import os
import sys
import tempfile

_DB_FILE = os.path.join(tempfile.gettempdir(), "rzd_smoke.db")
if os.path.exists(_DB_FILE):
    os.remove(_DB_FILE)
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_DB_FILE}"
os.environ["SECRET_KEY"] = "smoke_test_secret_key_at_least_32_characters_long"
os.environ["ASR_PROVIDER"] = "stub"
os.environ["LLM_PROVIDER"] = "stub"
os.environ["SMTP_HOST"] = ""

import httpx  # noqa: E402

from app.core.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from app.models.enums import UserRole  # noqa: E402
from app.schemas.user import UserCreate  # noqa: E402
from app.services.users import UserService  # noqa: E402

PREFIX = "/api/v1"
_passed = 0
_failed = 0


def check(condition: bool, label: str) -> None:
    global _passed, _failed
    if condition:
        _passed += 1
        print(f"  PASS · {label}")
    else:
        _failed += 1
        print(f"  FAIL · {label}")


async def _seed_admin() -> None:
    async with SessionLocal() as db:
        await UserService(db).create(
            UserCreate(email="admin@rzd.ru", full_name="Админ", role=UserRole.admin, password="admin12345")
        )


async def login(c: httpx.AsyncClient, email: str, password: str) -> dict[str, str]:
    r = await c.post(f"{PREFIX}/auth/login", data={"username": email, "password": password})
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def run() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _seed_admin()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        admin = await login(c, "admin@rzd.ru", "admin12345")
        check("Authorization" in admin, "login admin")

        # самостоятельная регистрация всегда employee (без эскалации)
        r = await c.post(f"{PREFIX}/auth/register", json={
            "email": "self@rzd.ru", "full_name": "Сам Себе", "role": "admin", "password": "selfpass12",
        })
        check(r.status_code == 201 and r.json()["role"] == "employee", "register forces employee role")

        # admin создаёт пользователей с ролями
        people = [
            ("Соколов Андрей Петрович", "boss@rzd.ru", "manager", "Начальник"),
            ("Михеева Елена Сергеевна", "dep@rzd.ru", "deputy", "Зам"),
            ("Громов Виктор Иванович", "emp1@rzd.ru", "employee", "Инженер"),
            ("Зайцева Ольга Николаевна", "emp2@rzd.ru", "employee", "Логист"),
        ]
        ids: dict[str, str] = {}
        for full_name, email, role, pos in people:
            r = await c.post(f"{PREFIX}/users", headers=admin, json={
                "email": email, "full_name": full_name, "position": pos, "role": role, "password": "passw0rd1",
            })
            ids[email] = r.json()["id"]
        check(len(ids) == 4, "admin created 4 users with roles")

        # employee НЕ может создавать пользователей
        emp = await login(c, "emp1@rzd.ru", "passw0rd1")
        r = await c.post(f"{PREFIX}/users", headers=emp, json={
            "email": "x@rzd.ru", "full_name": "X", "role": "employee", "password": "passw0rd1",
        })
        check(r.status_code == 403, "employee cannot create users -> 403")

        # справочник доступен авторизованному
        r = await c.get(f"{PREFIX}/users/directory", headers=emp)
        check(r.status_code == 200 and len(r.json()) >= 5, "user directory accessible")

        # employee НЕ может создавать совещания
        r = await c.post(f"{PREFIX}/meetings", headers=emp, json={
            "title": "X", "platform": "cisco_jabber", "participant_ids": [],
        })
        check(r.status_code == 403, "employee cannot create meeting -> 403")

        # manager создаёт совещание из пользователей справочника
        boss = await login(c, "boss@rzd.ru", "passw0rd1")
        r = await c.post(f"{PREFIX}/meetings", headers=boss, json={
            "title": "Оперативное совещание",
            "platform": "cisco_jabber",
            "department": "Дистанция пути",
            "participant_ids": [ids["boss@rzd.ru"], ids["dep@rzd.ru"], ids["emp1@rzd.ru"], ids["emp2@rzd.ru"]],
        })
        check(r.status_code == 201, "manager creates meeting")
        meeting = r.json()
        m = meeting["id"]
        check(len(meeting["participants"]) == 4, "participants resolved from directory")
        check(all(p["user_id"] for p in meeting["participants"]), "participants linked to users")
        check(meeting["participants"][0]["name"] == "Соколов Андрей Петрович", "participant name taken from user")

        # несуществующий участник -> 400
        r = await c.post(f"{PREFIX}/meetings", headers=boss, json={
            "title": "Bad", "platform": "cisco_jabber",
            "participant_ids": ["00000000-0000-0000-0000-000000000000"],
        })
        check(r.status_code == 400, "unknown participant user -> 400")

        # полный цикл (manager)
        await c.post(f"{PREFIX}/meetings/{m}/connect-bot", headers=boss)
        await c.post(f"{PREFIX}/meetings/{m}/consent/grant-all", headers=boss)
        await c.post(f"{PREFIX}/meetings/{m}/recording/start", headers=boss)
        r = await c.post(f"{PREFIX}/meetings/{m}/recording/stop", headers=boss)
        processed = r.json()
        check(processed["recording_state"] == "done", "manager runs full pipeline")
        check(len(processed["transcript"]) == 9, "transcript produced")
        check(len(processed["assignments"]) >= 3, "assignments produced")

        # видимость: работяга видит только свои совещания (он участник -> видит это)
        r = await c.get(f"{PREFIX}/meetings", headers=emp)
        check(r.status_code == 200 and r.json()["total"] == 1, "employee sees only own meetings")

        # employee видит в совещании только свои поручения
        r_all = await c.get(f"{PREFIX}/meetings/{m}/assignments", headers=boss)
        r_emp = await c.get(f"{PREFIX}/meetings/{m}/assignments", headers=emp)
        check(len(r_emp.json()) <= len(r_all.json()), "employee sees subset of assignments")

        # «мои поручения»
        r = await c.get(f"{PREFIX}/assignments/my", headers=emp)
        check(r.status_code == 200, "employee my-assignments accessible")

        # поручения по конкретной учётке — руководителю можно, работяге нет
        r_boss = await c.get(f"{PREFIX}/users/{ids['emp1@rzd.ru']}/assignments", headers=boss)
        r_emp2 = await c.get(f"{PREFIX}/users/{ids['emp1@rzd.ru']}/assignments", headers=emp)
        check(r_boss.status_code == 200, "manager views per-user assignments")
        check(r_emp2.status_code == 403, "employee cannot view others' assignments -> 403")

        # employee не может подтверждать/рассылать
        all_ids = [a["id"] for a in r_all.json()]
        r = await c.post(f"{PREFIX}/assignments/bulk/confirm", headers=emp, json={"ids": all_ids})
        check(r.status_code == 403, "employee cannot confirm -> 403")

        # manager подтверждает и рассылает
        r = await c.post(f"{PREFIX}/assignments/bulk/confirm", headers=boss, json={"ids": all_ids})
        check(r.status_code == 200 and r.json()["affected"] >= 3, "manager confirms")
        r = await c.post(f"{PREFIX}/assignments/bulk/send", headers=boss, json={"ids": all_ids})
        check(r.status_code == 200 and r.json()["affected"] >= 1, "manager sends")

        # экспорт
        r = await c.get(f"{PREFIX}/meetings/{m}/export.pdf", headers=boss)
        check(r.status_code == 200 and r.content[:4] == b"%PDF", "export PDF")

        # загрузка аудио (stub ASR -> канонический транскрипт)
        r = await c.post(f"{PREFIX}/meetings", headers=boss, json={
            "title": "Загрузка аудио", "platform": "cisco_jabber",
            "participant_ids": [ids["boss@rzd.ru"], ids["emp1@rzd.ru"]],
        })
        um = r.json()["id"]
        r = await c.post(
            f"{PREFIX}/meetings/{um}/audio/transcribe", headers=boss,
            files={"file": ("rec.mp3", b"FAKEAUDIODATA", "audio/mpeg")},
        )
        check(r.status_code == 200 and r.json()["recording_state"] == "done", "audio upload transcribed")
        check(len(r.json()["transcript"]) == 9, "uploaded audio produced transcript")
        r = await c.post(
            f"{PREFIX}/meetings/{um}/audio/transcribe", headers=emp,
            files={"file": ("rec.mp3", b"x", "audio/mpeg")},
        )
        check(r.status_code == 403, "employee cannot upload audio -> 403")
        r = await c.post(
            f"{PREFIX}/meetings/{um}/audio/transcribe", headers=boss,
            files={"file": ("notes.txt", b"x", "text/plain")},
        )
        check(r.status_code == 415, "unsupported format -> 415")

        # admin видит список пользователей
        r = await c.get(f"{PREFIX}/users", headers=admin)
        check(r.status_code == 200 and r.json()["total"] >= 5, "admin lists users")
        r = await c.get(f"{PREFIX}/users", headers=emp)
        check(r.status_code == 403, "employee cannot list users -> 403")

    await engine.dispose()


def main() -> int:
    print("=== SMOKE TEST: РЖД · Протокол backend (роли) ===")
    asyncio.run(run())
    print(f"\nИтог: PASSED={_passed}  FAILED={_failed}")
    if os.path.exists(_DB_FILE):
        os.remove(_DB_FILE)
    return 1 if _failed else 0


if __name__ == "__main__":
    sys.exit(main())
