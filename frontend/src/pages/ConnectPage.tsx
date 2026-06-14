import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Typography, Button, Stack, TextField,
  MenuItem, Stepper, Step, StepLabel, Avatar, List, ListItem, ListItemAvatar,
  ListItemText, Chip, Alert, Divider, CircularProgress, LinearProgress,
} from '@mui/material'
import VideocamIcon from '@mui/icons-material/Videocam'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import PageHeader from '../components/PageHeader'
import { useMeeting } from '../store/MeetingContext'
import { initials } from '../utils/format'
import type { MeetingPlatform } from '../types'

const steps = ['Подключение бота', 'Согласие участников', 'Готов к записи']

export default function ConnectPage() {
  const navigate = useNavigate()
  const { meeting, setRecordingState, setConsent, grantAllConsent } = useMeeting()

  const [platform, setPlatform] = useState<MeetingPlatform>('Cisco Jabber')
  const [link, setLink] = useState('https://jabber.rzd.ru/meet/operativka-0608')
  const [activeStep, setActiveStep] = useState(0)
  const [connecting, setConnecting] = useState(false)

  const grantedCount = meeting.participants.filter((p) => p.consent === 'granted').length
  const allGranted = grantedCount === meeting.participants.length
  const anyDeclined = meeting.participants.some((p) => p.consent === 'declined')

  const handleConnect = () => {
    setConnecting(true)
    setRecordingState('connecting')
    setTimeout(() => {
      setConnecting(false)
      setActiveStep(1)
      setRecordingState('awaiting_consent')
      // По умолчанию запрашиваем согласие — статусы pending
      meeting.participants.forEach((p) => setConsent(p.id, 'pending'))
    }, 1400)
  }

  const handleStartRecording = () => {
    setRecordingState('recording')
    navigate('/recording')
  }

  return (
    <Box>
      <PageHeader
        title="Подключение бота к видеоконференции"
        subtitle="Бот-участник подключается к встрече и запрашивает согласие на запись у всех участников"
      />

      <Stepper activeStep={activeStep} sx={{ mb: 3 }} alternativeLabel>
        {steps.map((s) => (
          <Step key={s}><StepLabel>{s}</StepLabel></Step>
        ))}
      </Stepper>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                <Avatar sx={{ bgcolor: 'secondary.main' }}><SmartToyIcon /></Avatar>
                <Box>
                  <Typography variant="h6">Параметры подключения</Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>Бот «РЖД-Протокол»</Typography>
                </Box>
              </Stack>

              <TextField
                select fullWidth label="Платформа" value={platform}
                onChange={(e) => setPlatform(e.target.value as MeetingPlatform)}
                sx={{ mb: 2 }} disabled={activeStep > 0}
              >
                <MenuItem value="Cisco Jabber">Cisco Jabber</MenuItem>
                <MenuItem value="Яндекс Телемост">Яндекс Телемост</MenuItem>
              </TextField>

              <TextField
                fullWidth label="Ссылка на конференцию" value={link}
                onChange={(e) => setLink(e.target.value)} sx={{ mb: 2 }} disabled={activeStep > 0}
              />

              <TextField
                fullWidth label="Название совещания" defaultValue={meeting.title}
                sx={{ mb: 2 }} disabled={activeStep > 0}
              />

              {activeStep === 0 && (
                <Button
                  fullWidth variant="contained" size="large"
                  startIcon={connecting ? <CircularProgress size={18} color="inherit" /> : <VideocamIcon />}
                  disabled={connecting || !link}
                  onClick={handleConnect}
                >
                  {connecting ? 'Подключение бота…' : 'Подключить бота'}
                </Button>
              )}

              {activeStep >= 1 && (
                <Alert severity="success" icon={<CheckCircleIcon />}>
                  Бот подключён к конференции «{platform}»
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6">Согласие на запись</Typography>
                <Chip
                  label={`${grantedCount} / ${meeting.participants.length} согласны`}
                  color={allGranted ? 'success' : 'warning'}
                  size="small"
                />
              </Stack>
              <Typography color="text.secondary" sx={{ fontSize: 13.5, mb: 2 }}>
                Согласно ТЗ запись начинается только после согласия всех участников.
                Бот направил каждому запрос в чат конференции.
              </Typography>

              {activeStep >= 1 && !allGranted && (
                <LinearProgress sx={{ mb: 2, borderRadius: 5, height: 6 }} />
              )}

              <List disablePadding>
                {meeting.participants.map((p, i) => (
                  <Box key={p.id}>
                    {i > 0 && <Divider component="li" />}
                    <ListItem
                      disableGutters
                      secondaryAction={<ConsentBadge status={activeStep === 0 ? 'idle' : p.consent} />}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: p.speakerColor, width: 38, height: 38, fontSize: 14 }}>
                          {initials(p.name)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={p.name}
                        secondary={`${p.role} · ${p.email}`}
                        primaryTypographyProps={{ fontSize: 14.5, fontWeight: 500 }}
                        secondaryTypographyProps={{ fontSize: 12.5 }}
                      />
                    </ListItem>
                  </Box>
                ))}
              </List>

              {activeStep === 1 && (
                <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    onClick={() => { grantAllConsent(); setActiveStep(2); setRecordingState('idle') }}
                  >
                    Все согласны (демо)
                  </Button>
                  <Button
                    variant="outlined" color="inherit"
                    onClick={() => setConsent(meeting.participants[meeting.participants.length - 1].id, 'declined')}
                  >
                    Отметить отказ
                  </Button>
                </Stack>
              )}

              {anyDeclined && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Один из участников отказался от записи. Запись не может быть начата без согласия всех сторон.
                </Alert>
              )}

              {activeStep === 2 && allGranted && (
                <Alert severity="success" sx={{ mt: 2 }} icon={<CheckCircleIcon />}>
                  Все участники дали согласие. Можно начинать запись.
                </Alert>
              )}
            </CardContent>
          </Card>

          {activeStep === 2 && allGranted && (
            <Button
              fullWidth variant="contained" color="primary" size="large" sx={{ mt: 2.5 }}
              startIcon={<VideocamIcon />} onClick={handleStartRecording}
            >
              Перейти к записи совещания
            </Button>
          )}
        </Grid>
      </Grid>
    </Box>
  )
}

function ConsentBadge({ status }: { status: 'idle' | 'pending' | 'granted' | 'declined' }) {
  if (status === 'idle') return <Chip size="small" label="Ожидает подключения" variant="outlined" />
  if (status === 'pending')
    return <Chip size="small" icon={<HourglassEmptyIcon />} label="Ожидание ответа" color="warning" variant="outlined" />
  if (status === 'granted')
    return <Chip size="small" icon={<CheckCircleIcon />} label="Согласен" color="success" />
  return <Chip size="small" icon={<CancelIcon />} label="Отказ" color="error" />
}
