"""Сервис поручений: CRUD, массовое подтверждение и рассылка по почте."""
from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.email import EmailService, get_email_service
from app.models.assignment import Assignment
from app.models.enums import MailStatus, TaskStatus
from app.models.mail_log import MailLog
from app.models.participant import Participant
from app.schemas.assignment import AssignmentCreate, AssignmentUpdate


class AssignmentNotFoundError(Exception):
    pass


def _format_due(a: Assignment) -> str:
    return a.due_date.strftime("%d.%m.%Y") if a.due_date else "без срока"


class AssignmentService:
    def __init__(self, db: AsyncSession, email: EmailService | None = None) -> None:
        self.db = db
        self.email = email or get_email_service()

    async def get(self, assignment_id: uuid.UUID) -> Assignment:
        a = await self.db.get(Assignment, assignment_id)
        if a is None:
            raise AssignmentNotFoundError(str(assignment_id))
        return a

    async def list_for_meeting(
        self, meeting_id: uuid.UUID, only_user_id: uuid.UUID | None = None
    ) -> list[Assignment]:
        stmt = select(Assignment).where(Assignment.meeting_id == meeting_id)
        if only_user_id is not None:
            # работяга видит в совещании только свои поручения
            stmt = stmt.join(Participant, Participant.id == Assignment.assignee_id).where(
                Participant.user_id == only_user_id
            )
        rows = (await self.db.execute(stmt.order_by(Assignment.created_at))).scalars().all()
        return list(rows)

    async def list_for_user(self, user_id: uuid.UUID) -> list[Assignment]:
        """Все поручения пользователя (по всем совещаниям) — для просмотра по учётке."""
        rows = (
            await self.db.execute(
                select(Assignment)
                .join(Participant, Participant.id == Assignment.assignee_id)
                .where(Participant.user_id == user_id)
                .order_by(Assignment.due_date.asc().nullslast(), Assignment.created_at.desc())
            )
        ).scalars().all()
        return list(rows)

    async def create(self, meeting_id: uuid.UUID, payload: AssignmentCreate) -> Assignment:
        a = Assignment(
            meeting_id=meeting_id,
            assignee_id=payload.assignee_id,
            source_segment_id=payload.source_segment_id,
            title=payload.title,
            description=payload.description,
            due_date=payload.due_date,
            priority=payload.priority,
            status=TaskStatus.draft,
        )
        self.db.add(a)
        await self.db.commit()
        await self.db.refresh(a)
        return a

    async def update(self, assignment_id: uuid.UUID, payload: AssignmentUpdate) -> Assignment:
        a = await self.get(assignment_id)
        data = payload.model_dump(exclude_unset=True)
        new_status = data.pop("status", None)
        for field, value in data.items():
            setattr(a, field, value)
        if new_status is not None:
            self._apply_status(a, new_status)
        await self.db.commit()
        await self.db.refresh(a)
        return a

    async def delete(self, assignment_id: uuid.UUID) -> None:
        a = await self.get(assignment_id)
        await self.db.delete(a)
        await self.db.commit()

    @staticmethod
    def _apply_status(a: Assignment, status: TaskStatus) -> None:
        a.status = status
        now = datetime.now(timezone.utc)
        if status == TaskStatus.confirmed and a.confirmed_at is None:
            a.confirmed_at = now
        if status == TaskStatus.sent and a.sent_at is None:
            a.sent_at = now

    async def confirm_many(self, ids: list[uuid.UUID]) -> list[uuid.UUID]:
        rows = (
            await self.db.execute(select(Assignment).where(Assignment.id.in_(ids)))
        ).scalars().all()
        affected: list[uuid.UUID] = []
        for a in rows:
            if a.status == TaskStatus.draft:
                self._apply_status(a, TaskStatus.confirmed)
                affected.append(a.id)
        await self.db.commit()
        return affected

    async def send_many(self, ids: list[uuid.UUID]) -> list[uuid.UUID]:
        """Разослать поручения ответственным (персональные письма) и пометить отправленными."""
        rows = (
            await self.db.execute(
                select(Assignment).where(
                    Assignment.id.in_(ids),
                    Assignment.status == TaskStatus.confirmed,
                )
            )
        ).scalars().all()

        # группировка по ответственному
        by_assignee: dict[uuid.UUID | None, list[Assignment]] = defaultdict(list)
        for a in rows:
            by_assignee[a.assignee_id].append(a)

        sent_ids: list[uuid.UUID] = []
        for assignee_id, items in by_assignee.items():
            participant = (
                await self.db.get(Participant, assignee_id) if assignee_id else None
            )
            if participant is None or not participant.email:
                # некому отправлять — пропускаем, но фиксируем в журнале
                self.db.add(
                    MailLog(
                        meeting_id=items[0].meeting_id,
                        recipient_email=participant.email if participant else "—",
                        recipient_name=participant.name if participant else None,
                        subject="Поручения по итогам совещания",
                        body=self._render_body(participant, items),
                        status=MailStatus.failed,
                        error="У ответственного не указан email",
                    )
                )
                continue

            subject = "Поручения по итогам совещания — РЖД"
            body = self._render_body(participant, items)
            result = await self.email.send(participant.email, participant.name, subject, body)

            self.db.add(
                MailLog(
                    meeting_id=items[0].meeting_id,
                    recipient_email=participant.email,
                    recipient_name=participant.name,
                    subject=subject,
                    body=body,
                    status=MailStatus.sent if result.ok else MailStatus.failed,
                    error=result.error,
                )
            )
            if result.ok:
                for a in items:
                    self._apply_status(a, TaskStatus.sent)
                    sent_ids.append(a.id)

        await self.db.commit()
        return sent_ids

    @staticmethod
    def _render_body(participant: Participant | None, items: list[Assignment]) -> str:
        name = participant.name if participant else "коллега"
        lines = [f"Здравствуйте, {name}!", "", "По итогам совещания на вас оформлены поручения:", ""]
        for i, a in enumerate(items, start=1):
            lines.append(f"{i}. {a.title} (срок: {_format_due(a)})")
            if a.description:
                lines.append(f"   {a.description}")
        lines += ["", "Письмо сформировано автоматически системой «РЖД · Протокол»."]
        return "\n".join(lines)
