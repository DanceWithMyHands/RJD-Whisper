import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Typography, Button, Stack, Avatar,
  Chip, Alert, LinearProgress, List, ListItem, ListItemAvatar,
  ListItemText, Divider, Tooltip,
} from '@mui/material'
import MicIcon from '@mui/icons-material/Mic'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import GraphicEqIcon from '@mui/icons-material/GraphicEq'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import PageHeader from '../components/PageHeader'
import { useMeeting } from '../store/MeetingContext'
import { formatDuration, initials } from '../utils/format'

const PROCESS_STAGES = [
  'Загрузка аудио в объектное хранилище (S3)…',
  'Распознавание речи (Whisper)…',
  'Идентификация говорящих…',
  'Суммаризация и выделение поручений (LLM Qwen3)…',
  'Формирование структурированного протокола…',
]

export default function RecordingPage() {
  const navigate = useNavigate()
  const { meeting, setRecordingState } = useMeeting()

  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(meeting.recordingState === 'recording')
  const [processing, setProcessing] = useState(false)
  const [stage, setStage] = useState(0)
  const [bars, setBars] = useState<number[]>(Array.from({ length: 32 }, () => 0.2))
  const timerRef = useRef<number | null>(null)
  const waveRef = useRef<number | null>(null)

  const consentOk = meeting.participants.every((p) => p.consent === 'granted')

  useEffect(() => {
    if (running) {
      timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000)
      waveRef.current = window.setInterval(
        () => setBars(Array.from({ length: 32 }, () => 0.15 + Math.random() * 0.85)),
        180,
      )
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (waveRef.current) clearInterval(waveRef.current)
    }
  }, [running])

  const handleStop = () => {
    setRunning(false)
    setProcessing(true)
    setRecordingState('processing')
    let s = 0
    const iv = window.setInterval(() => {
      s += 1
      setStage(s)
      if (s >= PROCESS_STAGES.length) {
        clearInterval(iv)
        setRecordingState('done')
        setTimeout(() => navigate('/transcript'), 600)
      }
    }, 900)
  }

  if (!consentOk) {
    return (
      <Box>
        <PageHeader title="Запись совещания" />
        <Alert severity="warning" action={<Button color="inherit" onClick={() => navigate('/connect')}>К подключению</Button>}>
          Запись недоступна: не все участники дали согласие. Сначала подключите бота и получите согласие.
        </Alert>
      </Box>
    )
  }

  if (processing) {
    return (
      <Box>
        <PageHeader title="Обработка записи" subtitle="Система обрабатывает аудио и формирует поручения" />
        <Card>
          <CardContent sx={{ py: 5 }}>
            <Stack alignItems="center" spacing={3}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 72, height: 72 }}>
                <AutoAwesomeIcon sx={{ fontSize: 36 }} />
              </Avatar>
              <Typography variant="h6" textAlign="center">
                {PROCESS_STAGES[Math.min(stage, PROCESS_STAGES.length - 1)]}
              </Typography>
              <Box sx={{ width: '100%', maxWidth: 480 }}>
                <LinearProgress variant="determinate" value={(stage / PROCESS_STAGES.length) * 100} sx={{ height: 8, borderRadius: 4 }} />
                <Typography color="text.secondary" textAlign="center" sx={{ mt: 1.5, fontSize: 13 }}>
                  Шаг {Math.min(stage + 1, PROCESS_STAGES.length)} из {PROCESS_STAGES.length}
                </Typography>
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
        action={<Chip color={running ? 'error' : 'default'} icon={<MicIcon />} label={running ? 'Идёт запись' : 'Пауза'} />}
      />

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary" sx={{ mb: 1 }}>Длительность записи</Typography>
              <Typography variant="h2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', mb: 3 }}>
                {formatDuration(elapsed)}
              </Typography>

              {/* Визуализация аудиопотока */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.6, height: 90, mb: 4 }}>
                {bars.map((h, i) => (
                  <Box
                    key={i}
                    sx={{
                      width: 6,
                      borderRadius: 3,
                      height: `${(running ? h : 0.12) * 100}%`,
                      bgcolor: running ? 'primary.main' : 'action.disabled',
                      transition: 'height 0.15s ease',
                    }}
                  />
                ))}
              </Box>

              <Stack direction="row" spacing={2} justifyContent="center">
                {running ? (
                  <Button variant="outlined" size="large" startIcon={<PauseIcon />}
                    onClick={() => { setRunning(false); setRecordingState('paused') }}>
                    Пауза
                  </Button>
                ) : (
                  <Button variant="outlined" size="large" startIcon={<PlayArrowIcon />}
                    onClick={() => { setRunning(true); setRecordingState('recording') }}>
                    Продолжить
                  </Button>
                )}
                <Button variant="contained" color="primary" size="large" startIcon={<StopIcon />} onClick={handleStop}>
                  Остановить и обработать
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Alert severity="info" icon={<GraphicEqIcon />} sx={{ mt: 2.5 }}>
            Аудиопоток пишется и сохраняется в объектное хранилище S3. После остановки запускается транскрибация
            (Whisper) и выделение поручений (LLM).
          </Alert>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Участники в эфире</Typography>
              <List disablePadding>
                {meeting.participants.map((p, i) => (
                  <Box key={p.id}>
                    {i > 0 && <Divider component="li" />}
                    <ListItem disableGutters secondaryAction={
                      running && i === elapsed % meeting.participants.length ? (
                        <Tooltip title="Говорит сейчас">
                          <VolumeUpIcon color="primary" />
                        </Tooltip>
                      ) : null
                    }>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: p.speakerColor, width: 36, height: 36, fontSize: 13 }}>
                          {initials(p.name)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={p.name}
                        secondary={p.role}
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
