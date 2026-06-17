# РЖД · Протокол — система автоматического документирования совещаний

Полный стек: фронтенд (React + MUI), бэкенд (FastAPI), PostgreSQL, MinIO (S3),
распознавание речи (Whisper через Groq/OpenAI/NIM или stub) и выделение поручений.

## Запуск всего одним скриптом (нужен Docker Desktop)

Windows (PowerShell):

```powershell
.\start.ps1            # собрать и запустить весь стек
.\start.ps1 -Fresh     # пересоздать БД с нуля (свежие демо-данные и роли)
.\start.ps1 -Down      # остановить
```

Linux / macOS:

```bash
./start.sh             # собрать и запустить
./start.sh --fresh     # пересоздать БД с нуля
./start.sh --down      # остановить
```

Или напрямую: `docker compose up --build`.

После старта:
- Приложение:    http://localhost:5173
- API (Swagger): http://localhost:8000/docs
- MinIO консоль: http://localhost:9001  (minioadmin / minioadmin)

## Демо-вход

| Роль | Email | Пароль |
|------|-------|--------|
| Администратор (рут) | admin@rzd.ru | admin12345 |
| Начальник (manager) | a.sokolov@rzd.ru | manager123 |
| Заместитель (deputy) | e.miheeva@rzd.ru | deputy123 |
| Сотрудник | v.gromov@rzd.ru | employee123 |
| Сотрудник | o.zaytseva@rzd.ru | employee123 |

## Распознавание аудио

По умолчанию работает stub (демо-транскрипт). Для реального распознавания загруженных
файлов получите бесплатный ключ Groq (console.groq.com) и в .env укажите:

```
ASR_PROVIDER=openai_compatible
ASR_API_KEY=gsk_...
```

Подробнее о провайдерах, прод-развёртывании ASR на серверах РЖД и концепции бота ВКС —
в docs/INTEGRATIONS.md.

## Структура

```
backend/   FastAPI + PostgreSQL + Alembic + провайдеры ASR/LLM/bot
frontend/  React + TypeScript + MUI (собирается в nginx-образ)
docs/      документация по интеграциям
docker-compose.yml   весь стек одной командой
start.ps1 / start.sh единый запуск
```
