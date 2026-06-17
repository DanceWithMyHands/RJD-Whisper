import { useMemo, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Box,
  Typography, Avatar, Chip, Divider, Paper, CircularProgress, Alert, TextField,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import EmailIcon from '@mui/icons-material/Email'
import type { Assignment, Participant } from '../api/types'
import { formatDate, initials } from '../utils/format'

interface Props {
  open: boolean
  assignments: Assignment[]
  participants: Participant[]
  sending?: boolean
  onClose: () => void
  onSend: () => void
}

export default function SendEmailDialog({ open, assignments, participants, sending, onClose, onSend }: Props) {
  const [subject, setSubject] = useState('Поручения по итогам совещания — РЖД')

  const byAssignee = useMemo(() => {
    const map = new Map<string | null, Assignment[]>()
    assignments.forEach((a) => {
      const arr = map.get(a.assignee_id) ?? []
      arr.push(a)
      map.set(a.assignee_id, arr)
    })
    return Array.from(map.entries()).map(([pid, items]) => ({
      participant: participants.find((p) => p.id === pid) ?? null,
      items,
    }))
  }, [assignments, participants])

  return (
    <Dialog open={open} onClose={sending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <EmailIcon color="primary" />
          Рассылка поручений по электронной почте
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Тема письма" fullWidth value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Alert severity="info" sx={{ py: 0.5 }}>
            Каждому ответственному будет отправлено персональное письмо с его поручениями и сроками.
          </Alert>
          {byAssignee.length === 0 && (
            <Typography color="text.secondary">Нет подтверждённых поручений для отправки.</Typography>
          )}
          {byAssignee.map(({ participant, items }, idx) => (
            <Paper key={participant?.id ?? `none-${idx}`} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                <Avatar sx={{ bgcolor: participant?.speaker_color ?? '#999', width: 36, height: 36, fontSize: 13 }}>
                  {participant ? initials(participant.name) : '—'}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap>
                    {participant?.name ?? 'Без ответственного'}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>
                    {participant?.email ?? 'email не указан'}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }} />
                <Chip size="small" label={`${items.length} пор.`} />
              </Stack>
              <Divider sx={{ mb: 1 }} />
              <Stack spacing={0.5}>
                {items.map((a) => (
                  <Typography key={a.id} sx={{ fontSize: 13 }}>
                    • {a.title}{' '}
                    <Box component="span" sx={{ color: 'text.secondary' }}>
                      ({a.due_date ? `до ${formatDate(a.due_date)}` : 'без срока'})
                    </Box>
                  </Typography>
                ))}
              </Stack>
            </Paper>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={sending}>Отмена</Button>
        <Button
          variant="contained" onClick={onSend} disabled={sending || assignments.length === 0}
          startIcon={sending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
        >
          {sending ? 'Отправка…' : `Отправить (${assignments.length})`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
