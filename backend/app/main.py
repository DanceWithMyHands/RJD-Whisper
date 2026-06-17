"""Точка входа FastAPI-приложения «РЖД · Протокол»."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("rzd")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Запуск %s (env=%s)", settings.app_name, settings.environment)
    yield
    logger.info("Остановка приложения")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Система автоматического документирования поручений с совещаний РЖД",
    openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/", tags=["root"])
async def root() -> dict[str, str]:
    return {
        "service": settings.app_name,
        "docs": "/docs",
        "api": settings.api_v1_prefix,
    }
