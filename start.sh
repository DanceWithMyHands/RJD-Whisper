#!/usr/bin/env bash
# Единый запуск всего приложения РЖД · Протокол (Linux/macOS).
#   ./start.sh          - собрать и запустить
#   ./start.sh --fresh  - пересоздать БД с нуля
#   ./start.sh --down   - остановить всё
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not found: https://docs.docker.com/get-docker/" >&2
  exit 1
fi

[ -f .env ] || { cp .env.example .env; echo "Created .env from .env.example"; }

case "${1:-}" in
  --down) docker compose down; exit 0 ;;
  --fresh) echo "Recreating from scratch..."; docker compose down -v --remove-orphans ;;
esac

echo "Building and starting stack..."
docker compose --progress=plain build && docker compose up -d --remove-orphans

echo ""
echo "Ready! Frontend: http://localhost:5173 | API: http://localhost:8000/docs | MinIO: http://localhost:9001"
echo "Login: admin@rzd.ru / admin12345"
echo "Logs: docker compose logs -f | Stop: ./start.sh --down"
