import { useEffect, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  MenuItem, Stack, Box,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import dayjs from 'dayjs'
import type { Assignment, Participant, TaskPriority } from '../types'

interface Props {
  open: boolean
  assignment: Assignment | null
  participants: Participant[]
  onClose: () => void
  onSave: (a: Assignment) => void
}

const empty = (): Assignment => ({
  id: `a-${Date.now()}`,
  title: '',
  description: '',
  assigneeId: '',
  dueDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
  priority: 'medium',
  status: 'draft',
})

export default function EditAssignmentDialog({ open, assignment, participants, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Assignment>(empty())

  useEffect(() => {
    setDraft(assignment ? { ...assignment } : empty())
  }, [assignment, open])

  const valid = draft.title.trim() && draft.assigneeId && draft.dueDate

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
            label="Описание / контекст" fullWidth multiline minRows={3} value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              select label="Ответственный" sx={{ flex: '1 1 200px' }} value={draft.assigneeId}
              onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value })}
            >
              {participants.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name} — {p.role}</MenuItem>
              ))}
            </TextField>
            <DatePicker
              label="Срок исполнения" format="DD.MM.YYYY"
              value={dayjs(draft.dueDate)}
              onChange={(v) => v && setDraft({ ...draft, dueDate: v.format('YYYY-MM-DD') })}
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
        <Button variant="contained" disabled={!valid} onClick={() => onSave(draft)}>Сохранить</Button>
      </DialogActions>
    </Dialog>
  )
}
