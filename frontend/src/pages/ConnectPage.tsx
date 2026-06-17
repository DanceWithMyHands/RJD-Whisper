import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Typography, Button, Stack, TextField,
  MenuItem, Stepper, Step, StepLabel, Avatar, List, ListItem, ListItemAvatar,
  ListItemText, Chip, Alert, Divider, IconButton, CircularProgress, Tooltip,
  Autocomplete,
} from '@mui/material'
import VideocamIcon from '@mui/icons-material/Videocam'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import PageHeader from '../components/PageHeader'
import { Loading } from '../components/QueryState'
import { useActiveMeeting } from '../store/ActiveMeetingContext'
import {
  useMeeting, useCreateMeeting, useConnectBot, useGrantAllConsent, useSetConsent,
  useUserDirectory,
} from '../hooks/queries'
import { apiErrorMessage } from '../api/client'
import type {
  ConsentStatus, MeetingDetail, MeetingPlatform, UserDirectoryItem,
} from '../api/types'
import { roleLabels } from '../api/types'
import { initials } from '../utils/format'

const steps = ['Создание', 'Подключение бота', 'Согласие', 'Готово']

export default function ConnectPage() {
  const navigate = useNavigate()
  const { activeMeetingId, setActiveMeetingId } = useActiveMeeting()
  const meetingQuery = useMeeting(activeMeetingId)
  const meeting = meetingQuery.data

  const inWizard = Boolean(
    meeting && ['idle', 'connecting', 'awaiting_consent', 'failed'].includes(meeting.recording_state),
  )

  if (activeMeetingId && meetingQuery.isLoading) return <Loading />

  return inWizard && meeting ? (
    <SetupWizard
      meeting={meeting}
      onReset={() => setActiveMeetingId(null)}
      onReady={() => navigate('/recording')}
    />
  ) : (
    <CreateForm onCreated={(id) => setActiveMeetingId(id)} />
  )
}

// ---------- Шаг создания ----------

