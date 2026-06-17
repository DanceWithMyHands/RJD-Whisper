# РЖД · Протокол — Описание системы

Система автоматического документирования поручений с совещаний РЖД. Подключается
к видеоконференции (или принимает загруженный аудиофайл), расшифровывает речь,
автоматически выделяет поручения с ответственными и сроками, даёт их подтвердить,
разослать ответственным по почте и выгрузить протокол.

Этот документ состоит из двух частей: **технического описания** (архитектура, стек,
модули, данные, API) и **простого руководства** (как запустить и что делать).

---

## 1. Что система делает

Сквозной сценарий:

1. Руководитель создаёт совещание и добавляет участников **из справочника пользователей** (только заведённые администратором учётки).
2. Совещание получает аудио одним из двух путей:
   - **загрузка готового аудиофайла** (экран «Загрузка аудио»);
   - запись через бота ВКС (концепт — подключение/согласие/запись смоделировано).
3. Аудио уходит в **ASR** (распознавание речи) → получается транскрипт с таймкодами и привязкой к говорящим.
4. Транскрипт уходит в **LLM** → формируется краткое содержание и список **поручений** (заголовок, описание, ответственный, срок, приоритет).
5. Ответственные сопоставляются с участниками совещания по упоминанию ФИО.
6. Руководитель проверяет/редактирует поручения, **подтверждает** их и **рассылает** ответственным по e-mail.
7. Протокол выгружается в **JSON** или **PDF**.

Доступ ко всем действиям разграничен по ролям (см. раздел 6).

---

## 2. Технологический стек

### Бэкенд
| Слой | Технология |
|------|-----------|
| Язык / рантайм | Python 3.12 |
| Веб-фреймворк | FastAPI 0.115, Uvicorn (ASGI) |
| Валидация / настройки | Pydantic 2.10, pydantic-settings |
| ORM / БД | SQLAlchemy 2.0 (async) + asyncpg, PostgreSQL 15 |
| Миграции | Alembic 1.14 |
| Аутентификация | JWT (PyJWT), пароли — bcrypt, OAuth2 password flow |
| Объектное хранилище | boto3 → S3 / MinIO |
| Почта | aiosmtplib |
| Экспорт PDF | reportlab |
| HTTP-клиент (ASR/LLM коннекторы) | httpx |
| Загрузка файлов | python-multipart |

### Фронтенд
| Слой | Технология |
|------|-----------|
| Язык / сборка | TypeScript 5.5, Vite 5.4 |
| UI | React 18.3, Material UI 5.16 (+ icons), MUI X Date Pickers 7 |
| Данные / запросы | TanStack Query 5.59, axios 1.7 |
| Роутинг | react-router-dom 6.26 |
| Даты | dayjs |
| Стили | Emotion (через MUI) |

### Инфраструктура
Docker Compose поднимает 4 сервиса: **PostgreSQL 15**, **MinIO (S3)**, **backend**
(FastAPI + Uvicorn), **frontend** (сборка Vite → раздача через **nginx** с проксированием
`/api` на бэкенд). Миграции и демо-данные применяются автоматически при старте.

---

## 3. Архитектура бэкенда

Слоистая структура, внешние сервисы спрятаны за абстрактными интерфейсами (провайдерами),
что позволяет переключать stub ↔ реальную реализацию без изменения бизнес-логики.

```
backend/app/
  core/          config (env), database (async engine/session), security (JWT, bcrypt)
  models/        ORM-сущности + enums предметной области
  schemas/       Pydantic-схемы запросов/ответов
  providers/     внешние сервисы за интерфейсами:
                   transcription (ASR), llm (выделение поручений), bot (ВКС)
  integrations/  storage (S3/MinIO, boto3), email (aiosmtplib)
  services/      бизнес-логика: auth, users, meetings (пайплайн), assignments, export
  api/           роутеры FastAPI + deps (JWT, проверки ролей)
alembic/         миграции (0001_initial, 0002_roles)
scripts/seed.py  демо-данные (админ + 4 пользователя + демо-совещание)
tests/smoke_test.py  end-to-end проверка на SQLite (29 проверок)
entrypoint.sh    ждёт БД → alembic upgrade → seed → uvicorn
```

### Провайдеры (переключаемые реализации)

