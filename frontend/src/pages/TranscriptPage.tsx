import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Typography, Button, Stack, Avatar,
  Chip, TextField, InputAdornment, Divider, ToggleButtonGroup, ToggleButton, Tooltip,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn'
import SummarizeIcon from '@mui/icons-material/Summarize'
import SubtitlesIcon from '@mui/icons-material/Subtitles'
import PageHeader from '../components/PageHeader'
import { Loading, ErrorState, EmptyState } from '../components/QueryState'
import { useActiveMeeting } from '../store/ActiveMeetingContext'
import { useMeeting } from '../hooks/queries'
import { apiErrorMessage } from '../api/client'
import type { Participant } from '../api/types'
import { formatDuration, initials } from '../utils/format'

export default function TranscriptPage() {
  const navigate = useNavigate()
  const { activeMeetingId } = useActiveMeeting()
  const meetingQuery = useMeeting(activeMeetingId)
  const meeting = meetingQuery.data
  const [query, setQuery] = useState('')
  const [speakerFilter, setSpeakerFilter] = useState<string>('all')

  const taskSegmentIds = useMemo(
    () => new Set((meeting?.assignments ?? []).map((a) => a.source_segment_id).filter(Boolean)),
    [meeting?.assignments],
  )

  const participantById = useMemo(() => {
    const map = new Map<string, Participant>()
    meeting?.participants.forEach((p) => map.set(p.id, p))
    return map
  }, [meeting])

  if (!activeMeetingId) {
    return (
      <Box>
        <PageHeader title="Транскрипт" />
        <Card><CardContent>
          <EmptyState
            icon={<SubtitlesIcon sx={{ fontSize: 48, color: 'text.disabled' }} />}
            title="Нет активного совещания."
            action={<Button variant="contained" onClick={() => navigate('/archive')}>Выбрать в архиве</Button>}
          />
        </CardContent></Card>
      </Box>
    )
  }

  if (meetingQuery.isLoading) return <Loading />
  if (meetingQuery.isError || !meeting) {
    return <ErrorState message={apiErrorMessage(meetingQuery.error)} onRetry={() => meetingQuery.refetch()} />
  }

  if (meeting.transcript.length === 0) {
    return (
      <Box>
        <PageHeader title="Транскрипт" subtitle={meeting.title} />
        <Card><CardContent>
          <EmptyState
            icon={<SubtitlesIcon sx={{ fontSize: 48, color: 'text.disabled' }} />}
            title="Транскрипт ещё не сформирован — проведите запись и обработку."
            action={<Button variant="contained" onClick={() => navigate('/recording')}>К записи</Button>}
          />
        </CardContent></Card>
      </Box>
    )
  }

  const filtered = meeting.transcript.filter((seg) => {
    const matchSpeaker = speakerFilter === 'all' || seg.speaker_id === speakerFilter
    const matchQuery = !query || seg.text.toLowerCase().includes(query.toLowerCase())
    return matchSpeaker && matchQuery
  })

  return (
    <Box>
      <PageHeader
        title="Транскрипт совещания"
        subtitle={`${meeting.title} · ${meeting.transcript.length} реплик`}
        action={
          <Button variant="contained" startIcon={<AssignmentTurnedInIcon />} onClick={() => navigate('/assignments')}>
            Поручения ({meeting.assignments.length})
          </Button>
        }
      />

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
                <TextField
                  size="small" fullWidth placeholder="Поиск по тексту…"
                  value={query} onChange={(e) => setQuery(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                />
                <ToggleButtonGroup size="small" exclusive value={speakerFilter}
                  onChange={(_, v) => v && setSpeakerFilter(v)} sx={{ flexShrink: 0 }}>
                  <ToggleButton value="all">Все</ToggleButton>
                  {meeting.participants.map((p) => (
                    <ToggleButton key={p.id} value={p.id}>
                      <Avatar sx={{ bgcolor: p.speaker_color ?? '#999', width: 22, height: 22, fontSize: 10 }}>
                        {initials(p.name)}
                      </Avatar>
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Stack>

              <Stack spacing={2}>
                {filtered.map((seg) => {
                  const sp = seg.speaker_id ? participantById.get(seg.speaker_id) : undefined
                  const isTask = taskSegmentIds.has(seg.id)
                  return (
                    <Stack key={seg.id} direction="row" spacing={1.5}>
                      <Tooltip title={sp?.name ?? 'Неизвестный'}>
                        <Avatar sx={{ bgcolor: sp?.speaker_color ?? '#999', width: 38, height: 38, fontSize: 13, flexShrink: 0 }}>
                          {sp ? initials(sp.name) : '—'}
                        </Avatar>
                      </Tooltip>
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.3 }}>
                          <Typography sx={{ fontWeight: 600, fontSize: 13.5 }}>{sp?.name ?? 'Говорящий'}</Typography>
                          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{formatDuration(Math.round(seg.start_sec))}</Typography>
                          {isTask && (
                            <Chip size="small" color="primary" icon={<AssignmentTurnedInIcon />} label="Поручение" sx={{ height: 20, fontSize: 10.5 }} />
                          )}
                        </Stack>
                        <Typography sx={{
                          fontSize: 14.5, lineHeight: 1.55,
                          bgcolor: isTask ? 'rgba(226,26,26,0.06)' : 'transparent',
                          borderLeft: isTask ? '3px solid' : 'none', borderColor: 'primary.main',
                          pl: isTask ? 1.5 : 0, py: isTask ? 0.5 : 0, borderRadius: 1,
                        }}>
                          {seg.text}
                        </Typography>
                      </Box>
                    </Stack>
                  )
                })}
                {filtered.length === 0 && (
                  <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>Ничего не найдено.</Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <SummarizeIcon color="primary" />
                <Typography variant="h6">Краткое содержание</Typography>
              </Stack>
              <Typography sx={{ fontSize: 14, lineHeight: 1.6, color: 'text.secondary', mb: 2 }}>
                {meeting.summary || 'Краткое содержание будет сформировано после обработки.'}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography sx={{ fontWeight: 600, fontSize: 13.5, mb: 1 }}>Говорящие</Typography>
              <Stack spacing={1}>
                {meeting.participants.map((p) => {
                  const count = meeting.transcript.filter((s) => s.speaker_id === p.id).length
                  return (
                    <Stack key={p.id} direction="row" spacing={1.5} alignItems="center">
                      <Avatar sx={{ bgcolor: p.speaker_color ?? '#999', width: 30, height: 30, fontSize: 12 }}>
                        {initials(p.name)}
                      </Avatar>
                      <Typography sx={{ fontSize: 13.5, flex: 1 }} noWrap>{p.name}</Typography>
                      <Chip size="small" label={`${count} реплик`} variant="outlined" />
                    </Stack>
                  )
                })}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
