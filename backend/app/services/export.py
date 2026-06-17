"""Экспорт протокола совещания: JSON и PDF (reportlab)."""
from __future__ import annotations

import io
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.models.enums import TaskPriority, TaskStatus
from app.models.meeting import Meeting

RZD_RED = colors.HexColor("#E21A1A")

_PRIORITY_RU = {
    TaskPriority.high: "Высокий",
    TaskPriority.medium: "Средний",
    TaskPriority.low: "Низкий",
}
_STATUS_RU = {
    TaskStatus.draft: "Черновик",
    TaskStatus.confirmed: "Подтверждено",
    TaskStatus.sent: "Отправлено",
}


def build_json(meeting: Meeting) -> dict[str, Any]:
    """Структурированный протокол для интеграций."""
    return {
        "meeting": {
            "id": str(meeting.id),
            "title": meeting.title,
            "platform": meeting.platform.value,
            "department": meeting.department,
            "organizer": meeting.organizer_name,
            "scheduled_at": meeting.scheduled_at.isoformat() if meeting.scheduled_at else None,
            "duration_sec": meeting.duration_sec,
            "summary": meeting.summary,
        },
        "participants": [
            {"name": p.name, "role": p.role, "email": p.email, "consent": p.consent.value}
            for p in meeting.participants
        ],
        "assignments": [
            {
                "title": a.title,
                "description": a.description,
                "assignee": a.assignee.name if a.assignee else None,
                "assignee_email": a.assignee.email if a.assignee else None,
                "due_date": a.due_date.isoformat() if a.due_date else None,
                "priority": a.priority.value,
                "status": a.status.value,
            }
            for a in meeting.assignments
        ],
    }


def build_pdf(meeting: Meeting) -> bytes:
    """Печатный протокол поручений в формате PDF."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"Протокол — {meeting.title}",
    )

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], textColor=RZD_RED, fontSize=16)
    meta = ParagraphStyle("meta", parent=styles["Normal"], fontSize=9, textColor=colors.grey)
    cell = ParagraphStyle("cell", parent=styles["Normal"], fontSize=9, alignment=TA_LEFT)
    head = ParagraphStyle("head", parent=styles["Normal"], fontSize=9, textColor=colors.white)

    elements: list[Any] = []
    elements.append(Paragraph("ОАО «РЖД» · Протокол совещания", styles["Title"]))
    elements.append(Paragraph(meeting.title, h1))
    when = meeting.scheduled_at.strftime("%d.%m.%Y %H:%M") if meeting.scheduled_at else "—"
    elements.append(
        Paragraph(
            f"{when} · {meeting.platform.value}<br/>"
            f"Подразделение: {meeting.department or '—'}<br/>"
            f"Организатор: {meeting.organizer_name or '—'}",
            meta,
        )
    )
    elements.append(Spacer(1, 8 * mm))
    elements.append(Paragraph("Перечень поручений", styles["Heading2"]))
    elements.append(Spacer(1, 3 * mm))

    table_data: list[list[Any]] = [
        [
            Paragraph("№", head),
            Paragraph("Поручение", head),
            Paragraph("Ответственный", head),
            Paragraph("Срок", head),
            Paragraph("Приоритет", head),
            Paragraph("Статус", head),
        ]
    ]
    for i, a in enumerate(meeting.assignments, start=1):
        table_data.append(
            [
                Paragraph(str(i), cell),
                Paragraph(a.title, cell),
                Paragraph(a.assignee.name if a.assignee else "—", cell),
                Paragraph(a.due_date.strftime("%d.%m.%Y") if a.due_date else "—", cell),
                Paragraph(_PRIORITY_RU.get(a.priority, a.priority.value), cell),
                Paragraph(_STATUS_RU.get(a.status, a.status.value), cell),
            ]
        )

    table = Table(table_data, colWidths=[10 * mm, 62 * mm, 38 * mm, 22 * mm, 22 * mm, 24 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), RZD_RED),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#DDDDDD")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F7F9")]),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(table)
    elements.append(Spacer(1, 8 * mm))
    elements.append(
        Paragraph(
            "Сформировано системой автоматического документирования совещаний РЖД",
            meta,
        )
    )

    doc.build(elements)
    return buffer.getvalue()