function CreateForm({ onCreated }: { onCreated: (id: string) => void }) {
  const createMeeting = useCreateMeeting()
  const directoryQuery = useUserDirectory()
  const directory = directoryQuery.data ?? []

  const [title, setTitle] = useState('Оперативное совещание дистанции пути')
  const [platform, setPlatform] = useState<MeetingPlatform>('cisco_jabber')
  const [url, setUrl] = useState('https://jabber.rzd.ru/meet/operativka')
  const [department, setDepartment] = useState('Дистанция пути Москва-Сортировочная')
  const [organizer, setOrganizer] = useState('Соколов Андрей Петрович')
  const [selected, setSelected] = useState<UserDirectoryItem[]>([])
  const [error, setError] = useState<string | null>(null)

  const valid = title.trim() && selected.length > 0

  const submit = async () => {
    setError(null)
    try {
      const created = await createMeeting.mutateAsync({
        title,
        platform,
        conference_url: url || null,
        department: department || null,
        organizer_name: organizer || null,
        participant_ids: selected.map((u) => u.id),
      })
      onCreated(created.id)
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  return (
    <Box>
      <PageHeader
        title="Новое совещание"
        subtitle="Выберите участников из справочника пользователей и подключите бота для записи"
      />
      <Stepper activeStep={0} sx={{ mb: 3 }} alternativeLabel>
        {steps.map((s) => <Step key={s}><StepLabel>{s}</StepLabel></Step>)}
      </Stepper>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Параметры</Typography>
              <Stack spacing={2}>
                <TextField label="Название совещания" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} />
                <TextField select label="Платформа" fullWidth value={platform} onChange={(e) => setPlatform(e.target.value as MeetingPlatform)}>
                  <MenuItem value="cisco_jabber">Cisco Jabber</MenuItem>
                  <MenuItem value="yandex_telemost">Яндекс Телемост</MenuItem>
                </TextField>
                <TextField label="Ссылка на конференцию" fullWidth value={url} onChange={(e) => setUrl(e.target.value)} />
                <TextField label="Подразделение" fullWidth value={department} onChange={(e) => setDepartment(e.target.value)} />
                <TextField label="Организатор" fullWidth value={organizer} onChange={(e) => setOrganizer(e.target.value)} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 0.5 }}>Участники</Typography>
              <Typography color="text.secondary" sx={{ fontSize: 13, mb: 2 }}>
                Добавить можно только пользователей из базы. Нет нужного человека — заведите его на экране «Пользователи».
              </Typography>

              <Autocomplete
                multiple
                options={directory}
                loading={directoryQuery.isLoading}
                value={selected}
                onChange={(_, v) => setSelected(v)}
                getOptionLabel={(o) => o.full_name}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderOption={(props, option) => (
                  <Box component="li" {...props} key={option.id}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: 12, mr: 1.5, bgcolor: 'secondary.main' }}>
                      {initials(option.full_name)}
                    </Avatar>
                    <Box>
                      <Typography sx={{ fontSize: 14 }}>{option.full_name}</Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {[option.position, roleLabels[option.role]].filter(Boolean).join(' · ')}
                      </Typography>
                    </Box>
                  </Box>
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option.id}
                      avatar={<Avatar>{initials(option.full_name)}</Avatar>}
                      label={option.full_name}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField {...params} label="Выберите участников" placeholder="Поиск по ФИО…" />
                )}
              />

              {directory.length === 0 && !directoryQuery.isLoading && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  В справочнике нет пользователей. Заведите их на экране «Пользователи».
                </Alert>
              )}
              {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

              <Button
                sx={{ mt: 2.5 }} variant="contained" size="large" disabled={!valid || createMeeting.isPending}
                startIcon={createMeeting.isPending ? <CircularProgress size={18} color="inherit" /> : <VideocamIcon />}
                onClick={submit}
              >
                {createMeeting.isPending ? 'Создание…' : `Создать совещание (${selected.length})`}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

// ---------- Шаги бота и согласия ----------

function SetupWizard({ meeting, onReset, onReady }: { meeting: MeetingDetail; onReset: () => void; onReady: () => void }) {
  const connectBot = useConnectBot(meeting.id)
  const grantAll = useGrantAllConsent(meeting.id)
  const setConsent = useSetConsent(meeting.id)
  const [error, setError] = useState<string | null>(null)

  const grantedCount = meeting.participants.filter((p) => p.consent === 'granted').length
  const allGranted = meeting.participants.length > 0 && grantedCount === meeting.participants.length
  const anyDeclined = meeting.participants.some((p) => p.consent === 'declined')
  const botConnected = meeting.recording_state === 'awaiting_consent'
  const activeStep = !botConnected ? 1 : allGranted ? 3 : 2

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try { await fn() } catch (err) { setError(apiErrorMessage(err)) }
  }

  return (
    <Box>
      <PageHeader
        title="Подключение бота и согласие"
        subtitle={meeting.title}
        action={<Button variant="text" color="inherit" onClick={onReset}>Создать другое</Button>}
      />
      <Stepper activeStep={activeStep} sx={{ mb: 3 }} alternativeLabel>
        {steps.map((s) => <Step key={s}><StepLabel>{s}</StepLabel></Step>)}
      </Stepper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>Бот-участник</Typography>
              <Typography color="text.secondary" sx={{ fontSize: 13.5, mb: 2 }}>
                Бот подключается к конференции и запрашивает согласие участников на запись.
              </Typography>
              {!botConnected ? (
                <Button
                  fullWidth variant="contained" size="large"
                  startIcon={connectBot.isPending ? <CircularProgress size={18} color="inherit" /> : <VideocamIcon />}
                  disabled={connectBot.isPending}
                  onClick={() => run(() => connectBot.mutateAsync())}
                >
                  {connectBot.isPending ? 'Подключение…' : 'Подключить бота'}
                </Button>
              ) : (
                <Alert severity="success" icon={<CheckCircleIcon />}>Бот подключён к конференции</Alert>
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
                  color={allGranted ? 'success' : 'warning'} size="small"
                />
              </Stack>
              <Typography color="text.secondary" sx={{ fontSize: 13.5, mb: 2 }}>
                Запись начнётся только после согласия всех участников.
              </Typography>

              <List disablePadding>
                {meeting.participants.map((p, i) => (
                  <Box key={p.id}>
                    {i > 0 && <Divider component="li" />}
                    <ListItem
                      disableGutters
                      secondaryAction={
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <ConsentBadge status={p.consent} />
                          {botConnected && p.consent !== 'granted' && (
                            <Tooltip title="Отметить согласие">
                              <IconButton size="small" color="success"
                                onClick={() => run(() => setConsent.mutateAsync({ participantId: p.id, consent: 'granted' as ConsentStatus }))}>
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      }
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: p.speaker_color ?? '#999', width: 38, height: 38, fontSize: 14 }}>
                          {initials(p.name)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={p.name}
                        secondary={[p.role, p.email].filter(Boolean).join(' · ')}
                        primaryTypographyProps={{ fontSize: 14.5, fontWeight: 500 }}
                        secondaryTypographyProps={{ fontSize: 12.5 }}
                      />
                    </ListItem>
                  </Box>
                ))}
              </List>

              {botConnected && !allGranted && (
                <Button
                  sx={{ mt: 2 }} variant="contained" disabled={grantAll.isPending}
                  onClick={() => run(() => grantAll.mutateAsync())}
                >
                  {grantAll.isPending ? 'Запрос…' : 'Согласие всех участников'}
                </Button>
              )}

              {anyDeclined && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Кто-то отказался от записи — запись невозможна без согласия всех.
                </Alert>
              )}
              {allGranted && (
                <Alert severity="success" sx={{ mt: 2 }} icon={<CheckCircleIcon />}>
                  Все участники дали согласие. Можно начинать запись.
                </Alert>
              )}
            </CardContent>
          </Card>

          {allGranted && (
            <Button fullWidth variant="contained" size="large" sx={{ mt: 2.5 }} startIcon={<VideocamIcon />} onClick={onReady}>
              Перейти к записи
            </Button>
          )}
        </Grid>
      </Grid>
    </Box>
  )
}

function ConsentBadge({ status }: { status: ConsentStatus }) {
  if (status === 'pending')
    return <Chip size="small" icon={<HourglassEmptyIcon />} label="Ожидание" color="warning" variant="outlined" />
  if (status === 'granted')
    return <Chip size="small" icon={<CheckCircleIcon />} label="Согласен" color="success" />
  return <Chip size="small" icon={<CancelIcon />} label="Отказ" color="error" />
}
