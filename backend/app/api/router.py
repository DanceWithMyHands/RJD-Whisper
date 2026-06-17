"""Сборка всех роутеров API v1."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.routers import assignments, auth, health, meetings, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(meetings.router)
api_router.include_router(assignments.router)
