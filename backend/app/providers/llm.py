"""Провайдер LLM: суммаризация транскрипта и выделение поручений.

Интерфейс LLMProvider абстрагирует языковую модель (по ТЗ — Qwen3).
Реализации:
  • StubLLMProvider               — эвристика на регэкспах (без сети, всегда работает)
  • OpenAICompatibleLLMProvider   — Groq / OpenAI / self-hosted (Qwen, GPT-OSS и т.п.)
                                    через POST /chat/completions, ответ — строгий JSON

Провайдер выбирается настройкой LLM_PROVIDER. При сетевой/парсинг-ошибке реальный
провайдер деградирует к эвристике, чтобы пайплайн совещания не падал целиком.
"""
from __future__ import annotations

import json
import logging
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import httpx

from app.core.config import settings
from app.models.enums import TaskPriority
from app.providers.transcription import TranscribedSegment

logger = logging.getLogger("rzd.llm")


@dataclass(slots=True)
class ExtractedAssignment:
    title: str
    description: str
    assignee_hint: str | None  # упоминание ответственного, как в речи (ФИО/имя-отчество)
    due_hint: str | None  # текстовый срок ("до пятницы", "к среде")
    priority: TaskPriority
    source_index: int  # индекс сегмента транскрипта


@dataclass(slots=True)
class LLMResult:
    summary: str
    assignments: list[ExtractedAssignment] = field(default_factory=list)


class LLMProvider(ABC):
    """Контракт LLM-провайдера."""

    @abstractmethod
    async def analyze(self, segments: list[TranscribedSegment]) -> LLMResult:
        """Построить краткое содержание и список поручений по транскрипту."""
        raise NotImplementedError


def _coerce_priority(value: object) -> TaskPriority:
    s = str(value or "").strip().lower()
    if s in ("high", "высокий", "высокая", "критичный", "критично"):
        return TaskPriority.high
    if s in ("low", "низкий", "низкая"):
        return TaskPriority.low
    return TaskPriority.medium


class StubLLMProvider(LLMProvider):
    """Эвристическое выделение поручений (заглушка вместо реальной LLM)."""

    # Маркеры поручений в директивной речи
    _IMPERATIVES = (
        "прошу", "подготовьте", "подготовить", "проведите", "провести",
        "организуйте", "организовать", "возьмите", "согласуйте", "согласовать",
        "обновите", "обновить", "направьте", "предоставьте", "предоставить",
        "разверните", "развернуть", "нужно", "необходимо", "предлагаю",
    )
    _HIGH = ("срочно", "критично", "немедленно", "до пятницы", "до конца недели")
    _LOW = ("до конца месяца", "вебинар", "обучение")

    _NAME_RE = re.compile(
        r"([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+(?:вич|вна|ична))"  # Имя Отчество
    )
    _DUE_RE = re.compile(r"(до\s+[а-яё]+|к\s+[а-яё]+|до конца [а-яё]+)", re.IGNORECASE)

    def _priority(self, text: str) -> TaskPriority:
        low = text.lower()
        if any(k in low for k in self._HIGH):
            return TaskPriority.high
        if any(k in low for k in self._LOW):
            return TaskPriority.low
        return TaskPriority.medium

    def _title(self, text: str) -> str:
        # Берём первое содержательное предложение как формулировку
        sentence = re.split(r"[.!?]", text.strip())[0].strip()
        return (sentence[:1].upper() + sentence[1:])[:300] if sentence else text[:300]

    async def analyze(self, segments: list[TranscribedSegment]) -> LLMResult:
        assignments: list[ExtractedAssignment] = []
        for idx, seg in enumerate(segments):
            low = seg.text.lower()
            if not any(marker in low for marker in self._IMPERATIVES):
                continue
            name_match = self._NAME_RE.search(seg.text)
            due_match = self._DUE_RE.search(seg.text)
            assignments.append(
                ExtractedAssignment(
                    title=self._title(seg.text),
                    description=seg.text.strip(),
                    assignee_hint=name_match.group(1) if name_match else None,
                    due_hint=due_match.group(1) if due_match else None,
                    priority=self._priority(seg.text),
                    source_index=idx,
                )
            )

        summary = (
            f"На совещании рассмотрено {len(segments)} реплик участников. "
            f"Выделено {len(assignments)} поручений с ответственными и сроками."
        )
        return LLMResult(summary=summary, assignments=assignments)