| Провайдер | Настройка | Значения | Реальная реализация |
|-----------|-----------|----------|---------------------|
| ASR (речь→текст) | `ASR_PROVIDER` | `stub` / `openai_compatible` / `nim` | Groq/OpenAI/self-hosted Whisper (`/audio/transcriptions`), Nvidia NIM |
| LLM (выделение поручений) | `LLM_PROVIDER` | `stub` / `openai_compatible` / `qwen` | Groq/OpenAI-совместимый чат (`/chat/completions`), модель Qwen3 по умолчанию |
| Бот ВКС | `BOT_PROVIDER` | `stub` | концепт подключения к Cisco Jabber / Yandex Telemost |

- **stub** для ASR/LLM работает без сети и даёт детерминированный результат — приложение полностью функционально «из коробки».
- **openai_compatible** для ASR и LLM использует один и тот же ключ Groq (Whisper + Qwen3).
- При сетевой/парсинг-ошибке реальный LLM-провайдер **деградирует к эвристике**, чтобы пайплайн совещания не падал.

Подробности развёртывания реального ASR/LLM на инфраструктуре РЖД (self-hosted Whisper/NIM,
mTLS, изоляция ПДн) — в `docs/INTEGRATIONS.md`.

---

## 4. Модель данных

Все таблицы — UUID-первичный ключ + `created_at`/`updated_at`.

| Сущность | Таблица | Ключевые поля | Связи |
|----------|---------|---------------|-------|
| **User** | `users` | email (uniq), full_name, position, department, hashed_password, **role**, is_active | автор совещаний, может быть участником |
| **Meeting** | `meetings` | title, platform, conference_url, organizer_name, scheduled/started/finished_at, duration_sec, **recording_state**, audio_object_key, **summary**, created_by_id | participants, transcript, assignments |
| **Participant** | `participants` | meeting_id, **user_id** (из справочника), name, role, email, **consent**, speaker_color/label | → meeting, → user |
| **TranscriptSegment** | `transcript_segments` | meeting_id, speaker_id, order_index, start_sec, end_sec, text | → meeting, → speaker(participant) |
| **Assignment** | `assignments` | meeting_id, **assignee_id**, source_segment_id, title, description, **due_date**, **priority**, **status**, confirmed_at, sent_at | → meeting, → assignee, → источник в транскрипте |
| **MailLog** | `mail_logs` | meeting_id, recipient_email/name, subject, body, **status**, error | журнал рассылок |

### Перечисления (enums)
- **UserRole**: `admin`, `manager`, `deputy`, `organizer` (legacy), `employee`.
- **RecordingState**: `idle → connecting → awaiting_consent → recording → paused → processing → done / failed`.
- **ConsentStatus**: `pending / granted / declined`.
- **TaskStatus** (поручение): `draft → confirmed → sent`.
- **TaskPriority**: `low / medium / high`.
- **MailStatus**: `queued / sent / failed`.
- **MeetingPlatform**: `cisco_jabber`, `yandex_telemost`.

---

## 5. Пайплайн обработки совещания

Реализован в `services/meetings.py` (`_run_pipeline`):

1. **ASR.** `get_transcription_provider(has_audio)` — если реального аудио нет (запись бота), используется stub; для загруженного файла — настроенный провайдер. Возвращает сегменты `(speaker_label, start, end, text)`.
2. **Привязка говорящих.** Метки `SPEAKER_xx` сопоставляются с участниками по `speaker_label`.
3. **Сохранение транскрипта.** Старые сегменты/поручения удаляются, пишутся новые `TranscriptSegment` с порядковым индексом и таймкодами.
4. **LLM.** `get_llm_provider().analyze(segments)` → `summary` + список `ExtractedAssignment(title, description, assignee_hint, due_hint, priority, source_index)`.
5. **Сопоставление ответственных.** `assignee_hint` (ФИО из речи) матчится с участниками по пересечению токенов имени.
6. **Резолв срока.** Текстовый срок («до пятницы») → конкретная дата относительно даты совещания.
7. **Запись поручений.** Создаются `Assignment` со ссылкой на участника-ответственного и сегмент-источник.

Дальше: подтверждение (`status=confirmed`), рассылка по e-mail (aiosmtplib, запись в `MailLog`), экспорт протокола (`export.py` → JSON / PDF через reportlab).

---

## 6. Роли и разграничение доступа

| Роль | Может |
|------|-------|
| **admin** (рут) | всё + управление пользователями (`/users`: список, создание, изменение) |
| **manager** (начальник) | создавать совещания и поручения, загрузка/запись, подтверждение и рассылка, просмотр всех данных |
| **deputy** (заместитель) | то же, что manager |
| **employee** (сотрудник) | видит **только** совещания, где он участник, и **только свои** поручения; управляющие действия скрыты в UI и запрещены на бэкенде (403) |

