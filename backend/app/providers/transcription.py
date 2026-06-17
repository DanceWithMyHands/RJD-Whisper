"""Провайдеры распознавания речи (ASR).

Интерфейс TranscriptionProvider абстрагирует ASR-движок и принимает байты аудио.
Реализации:
  • StubTranscriptionProvider          — детерминированный демо-транскрипт (без аудио)
  • OpenAICompatibleTranscriptionProvider — Groq / OpenAI / self-hosted Whisper
                                           (эндпоинт POST /audio/transcriptions)
  • NimTranscriptionProvider           — Nvidia NIM (концепт прод-развёртывания)

Провайдер выбирается настройкой ASR_PROVIDER. Для записи через бота (реального
аудио нет) всегда используется stub; для загруженных файлов — настроенный провайдер.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx

from app.core.config import settings

logger = logging.getLogger("rzd.asr")


@dataclass(slots=True)
class TranscribedSegment:
    speaker_label: str | None  # метка говорящего (диаризация); None — неизвестно
    start_sec: float
    end_sec: float
    text: str


class TranscriptionProvider(ABC):
    """Контракт ASR-провайдера."""

    @abstractmethod
    async def transcribe(
        self, audio: bytes | None, filename: str = "audio.bin", language: str = "ru"
    ) -> list[TranscribedSegment]:
        raise NotImplementedError


# --------------------------------------------------------------------------- #
# Stub — детерминированный транскрипт типового совещания РЖД
# --------------------------------------------------------------------------- #
class StubTranscriptionProvider(TranscriptionProvider):
    _SCRIPT: list[tuple[str, float, float, str]] = [
        ("SPEAKER_00", 12, 31, "Коллеги, начнём оперативное совещание по итогам недели. Первый вопрос — состояние путевого хозяйства на участке Москва-Сортировочная."),
        ("SPEAKER_02", 33, 58, "По охране труда зафиксировано два замечания на перегоне. Необходимо до конца недели провести внеплановый инструктаж бригад и обновить журналы."),
        ("SPEAKER_00", 60, 79, "Виктор Иванович, прошу вас подготовить и провести этот инструктаж. Срок — до пятницы. Отчёт направьте мне на почту."),
        ("SPEAKER_01", 82, 110, "По ИТ-части: система мониторинга датчиков работает нестабильно. Предлагаю развернуть обновление серверного ПО и протестировать на стенде."),
        ("SPEAKER_00", 112, 130, "Елена Сергеевна, возьмите это в работу. Нужно обновить ПО мониторинга и предоставить результаты тестирования к следующему совещанию."),
        ("SPEAKER_03", 133, 162, "По логистике: задерживается поставка комплектующих для ремонта. Поставщик переносит сроки на две недели, это критично для графика."),
        ("SPEAKER_00", 164, 188, "Ольга Николаевна, согласуйте с поставщиком новый график и подготовьте альтернативные варианты закупки. Жду предложения к среде."),
        ("SPEAKER_01", 190, 212, "И ещё: нужно организовать обучение сотрудников новой системе документооборота. Предлагаю провести вебинар."),
        ("SPEAKER_00", 214, 236, "Согласен. Елена Сергеевна, организуйте вебинар по документообороту для всех отделов до конца месяца. На этом завершаем, спасибо всем."),
    ]

    async def transcribe(
        self, audio: bytes | None, filename: str = "audio.bin", language: str = "ru"
    ) -> list[TranscribedSegment]:
        return [
            TranscribedSegment(speaker_label=s, start_sec=float(a), end_sec=float(b), text=t)
            for (s, a, b, t) in self._SCRIPT
        ]




# --------------------------------------------------------------------------- #
# OpenAI-совместимый ASR (Groq / OpenAI / self-hosted Whisper)
# --------------------------------------------------------------------------- #
class OpenAICompatibleTranscriptionProvider(TranscriptionProvider):
    """POST {base_url}/audio/transcriptions, формат как у OpenAI Whisper."""

    def __init__(self) -> None:
        if not settings.asr_api_key:
            raise RuntimeError("ASR_API_KEY не задан — настройте ключ ASR-сервиса")
        self._url = settings.asr_api_base_url.rstrip("/") + "/audio/transcriptions"
        self._headers = {"Authorization": f"Bearer {settings.asr_api_key}"}
        self._model = settings.asr_model
        self._timeout = settings.asr_timeout_sec

    async def transcribe(
        self, audio: bytes | None, filename: str = "audio.bin", language: str = "ru"
    ) -> list[TranscribedSegment]:
        if not audio:
            raise ValueError("Для удалённого ASR требуется файл аудио")
        files = {"file": (filename, audio, "application/octet-stream")}
        data = {
            "model": self._model,
            "response_format": "verbose_json",
            "language": language,
            "temperature": "0",
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(self._url, headers=self._headers, files=files, data=data)
            resp.raise_for_status()
            payload = resp.json()

        segments = payload.get("segments") or []
        result = [
            TranscribedSegment(
                speaker_label=None,
                start_sec=float(s.get("start", 0.0)),
                end_sec=float(s.get("end", 0.0)),
                text=(s.get("text") or "").strip(),
            )
            for s in segments
            if (s.get("text") or "").strip()
        ]
        if result:
            return result
        text = (payload.get("text") or "").strip()
        return [TranscribedSegment(None, 0.0, 0.0, text)] if text else []


# --------------------------------------------------------------------------- #
# Nvidia NIM — концепт прод-развёртывания на инфраструктуре РЖД
# --------------------------------------------------------------------------- #
class NimTranscriptionProvider(TranscriptionProvider):
    """REST-коннектор к Nvidia NIM ASR (build.nvidia.com или self-hosted NIM)."""

    def __init__(self) -> None:
        if not settings.nim_base_url:
            raise RuntimeError("NIM_BASE_URL не задан — настройте адрес NIM ASR")
        self._url = settings.nim_base_url.rstrip("/") + "/v1/audio/transcriptions"
        self._headers = {}
        if settings.nim_api_key:
            self._headers["Authorization"] = f"Bearer {settings.nim_api_key}"
        self._model = settings.nim_model
        self._timeout = settings.asr_timeout_sec

    async def transcribe(
        self, audio: bytes | None, filename: str = "audio.bin", language: str = "ru"
    ) -> list[TranscribedSegment]:
        if not audio:
            raise ValueError("Для NIM ASR требуется файл аудио")
        files = {"file": (filename, audio, "application/octet-stream")}
        data = {"model": self._model, "language": language, "response_format": "verbose_json"}
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(self._url, headers=self._headers, files=files, data=data)
            resp.raise_for_status()
            payload = resp.json()
        segments = payload.get("segments") or []
        if segments:
            return [
                TranscribedSegment(
                    speaker_label=None,
                    start_sec=float(s.get("start", 0.0)),
                    end_sec=float(s.get("end", 0.0)),
                    text=(s.get("text") or "").strip(),
                )
                for s in segments
                if (s.get("text") or "").strip()
            ]
        text = (payload.get("text") or "").strip()
        return [TranscribedSegment(None, 0.0, 0.0, text)] if text else []


def get_transcription_provider(has_audio: bool = False) -> TranscriptionProvider:
    """Фабрика ASR-провайдера. has_audio=False → всегда stub (нет реального аудио)."""
    if not has_audio:
        return StubTranscriptionProvider()
    if settings.asr_provider == "openai_compatible":
        return OpenAICompatibleTranscriptionProvider()
    if settings.asr_provider == "nim":
        return NimTranscriptionProvider()
    return StubTranscriptionProvider()
