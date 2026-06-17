"""Сервис совещаний: жизненный цикл бота, согласие, запись и пайплайн обработки."""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.integrations.storage import get_storage_service
from app.models.assignment import Assignment
from app.models.enums import MANAGERIAL_ROLES, ConsentStatus, RecordingState
from app.models.meeting import Meeting
from app.models.participant import Participant
from app.models.transcript import TranscriptSegment
from app.models.user import User
from app.providers.bot import get_bot_provider
from app.providers.llm import ExtractedAssignment, get_llm_provider
from app.providers.transcription import get_transcription_provider
from app.schemas.meeting import MeetingCreate

logger = logging.getLogger("rzd.meetings")

# Палитра цветов говорящих (как во фронтенде)
_SPEAKER_COLORS = ["#E21A1A", "#2C3E73", "#2E7D32", "#ED6C02", "#6A1B9A", "#00838F"]

# Популярные аудиоформаты, принимаемые на загрузку
ALLOWED_AUDIO_EXT = {
    ".mp3", ".wav", ".m4a", ".ogg", ".oga", ".opus", ".flac",
    ".webm", ".mp4", ".mpeg", ".mpga", ".aac", ".wma",
}


def _guess_content_type(filename: str) -> str:
    import mimetypes

    return mimetypes.guess_type(filename)[0] or "application/octet-stream"


class MeetingNotFoundError(Exception):
    pass


class InvalidStateError(Exception):
    pass


class ConsentNotGrantedError(Exception):
    pass


class ParticipantUserNotFoundError(Exception):
    """Участник не найден в справочнике пользователей."""


class MeetingAccessDeniedError(Exception):
    """Нет прав на просмотр совещания."""


def _eager():
    return (
        selectinload(Meeting.participants),
        selectinload(Meeting.transcript),
        selectinload(Meeting.assignments),
    )


def _as_utc(dt: datetime) -> datetime:
    """Привести datetime к offset-aware UTC (БД может вернуть naive значение)."""
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _resolve_due_date(hint: str | None, base: datetime) -> date | None:
    """Преобразовать текстовый срок в дату относительно даты совещания."""
    if not hint:
        return None
    low = hint.lower()
    base_d = base.date()
    if "пятниц" in low:
        return base_d + timedelta(days=(4 - base_d.weekday()) % 7 or 7)
    if "сред" in low:
        return base_d + timedelta(days=(2 - base_d.weekday()) % 7 or 7)
    if "конца недели" in low:
        return base_d + timedelta(days=(6 - base_d.weekday()))
    if "конца месяца" in low:
        nxt = (base_d.replace(day=28) + timedelta(days=4)).replace(day=1)
        return nxt - timedelta(days=1)
    return base_d + timedelta(days=7)