class OpenAICompatibleLLMProvider(LLMProvider):
    """LLM через POST {base_url}/chat/completions (Groq/OpenAI-совместимый).

    Модель по умолчанию — Qwen3 на Groq. Возвращает строгий JSON; при ошибке
    сети/парсинга деградирует к эвристике StubLLMProvider, чтобы не рушить пайплайн.
    """

    _SYSTEM = (
        "Ты — ассистент протокольного отдела РЖД. На вход подаётся транскрипт "
        "совещания: пронумерованные реплики в формате «[index] (говорящий) текст». "
        "Твоя задача — выделить ПОРУЧЕНИЯ (action items): конкретные задачи, которые "
        "кто-то должен выполнить. Не выдумывай факты, опирайся только на текст.\n\n"
        "Верни СТРОГО JSON-объект без пояснений и markdown, вида:\n"
        "{\n"
        '  "summary": "краткое содержание совещания в 2-4 предложениях",\n'
        '  "assignments": [\n'
        "    {\n"
        '      "title": "краткая формулировка поручения (до 200 символов)",\n'
        '      "description": "развёрнутое описание задачи по тексту реплики",\n'
        '      "assignee": "ФИО или имя-отчество ответственного, если названо, иначе null",\n'
        '      "due": "текстовый срок как в речи (например, «до пятницы»), иначе null",\n'
        '      "priority": "high | medium | low",\n'
        '      "segment_index": 0\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "priority=high для срочного/критичного, low — для долгих/необязательных, "
        "иначе medium. segment_index — номер реплики-источника. "
        "Если поручений нет — верни пустой массив assignments."
    )

    def __init__(self) -> None:
        if not settings.llm_api_key:
            raise RuntimeError("LLM_API_KEY не задан — настройте ключ LLM-сервиса")
        self._url = settings.llm_api_base_url.rstrip("/") + "/chat/completions"
        self._headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
        self._model = settings.llm_model
        self._timeout = settings.llm_timeout_sec
        self._fallback = StubLLMProvider()

    @staticmethod
    def _build_user_prompt(segments: list[TranscribedSegment]) -> str:
        lines = []
        for i, s in enumerate(segments):
            spk = s.speaker_label or "—"
            text = (s.text or "").strip()
            lines.append(f"[{i}] ({spk}) {text}")
        return "Транскрипт совещания:\n" + "\n".join(lines)

    @staticmethod
    def _extract_json(content: str) -> dict:
        # Снимаем возможные <think>…</think> и markdown-ограждения у reasoning-моделей
        content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
        content = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            start = content.find("{")
            end = content.rfind("}")
            if start != -1 and end != -1 and end > start:
                return json.loads(content[start : end + 1])
            raise

    def _to_result(self, data: dict, n_segments: int) -> LLMResult:
        raw = data.get("assignments") or []
        assignments: list[ExtractedAssignment] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or "").strip()
            if not title:
                continue
            try:
                idx = int(item.get("segment_index"))
            except (TypeError, ValueError):
                idx = 0
            if idx < 0 or idx >= max(n_segments, 1):
                idx = max(0, min(idx, n_segments - 1)) if n_segments else 0
            assignee = item.get("assignee")
            due = item.get("due")
            assignments.append(
                ExtractedAssignment(
                    title=title[:300],
                    description=str(item.get("description") or title).strip(),
                    assignee_hint=str(assignee).strip() if assignee else None,
                    due_hint=str(due).strip() if due else None,
                    priority=_coerce_priority(item.get("priority")),
                    source_index=idx,
                )
            )
        summary = str(data.get("summary") or "").strip() or (
            f"Совещание: {n_segments} реплик, выделено {len(assignments)} поручений."
        )
        return LLMResult(summary=summary, assignments=assignments)

    async def analyze(self, segments: list[TranscribedSegment]) -> LLMResult:
        if not segments:
            return LLMResult(summary="Пустой транскрипт.", assignments=[])
        payload = {
            "model": self._model,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": self._SYSTEM},
                {"role": "user", "content": self._build_user_prompt(segments)},
            ],
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(self._url, headers=self._headers, json=payload)
                resp.raise_for_status()
                body = resp.json()
            content = body["choices"][0]["message"]["content"]
            data = self._extract_json(content)
            return self._to_result(data, len(segments))
        except Exception as exc:  # noqa: BLE001 — деградация к эвристике
            logger.warning("LLM analyze failed (%s), fallback to heuristic", exc)
            return await self._fallback.analyze(segments)


def get_llm_provider() -> LLMProvider:
    """Фабрика LLM-провайдера согласно настройкам."""
    if settings.llm_provider in ("openai_compatible", "qwen"):
        return OpenAICompatibleLLMProvider()
    return StubLLMProvider()
