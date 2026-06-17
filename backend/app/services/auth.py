"""Сервис аутентификации."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import Token
from app.services.users import UserService


class InvalidCredentialsError(Exception):
    pass


class InactiveUserError(Exception):
    pass


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.users = UserService(db)

    async def authenticate(self, email: str, password: str) -> User:
        user = await self.users.get_by_email(email)
        if user is None or not verify_password(password, user.hashed_password):
            raise InvalidCredentialsError
        if not user.is_active:
            raise InactiveUserError
        return user

    def issue_tokens(self, user: User) -> Token:
        subject = str(user.id)
        return Token(
            access_token=create_access_token(subject),
            refresh_token=create_refresh_token(subject),
        )
