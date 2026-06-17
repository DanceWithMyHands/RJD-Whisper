# Единый запуск всего приложения РЖД · Протокол (Windows / PowerShell).
# Поднимает БД + MinIO + бэкенд + фронтенд одной командой через Docker.
#
#   .\start.ps1            - собрать и запустить
#   .\start.ps1 -Fresh     - пересоздать БД с нуля (свежие демо-данные и роли)
#   .\start.ps1 -Down      - остановить всё

param(
    [switch]$Fresh,
    [switch]$Down
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker не найден. Установите Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
}

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Создан .env из .env.example" -ForegroundColor Green
}

if ($Down) {
    docker compose down
    exit 0
}

if ($Fresh) {
    Write-Host "Пересоздаю окружение с нуля (тома БД будут удалены)..." -ForegroundColor Yellow
    docker compose down -v --remove-orphans
}

# Подробный построчный вывод сборки
$env:DOCKER_BUILDKIT = "1"
$env:COMPOSE_DOCKER_CLI_BUILD = "1"

Write-Host "Сборка образов (подробный вывод)..." -ForegroundColor Cyan
docker compose --progress=plain build
if ($LASTEXITCODE -ne 0) { Write-Error "Сборка не удалась"; exit 1 }

Write-Host "Запуск стека..." -ForegroundColor Cyan
docker compose up -d --remove-orphans

Write-Host ""
Write-Host "Готово! Сервисы:" -ForegroundColor Green
Write-Host "  Фронтенд:      http://localhost:5173"
Write-Host "  API (Swagger): http://localhost:8000/docs"
Write-Host "  MinIO консоль: http://localhost:9001  (minioadmin / minioadmin)"
Write-Host ""
Write-Host "Вход: admin@rzd.ru / admin12345"
Write-Host "Логи: docker compose logs -f"
Write-Host "Стоп: .\start.ps1 -Down"