`MANAGERIAL_ROLES = {admin, manager, deputy, organizer}`. Защита реализована в `api/deps.py`:
`require_admin`, `require_managerial`, `get_current_user` (проверка JWT). Видимость данных
для сотрудника фильтруется в сервисе (`list_visible`, `get_detail_for_viewer`,
`/assignments/my`). **Участников совещания можно выбрать только из справочника** заведённых
пользователей.

---

## 7. API (`/api/v1`)

| Метод | Путь | Доступ | Назначение |
|-------|------|--------|-----------|
| POST | `/auth/register` | — | регистрация |
| POST | `/auth/login` | — | вход (OAuth2 password) → JWT access/refresh |
| POST | `/auth/refresh` | — | обновление токена |
| GET | `/auth/me` | любой | текущий пользователь |
| GET | `/users/directory` | любой | справочник для выбора участников |
| GET | `/users` | admin | список пользователей |
| POST | `/users` | admin | создать пользователя с ролью |
| PATCH | `/users/{id}` | admin | изменить пользователя |
| GET | `/users/{id}/assignments` | managerial | поручения конкретного сотрудника |
| GET / POST | `/meetings` | список: любой (с фильтром видимости) / создание: managerial | список / создание совещаний |
| GET | `/meetings/{id}` | viewer-aware | детально (участники, транскрипт, поручения) |
| PATCH | `/meetings/{id}` | managerial | изменить совещание |
| POST | `/meetings/{id}/connect-bot` | managerial | подключить бота ВКС |
| POST | `/meetings/{id}/consent/grant-all` | managerial | согласие всех участников |
| POST | `/meetings/{id}/participants/{pid}/consent` | managerial | согласие участника |
| POST | `/meetings/{id}/recording/start` · `/stop` | managerial | старт/стоп записи (стоп запускает пайплайн) |
| POST | `/meetings/{id}/recording/upload` | managerial | загрузка аудио в S3/MinIO |
| GET | `/meetings/{id}/recording/state` | viewer | состояние записи |
| POST | `/meetings/{id}/audio/transcribe` | managerial | загрузить аудиофайл и расшифровать |
| GET | `/meetings/{id}/export.json` · `/export.pdf` | viewer | экспорт протокола |
| GET | `/meetings/{id}/assignments` | viewer | поручения совещания |
| GET | `/assignments/my` | любой | мои поручения |
| POST | `/meetings/{id}/assignments` | managerial | создать поручение |
| PATCH | `/assignments/{id}` | managerial | изменить поручение |
| DELETE | `/assignments/{id}` | managerial | удалить поручение |
| POST | `/assignments/bulk/confirm` · `/bulk/send` | managerial | массовое подтверждение / рассылка |
| GET | `/health` · `/health/db` | — | проверки живости |

Полная интерактивная документация — **Swagger UI** на `http://localhost:8000/docs`.

---

## 8. Архитектура фронтенда

```
frontend/src/
  api/      axios-клиент (JWT + авто-refresh при 401), типы, функции эндпоинтов, tokenStore
  auth/     AuthContext (логин/логаут/текущий юзер), ProtectedRoute (редирект на /login)
  hooks/    queries.ts — обёртки TanStack Query над эндпоинтами
  store/    ActiveMeetingContext — выбранное «активное совещание» (persist в localStorage)
  components/ Layout (нав по ролям), диалоги (правка поручения, отправка письма), чипы статусов
  pages/    экраны (см. таблицу)
  theme.ts  фирменная тема (цвета РЖД)
```

| Экран | Маршрут | Доступ | Источник данных |
|-------|---------|--------|-----------------|
| Вход | `/login` | — | `POST /auth/login` |
| Дашборд | `/` | любой | список совещаний + активное |
| Новое совещание | `/connect` | managerial | `POST /meetings`, участники из `/users/directory`, согласие |
| Загрузка аудио | `/upload` | managerial | `POST /meetings/{id}/audio/transcribe` |
| Запись | `/recording` | managerial | `recording/start` · `stop` |
| Транскрипт | `/transcript` | любой | сегменты активного совещания |
| Поручения | `/assignments` | любой (свои — для employee) | CRUD, `bulk/confirm`, `bulk/send`, экспорт |
| Архив | `/archive` | любой | список совещаний |
| Пользователи | `/users` | admin | справочник, создание с ролью, поручения по сотруднику |

Навигация скрывает пункты не по роли (`managerialOnly`, `adminOnly`); все маршруты, кроме
`/login`, защищены. Токен хранится в localStorage, при 401 обновляется по refresh-токену.

---

## 9. Запуск и инфраструктура (технически)

