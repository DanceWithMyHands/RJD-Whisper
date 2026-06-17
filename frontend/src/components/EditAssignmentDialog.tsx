import { useEffect, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  MenuItem, Stack, Box,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import dayjs from 'dayjs'
import type { Assignment, Participant, TaskPriority } from '../api/types'

export interface AssignmentFormValue {
  title: string
  description: string | null
  assignee_id: string | null
  due_date: string | null
  priority: TaskPriority
}

interface Props {
  open: boolean
  assignment: Assignment | null
  participants: Participant[]
  saving?: boolean
  onClose: () => void
  onSubmit: (value: AssignmentFormValue) => void
}

const empty = (): AssignmentFormValue => ({
  title: '',
  description: '',
  assignee_id: null,
  due_date: dayjs().add(7, 'day').format('YYYY-MM-DD'),
  priority: 'medium',
})

export default function EditAssignmentDialog({ open, assignment, participants, saving, onClose, onSubmit }: Props) {
  const [draft, setDraft] = useState<AssignmentFormValue>(empty())

  useEffect(() => {
    if (assignment) {
      setDraft({
        title: assignment.title,
        description: assignment.description,
        assignee_id: assignment.assignee_id,
        due_date: assignment.due_date,
        priority: assignment.priority,
      })
    } else {
      setDraft(empty())
    }
  }, [assignment, open])

  const valid = draft.title.trim().length > 0

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{assignment ? 'Редактирование поручения' : 'Новое поручение'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            label="Формулировка поручения" fullWidth value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus
          />
          <TextField
            label="Описание / контекст" fullWidth multiline minRows={3} value={draft.description ?? ''}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              select label="Ответственный" sx={{ flex: '1 1 200px' }} value={draft.assignee_id ?? ''}
              onChange={(e) => setDraft({ ...draft, assignee_id: e.target.value || null })}
            >
              <MenuItem value="">— не назначен —</MenuItem>
              {participants.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name}{p.role ? ` — ${p.role}` : ''}</MenuItem>
              ))}
            </TextField>
            <DatePicker
              label="Срок исполнения" format="DD.MM.YYYY"
              value={draft.due_date ? dayjs(draft.due_date) : null}
              onChange={(v) => setDraft({ ...draft, due_date: v ? v.format('YYYY-MM-DD') : null })}
              sx={{ flex: '1 1 160px' }}
            />
          </Box>
          <TextField
            select label="Приоритет" fullWidth value={draft.priority}
            onChange={(e) => setDraft({ ...draft, priority: e.target.value as TaskPriority })}
          >
            <MenuItem value="high">Высокий</MenuItem>
            <MenuItem value="medium">Средний</MenuItem>
            <MenuItem value="low">Низкий</MenuItem>
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Отмена</Button>
        <Button variant="contained" disabled={!valid || saving} onClick={() => onSubmit(draft)}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
