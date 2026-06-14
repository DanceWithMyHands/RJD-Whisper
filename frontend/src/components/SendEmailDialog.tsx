import { useMemo, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Box,
  Typography, Avatar, Chip, Divider, Paper, CircularProgress, Alert, TextField,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import EmailIcon from '@mui/icons-material/Email'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import type { Assignment, Participant } from '../types'
import { formatDate, initials } from '../utils/format'

interface Props {
  open: boolean
  assignments: Assignment[]
  participants: Participant[]
  onClose: () => void
  onSent: (ids: string[]) => void
}

export default function SendEmailDialog({ open, assignments, participants, onClose, onSent }: Props) {
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [subject, setSubject] = useState('Поручения по итогам совещания — РЖД')

  const byAssignee = useMemo(() => {
    const map = new Map<string, Assignment[]>()
    assignments.forEach((a) => {
      const arr = map.get(a.assigneeId) ?? []
      arr.push(a)
      map.set(a.assigneeId, arr)
    })
    return Array.from(map.entries()).map(([pid, items]) => ({
      participant: participants.find((p) => p.id === pid),
      items,
    }))
  }, [assignments, participants])

  const handleSend = () => {
    setSending(true)
    setTimeout(() => {
      setSending(false)
      setDone(true)
      onSent(assignments.map((a) => a.id))
    }, 1600)
  }

  const handleClose = () => {
    setDone(false)
    onClose()
  }

  return (
    <Dialog open={open} onClose={sending ? undefined : handleClose} fullWidth maxWidth="sm">
      <DialogTitle>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <EmailIcon color="primary" />
          Рассылка поручений по электронной почте
        </Stack>
      </DialogTitle>
      <DialogContent>
        {done ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 56 }} />
            <Typography variant="h6">Письма отправлены</Typography>
            <Typography color="text.secondary" textAlign="center">
              {assignments.length} поручений направлено {byAssignee.length} ответственным.
              Статус поручений обновлён на «Отправлено».
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Тема письма" fullWidth value={subject} onChange={(e) => setSubject(e.target.value)} />
            <Alert severity="info" sx={{ py: 0.5 }}>
              Каждому ответственному будет отправлено персональное письмо с его поручениями и сроками.
            </Alert>
            {byAssignee.map(({ participant, items }) => (
              <Paper key={participant?.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                  <Avatar sx={{ bgcolor: participant?.speakerColor, width: 36, height: 36, fontSize: 13 }}>
                    {participant ? initials(participant.name) : '—'}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap>{participant?.name}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>{participant?.email}</Typography>
                  </Box>
                  <Box sx={{ flex: 1 }} />
                  <Chip size="small" label={`${items.length} пор.`} />
                </Stack>
                <Divider sx={{ mb: 1 }} />
                <Stack spacing={0.5}>
                  {items.map((a) => (
                    <Typography key={a.id} sx={{ fontSize: 13 }}>
                      • {a.title} <Box component="span" sx={{ color: 'text.secondary' }}>(до {formatDate(a.dueDate)})</Box>
                    </Typography>
                  ))}
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {done ? (
          <Button variant="contained" onClick={handleClose}>Готово</Button>
        ) : (
          <>
            <Button onClick={handleClose} color="inherit" disabled={sending}>Отмена</Button>
            <Button
              variant="contained" onClick={handleSend} disabled={sending || assignments.length === 0}
              startIcon={sending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
            >
              {sending ? 'Отправка…' : `Отправить (${assignments.length})`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