`docker-compose.yml` (корень) поднимает `db`, `minio`, `backend`, `frontend`.
Конфигурация — через `.env` (см. `.env.example`). Бэкенд при старте (`entrypoint.sh`):
ждёт БД → `alembic upgrade head` → опционально `scripts/seed.py` (`SEED_ON_START=true`) → `uvicorn`.

Порты: фронтенд `5173`, API `8000`, MinIO API `9000` / консоль `9001`, PostgreSQL `5432`.

Ключевые переменные `.env`: `POSTGRES_*`, `S3_*`, `SECRET_KEY`, `SEED_ON_START`,
`ASR_PROVIDER`/`ASR_API_KEY`/`ASR_MODEL`, `LLM_PROVIDER`/`LLM_API_KEY`/`LLM_MODEL`.
Файл `.env` **в .gitignore** — секреты в репозиторий не попадают.

---

# Руководство пользователя (просто)

## Как запустить

Нужен установленный и запущенный **Docker Desktop**. Из корня проекта в PowerShell:

```powershell
.\start.ps1 -Fresh
```

`-Fresh` пересоздаёт базу с нуля — так роли и демо-данные лягут корректно (нужно при первом
запуске). Обычный запуск без сброса данных — просто `.\start.ps1`. Остановить — `.\start.ps1 -Down`.

На Linux/macOS то же самое: `./start.sh --fresh` / `./start.sh` / `./start.sh --down`.

Через пару минут (первая сборка дольше) откройте:
- **Приложение:** http://localhost:5173
- API (Swagger): http://localhost:8000/docs
- MinIO: http://localhost:9001 (minioadmin / minioadmin)

## Тестовые учётные записи

| Роль | E-mail | Пароль | Что может |
|------|--------|--------|-----------|
| Администратор | `admin@rzd.ru` | `admin12345` | всё + управление пользователями |
| Начальник | `a.sokolov@rzd.ru` | `manager123` | создавать совещания и поручения, рассылать |
| Заместитель | `e.miheeva@rzd.ru` | `deputy123` | как начальник |
| Сотрудник | `v.gromov@rzd.ru` | `employee123` | только свои совещания и поручения |
| Сотрудник | `o.zaytseva@rzd.ru` | `employee123` | только свои совещания и поручения |

> Демонстрационные пароли — для учебного стенда. В продакшене заменить.

## Типовой сценарий работы

1. Войдите как **начальник** (`a.sokolov@rzd.ru`).
2. **Новое совещание** → укажите название, добавьте участников из справочника, подтвердите согласие.
3. **Загрузка аудио** → выберите аудиофайл совещания. Система расшифрует речь.
4. **Транскрипт** → проверьте расшифровку с таймкодами и говорящими.
5. **Поручения** → система уже выделила задачи с ответственными и сроками. Отредактируйте при необходимости, **подтвердите** и **разошлите** ответственным.
6. Выгрузите протокол в **PDF**.
7. Войдите как **сотрудник** — увидите только совещания со своим участием и только свои поручения.

## Включить реальное распознавание и ИИ-выделение поручений

По умолчанию работают встроенные заглушки (без интернета). Чтобы включить реальные
Whisper + Qwen3 через Groq, в `.env` в корне задайте:

```
ASR_PROVIDER=openai_compatible
ASR_API_KEY=<ваш ключ Groq>
LLM_PROVIDER=openai_compatible
LLM_API_KEY=<ваш ключ Groq>
```

и перезапустите `.\start.ps1`. Модель ASR — `whisper-large-v3`, LLM — `qwen/qwen3-32b`
(можно сменить на более быструю, например `llama-3.3-70b-versatile`, через `LLM_MODEL`).

---

## Что пока не реализовано (дорожная карта)

- **Удаление совещаний и пользователей** через API/UI (удаление поручений уже есть, доступно руководителям). Деактивация пользователя возможна через `is_active`.
- **Реальная запись из ВКС** (Cisco Jabber / Yandex Telemost) — сейчас смоделирована; коннектор и ограничения описаны в `docs/INTEGRATIONS.md`.
- **Диаризация** на реальном ASR (определение говорящих) — на stub-сценарии работает по меткам, на внешнем Whisper требует отдельного шага.
- **Рассылка писем** требует настроенного SMTP (`SMTP_*` в `.env`). Без него рассылка фиксируется в журнале `MailLog`, но письма реально не отправляются.
- **Связка с Groq (Whisper + Qwen3)** подключена и компилируется, ключ валиден, но сквозной прогон реального аудио → ИИ-поручения в работающем приложении не верифицирован. При сбое провайдер деградирует к встроенной эвристике.
