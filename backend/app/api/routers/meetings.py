"""Совещания: создание, бот, согласие, запись, обработка, экспорт."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import JSONResponse

from app.api.deps import CurrentUser, DbSession, ManagerialUser
from app.integrations.storage import get_storage_service
from app.models.user import User
from app.schemas.common import Page
from app.schemas.meeting import (
    MeetingCreate,
    MeetingDetail,
    MeetingRead,
    MeetingUpdate,
    RecordingStateRead,
)
from app.schemas.participant import ConsentUpdate
from app.services.export import build_json, build_pdf
from app.services.meetings import (
    ALLOWED_AUDIO_EXT,
    ConsentNotGrantedError,
    InvalidStateError,
    MeetingAccessDeniedError,
    MeetingNotFoundError,
    MeetingService,
    ParticipantUserNotFoundError,
)

router = APIRouter(prefix="/meetings", tags=["meetings"])


def _detail(meeting) -> MeetingDetail:
    return MeetingDetail.model_validate(meeting)


async def _get_or_404(service: MeetingService, meeting_id: uuid.UUID):
    try:
        return await service.get_detail(meeting_id)
    except MeetingNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Совещание не найдено") from None


async def _get_for_viewer(service: MeetingService, meeting_id: uuid.UUID, viewer: User):
    try:
        return await service.get_detail_for_viewer(meeting_id, viewer)
    except MeetingNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Совещание не найдено") from None
    except MeetingAccessDeniedError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к совещанию") from None


@router.get("", response_model=Page[MeetingRead])
async def list_meetings(
    db: DbSession,
    current: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[MeetingRead]:
    items, total = await MeetingService(db).list_visible(current, limit=limit, offset=offset)
    return Page[MeetingRead](
        items=[MeetingRead.model_validate(m) for m in items],
        total=total, limit=limit, offset=offset,
    )


@router.post("", response_model=MeetingDetail, status_code=status.HTTP_201_CREATED)
async def create_meeting(payload: MeetingCreate, db: DbSession, current: ManagerialUser) -> MeetingDetail:
    try:
        meeting = await MeetingService(db).create(payload, created_by_id=current.id)
    except ParticipantUserNotFoundError as exc:
        raise HTTPException(status_code=400, detail=f"Пользователь-участник не найден: {exc}") from None
    return _detail(meeting)


@router.get("/{meeting_id}", response_model=MeetingDetail)
async def get_meeting(meeting_id: uuid.UUID, db: DbSession, current: CurrentUser) -> MeetingDetail:
    return _detail(await _get_for_viewer(MeetingService(db), meeting_id, current))


@router.patch("/{meeting_id}", response_model=MeetingDetail)
async def update_meeting(
    meeting_id: uuid.UUID, payload: MeetingUpdate, db: DbSession, _: ManagerialUser
) -> MeetingDetail:
    service = MeetingService(db)
    meeting = await _get_or_404(service, meeting_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(meeting, field, value)
    await db.commit()
    return _detail(await service.get_detail(meeting_id))


# --- Бот и согласие (управленческие роли) ---

@router.post("/{meeting_id}/connect-bot", response_model=MeetingDetail)
async def connect_bot(meeting_id: uuid.UUID, db: DbSession, _: ManagerialUser) -> MeetingDetail:
    service = MeetingService(db)
    try:
        return _detail(await service.connect_bot(meeting_id))
    except MeetingNotFoundError:
        raise HTTPException(status_code=404, detail="Совещание не найдено") from None
    except InvalidStateError as exc:
        raise HTTPException(status_code=409, detail=f"Недопустимое состояние: {exc}") from None


@router.post("/{meeting_id}/participants/{participant_id}/consent", response_model=MeetingDetail)
async def set_consent(
    meeting_id: uuid.UUID, participant_id: uuid.UUID, payload: ConsentUpdate,
    db: DbSession, _: ManagerialUser,
) -> MeetingDetail:
    service = MeetingService(db)
    try:
        return _detail(await service.set_consent(meeting_id, participant_id, payload.consent))
    except MeetingNotFoundError:
        raise HTTPException(status_code=404, detail="Совещание или участник не найдены") from None


@router.post("/{meeting_id}/consent/grant-all", response_model=MeetingDetail)
async def grant_all_consent(meeting_id: uuid.UUID, db: DbSession, _: ManagerialUser) -> MeetingDetail:
    service = MeetingService(db)
    await _get_or_404(service, meeting_id)
    return _detail(await service.grant_all_consent(meeting_id))


# --- Запись (управленческие роли) ---

@router.post("/{meeting_id}/recording/start", response_model=MeetingDetail)
async def start_recording(meeting_id: uuid.UUID, db: DbSession, _: ManagerialUser) -> MeetingDetail:
    service = MeetingService(db)
    try:
        return _detail(await service.start_recording(meeting_id))
    except MeetingNotFoundError:
        raise HTTPException(status_code=404, detail="Совещание не найдено") from None
    except ConsentNotGrantedError:
        raise HTTPException(status_code=409, detail="Запись недоступна: согласие получено не от всех участников") from None


@router.post("/{meeting_id}/recording/stop", response_model=MeetingDetail)
async def stop_recording(meeting_id: uuid.UUID, db: DbSession, _: ManagerialUser) -> MeetingDetail:
    """Остановить запись и запустить пайплайн ASR → диаризация → LLM → поручения."""
    service = MeetingService(db)
    try:
        return _detail(await service.stop_and_process(meeting_id))
    except MeetingNotFoundError:
        raise HTTPException(status_code=404, detail="Совещание не найдено") from None
    except InvalidStateError as exc:
        raise HTTPException(status_code=409, detail=f"Недопустимое состояние: {exc}") from None


@router.post("/{meeting_id}/recording/upload", response_model=RecordingStateRead)
async def upload_recording(
    meeting_id: uuid.UUID, file: UploadFile, db: DbSession, _: ManagerialUser
) -> RecordingStateRead:
    """Загрузить файл записи в объектное хранилище S3/MinIO."""
    service = MeetingService(db)
    meeting = await _get_or_404(service, meeting_id)
    data = await file.read()
    key = f"meetings/{meeting_id}/{file.filename or 'audio.bin'}"
    storage = get_storage_service()
    try:
        await storage.ensure_bucket()
        await storage.put_object(key, data, file.content_type or "application/octet-stream")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Ошибка хранилища: {exc}") from None
    meeting.audio_object_key = key
    await db.commit()
    return RecordingStateRead(
        meeting_id=meeting.id, recording_state=meeting.recording_state, duration_sec=meeting.duration_sec,
    )


@router.post("/{meeting_id}/audio/transcribe", response_model=MeetingDetail)
async def transcribe_audio(
    meeting_id: uuid.UUID, file: UploadFile, db: DbSession, _: ManagerialUser
) -> MeetingDetail:
    """Загрузить аудиофайл и расшифровать его (альтернатива записи через бота).

    Файл уходит в ASR-провайдер (Groq/OpenAI/NIM или stub), затем LLM выделяет
    поручения. Согласие участников для загруженной записи не требуется.
    """
    import os

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext and ext not in ALLOWED_AUDIO_EXT:
        raise HTTPException(
            status_code=415,
            detail=f"Неподдерживаемый формат: {ext}. Разрешены: {', '.join(sorted(ALLOWED_AUDIO_EXT))}",
        )
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Пустой файл")

    service = MeetingService(db)
    try:
        meeting = await service.transcribe_uploaded(meeting_id, data, file.filename or "audio.ogg")
    except MeetingNotFoundError:
        raise HTTPException(status_code=404, detail="Совещание не найдено") from None
    except Exception as exc:  # noqa: BLE001 — ошибки ASR/LLM показываем клиенту
        raise HTTPException(status_code=502, detail=f"Ошибка распознавания: {exc}") from None
    return _detail(meeting)


# --- Экспорт (доступен участникам и руководителям) ---

@router.get("/{meeting_id}/export.json")
async def export_json(meeting_id: uuid.UUID, db: DbSession, current: CurrentUser) -> JSONResponse:
    meeting = await _get_for_viewer(MeetingService(db), meeting_id, current)
    return JSONResponse(content=build_json(meeting))


@router.get("/{meeting_id}/export.pdf")
async def export_pdf(meeting_id: uuid.UUID, db: DbSession, current: CurrentUser) -> Response:
    meeting = await _get_for_viewer(MeetingService(db), meeting_id, current)
    pdf = build_pdf(meeting)
    headers = {"Content-Disposition": f'attachment; filename="protocol_{meeting_id}.pdf"'}
    return Response(content=pdf, media_type="application/pdf", headers=headers)


@router.get("/{meeting_id}/recording/state", response_model=RecordingStateRead)
async def recording_state(meeting_id: uuid.UUID, db: DbSession, current: CurrentUser) -> RecordingStateRead:
    meeting = await _get_for_viewer(MeetingService(db), meeting_id, current)
    return RecordingStateRead(
        meeting_id=meeting.id, recording_state=meeting.recording_state, duration_sec=meeting.duration_sec,
    )
