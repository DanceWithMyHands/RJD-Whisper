"""Конфигурация приложения через переменные окружения (pydantic-settings)."""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Общие ---
    app_name: str = "РЖД · Протокол"
    environment: Literal["local", "staging", "production"] = "local"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"

    # --- CORS ---
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )

    # --- База данных ---
    # Полный async DSN. Если задан DATABASE_URL — используется он, иначе собирается из частей.
    database_url: str | None = None
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "rzd"
    postgres_password: str = "rzd_password"
    postgres_db: str = "rzd_protocol"
    db_echo: bool = False

    # --- JWT / безопасность ---
    secret_key: str = "CHANGE_ME_IN_PRODUCTION_super_secret_key_min_32_chars"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 14

    # --- S3 / MinIO ---
    s3_endpoint_url: str | None = "http://localhost:9000"
    s3_region: str = "us-east-1"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "rzd-recordings"
    s3_use_ssl: bool = False

    # --- SMTP / почта ---
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True
    smtp_from_email: str = "no-reply@rzd-protocol.local"
    smtp_from_name: str = "РЖД · Протокол"

    # --- Провайдеры ASR / LLM / Bot ---
    # Стаб-реализации по умолчанию; реальные подключаются переключением провайдера.
    # asr_provider:
    #   stub               — детерминированный демо-транскрипт (без реального аудио)
    #   openai_compatible  — Groq / OpenAI / self-hosted Whisper (/audio/transcriptions)
    #   nim                — Nvidia NIM (концепт прод-развёртывания), REST-коннектор
    asr_provider: Literal["stub", "openai_compatible", "nim"] = "stub"
    #   stub               — эвристическое выделение поручений (регэкспы)
    #   openai_compatible  — Groq / OpenAI / self-hosted (Qwen и др.) через /chat/completions
    #   qwen               — зарезервировано под прямой коннектор Qwen
    llm_provider: Literal["stub", "openai_compatible", "qwen"] = "stub"
    bot_provider: Literal["stub"] = "stub"

    # OpenAI-совместимый ASR (по умолчанию — Groq Whisper).
    asr_api_base_url: str = "https://api.groq.com/openai/v1"
    asr_api_key: str | None = None
    asr_model: str = "whisper-large-v3"
    asr_language: str = "ru"
    asr_timeout_sec: int = 300

    # Nvidia NIM ASR (концепт прод-развёртывания на инфраструктуре РЖД).
    nim_base_url: str | None = None
    nim_api_key: str | None = None
    nim_model: str = "nvidia/parakeet-ctc-1.1b-asr"

    # OpenAI-совместимый LLM (по умолчанию — Groq, модель Qwen3).
    # Выделение поручений и краткое содержание по транскрипту (/chat/completions).
    llm_api_base_url: str = "https://api.groq.com/openai/v1"
    llm_api_key: str | None = None
    llm_model: str = "qwen/qwen3-32b"
    llm_timeout_sec: int = 120

    @computed_field  # type: ignore[prop-decorator]
    @property
    def sqlalchemy_database_uri(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
