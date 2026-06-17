# РЖД · Протокол — Backend

Production-ready бэкенд системы автоматического документирования совещаний РЖД.
Стек по ТЗ: **Python 3.12, FastAPI, PostgreSQL 15, S3 (MinIO), Docker**.
Асинхронный SQLAlchemy 2.0 + Alembic, JWT-аутентификация.

## Архитектура

```
app/
  core/          конфигурация, БД (async), безопасность (JWT, bcrypt)
  models/        ORM-сущности: User, Meeting, Participant, TranscriptSegment, Assignment, MailLog
  schemas/       Pydantic-схемы запросов/ответов
  providers/     интерфейсы внешних сервисов + stub-реализации:
                   transcription (ASR/Whisper), llm (Qwen), bot (ВКС)
  integrations/  S3/MinIO (boto3), Email (aiosmtplib)
  services/      бизнес-логика: auth, users, meetings (пайплайн), assignments, export (JSON/PDF)
  api/           роутеры FastAPI + зависимости (JWT)
alembic/         миграции
scripts/seed.py  демо-данные
tests/smoke_test.py  end-to-end проверка на SQLite
```

### Провайдеры (чистые интерфейсы)

ASR, LLM и бот ВКС вынесены за абстрактные интерфейсы (`providers/`).
Сейчас активны рабочие **stub-реализации**, дающие детерминированный транскрипт
и эвристическое выделение поручений — вся бизнес-логика полностью функциональна.
Реальные Whisper / Qwen / платформы ВКС подключаются переключением провайдера
(`ASR_PROVIDER`, `LLM_PROVIDER`) без изменения остального кода.

## Запуск через Docker (рекомендуется)

```bash
cd backend
cp .env.example .env          # при необходимости отредактируйте
docker compose up --build
```

Поднимутся:
- **PostgreSQL 15** — `localhost:5432`
- **MinIO (S3)** — API `localhost:9000`, консоль `localhost:9001` (minioadmin/minioadmin)
- **Backend** — `localhost:8000`, миграции и демо-данные применяются автоматически

Документация API: http://localhost:8000/docs

## Тестовые учётные записи

Демо-данные засеваются автоматически при старте (`SEED_ON_START=true`).
Чтобы роли легли корректно при первом запуске, пересоздайте том БД:
`docker compose down -v && docker compose up --build`.

| Роль | Email | Пароль | Права |
|------|-------|--------|-------|
| Администратор (рут) | `admin@rzd.ru` | `admin12345` | всё + управление пользователями (`/users`) |
| Начальник (manager) | `a.sokolov@rzd.ru` | `manager123` | совещания, поручения, рассылка |
| Заместитель (deputy) | `e.miheeva@rzd.ru` | `deputy123` | как начальник |
| Сотрудник (employee) | `v.gromov@rzd.ru` | `employee123` | только свои совещания и поручения |
| Сотрудник (employee) | `o.zaytseva@rzd.ru` | `employee123` | только свои совещания и поручения |

> Учебный стенд: пароли демонстрационные, в продакшене замените.

## Локальный запуск без Docker

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# нужен запущенный PostgreSQL; параметры — в .env
alembic upgrade head
python -m scripts.seed            # демо-данные (опционально)
uvicorn app.main:app --reload
```

## Основные эндпоинты (`/api/v1`)

| Метод | Путь | Назначение |
|-------|------|-----------|
| POST | `/auth/register` | регистрация |
| POST | `/auth/login` | вход (OAuth2 password), выдаёт JWT |
| POST | `/auth/refresh` | обновление токена |
| GET | `/auth/me` | текущий пользователь |
| GET/POST | `/meetings` | список / создание совещаний |
| GET | `/meetings/{id}` | детально (участники, транскрипт, поручения) |
| POST | `/meetings/{id}/connect-bot` | подключить бота, запросить согласие |
| POST | `/meetings/{id}/consent/grant-all` | согласие всех участников |
| POST | `/meetings/{id}/participants/{pid}/consent` | согласие участника |
| POST | `/meetings/{id}/recording/start` | начать запись (только при согласии всех) |
| POST | `/meetings/{id}/recording/stop` | остановить и обработать (ASR→LLM→поручения) |
| POST | `/meetings/{id}/recording/upload` | загрузить аудио в S3/MinIO |
| GET | `/meetings/{id}/export.json` · `/export.pdf` | экспорт протокола |
| GET/POST | `/meetings/{id}/assignments` | поручения совещания |
| PATCH/DELETE | `/assignments/{id}` | редактирование/удаление |
| POST | `/assignments/bulk/confirm` | массовое подтверждение |
| POST | `/assignments/bulk/send` | рассылка ответственным по почте |

## Проверка

```bash
python -m tests.smoke_test
```

Прогоняет полный сценарий на SQLite (Postgres/MinIO не требуются) и печатает PASSED/FAILED.

## Безопасность

- Пароли — bcrypt; токены — JWT (access/refresh) с типизацией и сроком жизни.
- Все эндпоинты, кроме регистрации/логина/health, требуют Bearer-токен.
- Управление пользователями — только роль `admin`.
- В проде обязательно задать собственный `SECRET_KEY` и реальный SMTP.
