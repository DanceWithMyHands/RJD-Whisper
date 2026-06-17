"""Новые роли пользователей: manager, deputy

Revision ID: 0002_roles
Revises: 0001_initial
Create Date: 2026-06-16
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0002_roles"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Новые значения enum user_role
_NEW_VALUES = ("manager", "deputy")


def upgrade() -> None:
    # PostgreSQL 12+ допускает ADD VALUE в транзакции, если значение не используется в ней же.
    for value in _NEW_VALUES:
        op.execute(f"ALTER TYPE user_role ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # Значения enum в PostgreSQL нельзя удалить простым способом — оставляем как есть.
    pass
