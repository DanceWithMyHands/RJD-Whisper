"""Поручения: CRUD, массовое подтверждение и рассылка (с учётом ролей)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Response, status

from app.api.deps import CurrentUser, DbSession, ManagerialUser, is_managerial
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentRead,
    AssignmentUpdate,
    BulkActionResult,
    BulkIdsRequest,
)
from app.services.assignments import AssignmentNotFoundError, AssignmentService

router = APIRouter(tags=["assignments"])


@router.get("/assignments/my", response_model=list[AssignmentRead])
async def my_assignments(db: DbSession, current: CurrentUser) -> list[AssignmentRead]:
    """Поручения текущего пользователя по всем совещаниям."""
    items = await AssignmentService(db).list_for_user(current.id)
    return [AssignmentRead.model_validate(a) for a in items]


@router.get("/meetings/{meeting_id}/assignments", response_model=list[AssignmentRead])
async def list_assignments(meeting_id: uuid.UUID, db: DbSession, current: CurrentUser) -> list[AssignmentRead]:
    # работяга видит в совещании только свои поручения
    only = None if is_managerial(current) else current.id
    items = await AssignmentService(db).list_for_meeting(meeting_id, only_user_id=only)
    return [AssignmentRead.model_validate(a) for a in items]


@router.post(
    "/meetings/{meeting_id}/assignments",
    response_model=AssignmentRead, status_code=status.HTTP_201_CREATED,
)
async def create_assignment(
    meeting_id: uuid.UUID, payload: AssignmentCreate, db: DbSession, _: ManagerialUser
) -> AssignmentRead:
    a = await AssignmentService(db).create(meeting_id, payload)
    return AssignmentRead.model_validate(a)


@router.patch("/assignments/{assignment_id}", response_model=AssignmentRead)
async def update_assignment(
    assignment_id: uuid.UUID, payload: AssignmentUpdate, db: DbSession, _: ManagerialUser
) -> AssignmentRead:
    try:
        a = await AssignmentService(db).update(assignment_id, payload)
    except AssignmentNotFoundError:
        raise HTTPException(status_code=404, detail="Поручение не найдено") from None
    return AssignmentRead.model_validate(a)


@router.delete(
    "/assignments/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT, response_class=Response,
)
async def delete_assignment(assignment_id: uuid.UUID, db: DbSession, _: ManagerialUser) -> Response:
    try:
        await AssignmentService(db).delete(assignment_id)
    except AssignmentNotFoundError:
        raise HTTPException(status_code=404, detail="Поручение не найдено") from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/assignments/bulk/confirm", response_model=BulkActionResult)
async def confirm_assignments(payload: BulkIdsRequest, db: DbSession, _: ManagerialUser) -> BulkActionResult:
    affected = await AssignmentService(db).confirm_many(payload.ids)
    return BulkActionResult(affected=len(affected), ids=affected)


@router.post("/assignments/bulk/send", response_model=BulkActionResult)
async def send_assignments(payload: BulkIdsRequest, db: DbSession, _: ManagerialUser) -> BulkActionResult:
    """Разослать подтверждённые поручения ответственным по электронной почте."""
    sent = await AssignmentService(db).send_many(payload.ids)
    return BulkActionResult(affected=len(sent), ids=sent)
