import type { Meeting } from '../types'
import { formatDate, formatDateTime } from './format'
import { priorityLabels, statusLabels } from '../data/mockData'

export function exportJSON(meeting: Meeting) {
  const payload = {
    meeting: {
      id: meeting.id,
      title: meeting.title,
      platform: meeting.platform,
      date: meeting.date,
      organizer: meeting.organizer,
      department: meeting.department,
    },
    participants: meeting.participants.map((p) => ({ name: p.name, role: p.role, email: p.email })),
    assignments: meeting.assignments.map((a) => {
      const assignee = meeting.participants.find((p) => p.id === a.assigneeId)
      return {
        title: a.title,
        description: a.description,
        assignee: assignee?.name,
        assigneeEmail: assignee?.email,
        dueDate: a.dueDate,
        priority: a.priority,
        status: a.status,
      }
    }),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  triggerDownload(blob, `protocol_${meeting.id}.json`)
}

export function exportPDF(meeting: Meeting) {
  const win = window.open('', '_blank')
  if (!win) return
  const rows = meeting.assignments
    .map((a, i) => {
      const assignee = meeting.participants.find((p) => p.id === a.assigneeId)
      return `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(a.title)}</td>
        <td>${escapeHtml(assignee?.name ?? '—')}</td>
        <td>${formatDate(a.dueDate)}</td>
        <td>${priorityLabels[a.priority]}</td>
        <td>${statusLabels[a.status]}</td>
      </tr>`
    })
    .join('')

  win.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8">
    <title>Протокол поручений — ${escapeHtml(meeting.title)}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#1a1a2e;padding:32px;max-width:900px;margin:0 auto}
      h1{color:#E21A1A;font-size:22px;margin-bottom:4px}
      .meta{color:#555;font-size:13px;margin-bottom:24px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{border:1px solid #ddd;padding:8px 10px;text-align:left;vertical-align:top}
      th{background:#f4f5f7}
      .header{display:flex;align-items:center;gap:10px;border-bottom:3px solid #E21A1A;padding-bottom:12px;margin-bottom:18px}
      .badge{display:inline-block;width:34px;height:34px;background:#E21A1A;border-radius:8px}
      .foot{margin-top:24px;font-size:11px;color:#888}
    </style></head><body>
    <div class="header"><div class="badge"></div>
      <div><strong style="font-size:16px">ОАО «РЖД» · Протокол совещания</strong></div>
    </div>
    <h1>${escapeHtml(meeting.title)}</h1>
    <div class="meta">
      ${formatDateTime(meeting.date)} · ${meeting.platform}<br>
      Подразделение: ${escapeHtml(meeting.department)}<br>
      Организатор: ${escapeHtml(meeting.organizer)}
    </div>
    <h3>Перечень поручений</h3>
    <table>
      <thead><tr><th>№</th><th>Поручение</th><th>Ответственный</th><th>Срок</th><th>Приоритет</th><th>Статус</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="foot">Сформировано системой автоматического документирования совещаний РЖД · ${formatDate(new Date().toISOString())}</div>
    <script>window.onload=()=>{window.print()}</script>
    </body></html>`)
  win.document.close()
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