class MeetingService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # --- выборки ---

    async def get_detail(self, meeting_id: uuid.UUID) -> Meeting:
        result = await self.db.execute(
            select(Meeting)
            .where(Meeting.id == meeting_id)
            .options(*_eager())
            .execution_options(populate_existing=True)
        )
        meeting = result.scalar_one_or_none()
        if meeting is None:
            raise MeetingNotFoundError(str(meeting_id))
        return meeting

    async def list(self, limit: int = 50, offset: int = 0) -> tuple[list[Meeting], int]:
        total = (await self.db.execute(select(func.count()).select_from(Meeting))).scalar_one()
        rows = (
            await self.db.execute(
                select(Meeting)
                .order_by(Meeting.scheduled_at.desc().nullslast(), Meeting.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        ).scalars().all()
        return list(rows), int(total)

    # --- создание ---

    async def create(self, payload: MeetingCreate, created_by_id: uuid.UUID | None) -> Meeting:
        meeting = Meeting(
            title=payload.title,
            platform=payload.platform,
            conference_url=payload.conference_url,
            department=payload.department,
            organizer_name=payload.organizer_name,
            scheduled_at=payload.scheduled_at or datetime.now(timezone.utc),
            recording_state=RecordingState.idle,
            created_by_id=created_by_id,
        )
        self.db.add(meeting)
        await self.db.flush()
        await self._attach_participants(meeting, payload.participant_ids)
        await self.db.commit()
        return await self.get_detail(meeting.id)

    async def _attach_participants(self, meeting: Meeting, user_ids: list[uuid.UUID]) -> None:
        """Добавить участников совещания строго из справочника пользователей."""
        idx = 0
        seen: set[uuid.UUID] = set()
        for uid in user_ids:
            if uid in seen:
                continue
            seen.add(uid)
            user = await self.db.get(User, uid)
            if user is None:
                raise ParticipantUserNotFoundError(str(uid))
            self.db.add(
                Participant(
                    meeting_id=meeting.id,
                    user_id=user.id,
                    name=user.full_name,
                    role=user.position,
                    email=user.email,
                    consent=ConsentStatus.pending,
                    speaker_color=_SPEAKER_COLORS[idx % len(_SPEAKER_COLORS)],
                    speaker_label=f"SPEAKER_{idx:02d}",
                )
            )
            idx += 1

    # --- видимость по ролям ---

    async def list_visible(
        self, viewer: User, limit: int = 50, offset: int = 0
    ) -> tuple[list[Meeting], int]:
        """Список совещаний с учётом прав: руководители видят все, работяги — свои."""
        if viewer.role in MANAGERIAL_ROLES:
            return await self.list(limit=limit, offset=offset)
        # employee — только совещания, где он участник
        base = (
            select(Meeting)
            .join(Participant, Participant.meeting_id == Meeting.id)
            .where(Participant.user_id == viewer.id)
        )
        total = (
            await self.db.execute(select(func.count()).select_from(base.subquery()))
        ).scalar_one()
        rows = (
            await self.db.execute(
                base.order_by(Meeting.scheduled_at.desc().nullslast(), Meeting.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        ).scalars().all()
        return list(rows), int(total)

    async def get_detail_for_viewer(self, meeting_id: uuid.UUID, viewer: User) -> Meeting:
        meeting = await self.get_detail(meeting_id)
        if viewer.role not in MANAGERIAL_ROLES:
            if not any(p.user_id == viewer.id for p in meeting.participants):
                raise MeetingAccessDeniedError(str(meeting_id))
        return meeting

    # --- бот и согласие ---

    async def connect_bot(self, meeting_id: uuid.UUID) -> Meeting:
        meeting = await self.get_detail(meeting_id)
        if meeting.recording_state not in (RecordingState.idle, RecordingState.failed):
            raise InvalidStateError(meeting.recording_state.value)
        bot = get_bot_provider()
        session = await bot.join(str(meeting.id), meeting.platform, meeting.conference_url)
        await bot.request_consent(session)
        meeting.recording_state = RecordingState.awaiting_consent
        for p in meeting.participants:
            p.consent = ConsentStatus.pending
        await self.db.commit()
        return await self.get_detail(meeting.id)

    async def set_consent(
        self, meeting_id: uuid.UUID, participant_id: uuid.UUID, consent: ConsentStatus
    ) -> Meeting:
        meeting = await self.get_detail(meeting_id)
        target = next((p for p in meeting.participants if p.id == participant_id), None)
        if target is None:
            raise MeetingNotFoundError(f"participant {participant_id}")
        target.consent = consent
        await self.db.commit()
        return await self.get_detail(meeting.id)

    async def grant_all_consent(self, meeting_id: uuid.UUID) -> Meeting:
        meeting = await self.get_detail(meeting_id)
        for p in meeting.participants:
            p.consent = ConsentStatus.granted
        await self.db.commit()
        return await self.get_detail(meeting.id)

    # --- запись ---

    async def start_recording(self, meeting_id: uuid.UUID) -> Meeting:
        meeting = await self.get_detail(meeting_id)
        if not meeting.participants or any(
            p.consent != ConsentStatus.granted for p in meeting.participants
        ):
            raise ConsentNotGrantedError(str(meeting_id))
        meeting.recording_state = RecordingState.recording
        meeting.started_at = datetime.now(timezone.utc)
        await self.db.commit()
        return await self.get_detail(meeting.id)

    async def stop_and_process(self, meeting_id: uuid.UUID) -> Meeting:
        """Остановить запись и выполнить пайплайн: ASR → диаризация → LLM → поручения."""
        meeting = await self.get_detail(meeting_id)
        if meeting.recording_state not in (RecordingState.recording, RecordingState.paused):
            raise InvalidStateError(meeting.recording_state.value)

        meeting.recording_state = RecordingState.processing
        meeting.finished_at = datetime.now(timezone.utc)
        if meeting.started_at:
            meeting.duration_sec = max(
                0,
                int((_as_utc(meeting.finished_at) - _as_utc(meeting.started_at)).total_seconds()),
            )
        await self.db.commit()

        try:
            await self._run_pipeline(meeting)
            meeting.recording_state = RecordingState.done
        except Exception:  # noqa: BLE001
            logger.exception("Ошибка пайплайна обработки совещания %s", meeting_id)
            meeting.recording_state = RecordingState.failed
        await self.db.commit()
        return await self.get_detail(meeting.id)

    async def transcribe_uploaded(
        self, meeting_id: uuid.UUID, audio: bytes, filename: str
    ) -> Meeting:
        """Транскрибировать загруженный аудиофайл (альтернатива записи через бота)."""
        meeting = await self.get_detail(meeting_id)

        # сохраняем файл в объектное хранилище (best-effort: не валим пайплайн)
        key = f"meetings/{meeting.id}/{filename}"
        try:
            storage = get_storage_service()
            await storage.ensure_bucket()
            await storage.put_object(key, audio, _guess_content_type(filename))
        except Exception as exc:  # noqa: BLE001
            logger.warning("Не удалось сохранить аудио в хранилище: %s", exc)
        meeting.audio_object_key = key

        meeting.recording_state = RecordingState.processing
        meeting.finished_at = datetime.now(timezone.utc)
        await self.db.commit()

        try:
            await self._run_pipeline(meeting, audio_bytes=audio, filename=filename)
            meeting.recording_state = RecordingState.done
        except Exception:  # noqa: BLE001
            logger.exception("Ошибка транскрибации загруженного аудио %s", meeting_id)
            meeting.recording_state = RecordingState.failed
            await self.db.commit()
            raise
        await self.db.commit()
        return await self.get_detail(meeting.id)

    async def _run_pipeline(
        self, meeting: Meeting, audio_bytes: bytes | None = None, filename: str = "audio.ogg"
    ) -> None:
        audio_key = meeting.audio_object_key or f"meetings/{meeting.id}/audio.ogg"
        meeting.audio_object_key = audio_key

        # 1. ASR (+ диаризация для stub-сценария)
        has_audio = audio_bytes is not None
        asr = get_transcription_provider(has_audio=has_audio)
        segments = await asr.transcribe(audio_bytes, filename=filename, language=settings.asr_language)

        # карта меток говорящих -> участники
        label_to_participant = {
            p.speaker_label: p for p in meeting.participants if p.speaker_label
        }

        for seg in list(meeting.transcript):
            await self.db.delete(seg)
        for a in list(meeting.assignments):
            await self.db.delete(a)
        await self.db.flush()

        index_to_segment: dict[int, TranscriptSegment] = {}
        for i2, s in enumerate(segments):
            speaker = label_to_participant.get(s.speaker_label)
            seg = TranscriptSegment(
                meeting_id=meeting.id,
                speaker_id=speaker.id if speaker else None,
                order_index=i2,
                start_sec=s.start_sec,
                end_sec=s.end_sec,
                text=s.text,
            )
            self.db.add(seg)
            index_to_segment[i2] = seg
        await self.db.flush()

        llm = get_llm_provider()
        result = await llm.analyze(segments)
        meeting.summary = result.summary

        base_dt = meeting.scheduled_at or datetime.now(timezone.utc)
        for ext in result.assignments:
            assignee = self._match_assignee(meeting.participants, ext)
            source_seg = index_to_segment.get(ext.source_index)
            self.db.add(
                Assignment(
                    meeting_id=meeting.id,
                    assignee_id=assignee.id if assignee else None,
                    source_segment_id=source_seg.id if source_seg else None,
                    title=ext.title,
                    description=ext.description,
                    due_date=_resolve_due_date(ext.due_hint, base_dt),
                    priority=ext.priority,
                )
            )
        await self.db.flush()

    @staticmethod
    def _match_assignee(participants, ext):
        if not ext.assignee_hint:
            return None
        hint_tokens = {t for t in ext.assignee_hint.lower().split() if len(t) > 2}
        for p in participants:
            name_tokens = {t for t in (p.name or "").lower().split() if len(t) > 2}
            if hint_tokens & name_tokens:
                return p
        return None
