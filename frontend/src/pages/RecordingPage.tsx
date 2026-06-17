import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Typography, Button, Stack, Avatar,
  Chip, Alert, LinearProgress, List, ListItem, ListItemAvatar,
  ListItemText, Divider,
} from '@mui/material'
import MicIcon from '@mui/icons-material/Mic'
import StopIcon from '@mui/icons-material/Stop'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import GraphicEqIcon from '@mui/icons-material/GraphicEq'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import PageHeader from '../components/PageHeader'
import { Loading } from '../components/QueryState'
import { useActiveMeeting } from '../store/ActiveMeetingContext'
import { useMeeting, useStartRecording, useStopRecording } from '../hooks/queries'
import { apiErrorMessage } from '../api/client'
import { formatDuration, initials } from '../utils/format'

const PROCESS_STAGES = [
  'Загрузка аудио в объектное хранилище (S3)…',
  'Распознавание речи (Whisper)…',
  'Идентификация говорящих…',
  'Суммаризация и выделение поручений (LLM)…',
  'Формирование протокола…',
]

export default function RecordingPage() {
  const navigate = useNavigate()
  const { activeMeetingId } = useActiveMeeting()
  const meetingQuery = useMeeting(activeMeetingId)
  const meeting = meetingQuery.data
  const startRec = useStartRecording(activeMeetingId ?? '')
  const stopRec = useStopRecording(activeMeetingId ?? '')

  const [elapsed, setElapsed] = useState(0)
  const [bars, setBars] = useState<number[]>(Array.from({ length: 32 }, () => 0.2))
  const [stageIdx, setStageIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const waveRef = useRef<number | null>(null)
  const stageRef = useRef<number | null>(null)

  const isRecording = meeting?.recording_state === 'recording'
  const isProcessing = meeting?.recording_state === 'processing' || stopRec.isPending

  // Таймер/волны как индикация во время записи
  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000)
      waveRef.current = window.setInterval(
        () => setBars(Array.from({ length: 32 }, () => 0.15 + Math.random() * 0.85)), 180,
      )
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (waveRef.current) clearInterval(waveRef.current)
    }
  }, [isRecording])

  // Имитация прогресса этапов обработки
  useEffect(() => {
    if (isProcessing) {
      stageRef.current = window.setInterval(
        () => setStageIdx((s) => Math.min(s + 1, PROCESS_STAGES.length - 1)), 700,
      )
    } else {
      setStageIdx(0)
    }
    return () => {
      if (stageRef.current) clearInterval(stageRef.current)
    }
  }, [isProcessing])

  if (activeMeetingId && meetingQuery.isLoading) return <Loading />

  if (!meeting) {
    return (
      <Box>
        <PageHeader title="Запись совещания" />
        <Alert severity="info" action={<Button color="inherit" onClick={() => navigate('/connect')}>Создать</Button>}>
          Нет активного совещания. Создайте совещание и подключите бота.
        </Alert>
      </Box>
    )
  }

  const allGranted = meeting.participants.length > 0 &&
    meeting.participants.every((p) => p.consent === 'granted')
  const canStart = allGranted && ['awaiting_consent', 'idle', 'paused'].includes(meeting.recording_state)

  const handleStart = async () => {
    setError(null)
    setElapsed(0)
    try { await startRec.mutateAsync() } catch (e) { setError(apiErrorMessage(e)) }
  }

  const handleStop = async () => {
    setError(null)
    try {
      await stopRec.mutateAsync()
      navigate('/transcript')
    } catch (e) { setError(apiErrorMessage(e)) }
  }

  if (isProcessing) {
    return (
      <Box>
        <PageHeader title="Обработка записи" subtitle="Система формирует транскрипт и поручения" />
        <Card>
          <CardContent sx={{ py: 5 }}>
            <Stack alignItems="center" spacing={3}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 72, height: 72 }}>
                <AutoAwesomeIcon sx={{ fontSize: 36 }} />
              </Avatar>
              <Typography variant="h6" textAlign="center">{PROCESS_STAGES[stageIdx]}</Typography>
              <Box sx={{ width: '100%', maxWidth: 480 }}>
                <LinearProgress />
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader
        title="Запись совещания"
        subtitle={meeting.title}
        action={<Chip color={isRecording ? 'error' : 'default'} icon={<MicIcon />} label={isRecording ? 'Идёт запись' : 'Ожидание'} />}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!allGranted && (
        <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => navigate('/connect')}>К согласию</Button>}>
          Запись недоступна: не все участники дали согласие.
        </Alert>
      )}

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary" sx={{ mb: 1 }}>Длительность записи</Typography>
              <Typography variant="h2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', mb: 3 }}>
                {formatDuration(elapsed)}
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.6, height: 90, mb: 4 }}>
                {bars.map((h, i) => (
                  <Box key={i} sx={{
                    width: 6, borderRadius: 3,
                    height: `${(isRecording ? h : 0.12) * 100}%`,
                    bgcolor: isRecording ? 'primary.main' : 'action.disabled',
                    transition: 'height 0.15s ease',
                  }} />
                ))}
              </Box>

              <Stack direction="row" spacing={2} justifyContent="center">
                {isRecording ? (
                  <Button variant="contained" color="primary" size="large" startIcon={<StopIcon />}
                    disabled={stopRec.isPending} onClick={handleStop}>
                    Остановить и обработать
                  </Button>
                ) : (
                  <Button variant="contained" size="large" startIcon={<PlayArrowIcon />}
                    disabled={!canStart || startRec.isPending} onClick={handleStart}>
                    {startRec.isPending ? 'Старт…' : 'Начать запись'}
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Alert severity="info" icon={<GraphicEqIcon />} sx={{ mt: 2.5 }}>
            После остановки запускается пайплайн: запись → S3 → Whisper → идентификация говорящих → LLM → поручения.
          </Alert>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Участники</Typography>
              <List disablePadding>
                {meeting.participants.map((p, i) => (
                  <Box key={p.id}>
                    {i > 0 && <Divider component="li" />}
                    <ListItem disableGutters>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: p.speaker_color ?? '#999', width: 36, height: 36, fontSize: 13 }}>
                          {initials(p.name)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={p.name} secondary={p.role}
                        primaryTypographyProps={{ fontSize: 13.5, fontWeight: 500 }}
                        secondaryTypographyProps={{ fontSize: 12 }}
                      />
                    </ListItem>
                  </Box>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
