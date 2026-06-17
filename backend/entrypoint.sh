#!/usr/bin/env bash
set -e

echo "Ожидание базы данных..."
python - <<'PY'
import asyncio, sys
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings

async def wait():
    for attempt in range(30):
        try:
            engine = create_async_engine(settings.sqlalchemy_database_uri)
            async with engine.connect():
                pass
            await engine.dispose()
            print("База данных доступна")
            return
        except Exception as exc:
            print(f"  попытка {attempt + 1}/30: {exc}")
            await asyncio.sleep(2)
    sys.exit("Не удалось подключиться к БД")

asyncio.run(wait())
PY

echo "Применение миграций Alembic..."
alembic upgrade head

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "Сидирование демо-данными..."
  python -m scripts.seed || echo "Сидирование пропущено/завершилось с ошибкой"
fi

echo "Запуск API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers
