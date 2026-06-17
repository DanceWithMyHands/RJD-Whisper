import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Typography, Button, Stack, TextField,
  MenuItem, Avatar, Chip, Alert, Autocomplete, CircularProgress, LinearProgress,
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import AudioFileIcon from '@mui/icons-material/AudioFile'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import PageHeader from '../components/PageHeader'
import { useActiveMeeting } from '../store/ActiveMeetingContext'
import { useCreateMeeting, useUserDirectory } from '../hooks/queries'
import { transcribeAudio } from '../api/endpoints'
import { apiErrorMessage } from '../api/client'
import { roleLabels, type MeetingPlatform, type UserDirectoryItem } from '../api/types'
import { initials } from '../utils/format'

const ACCEPT = '.mp3,.wav,.m4a,.ogg,.oga,.opus,.flac,.webm,.mp4,.mpeg,.mpga,.aac,.wma,audio/*'

type Phase = 'idle' | 'creating' | 'transcribing'

export default function UploadPage() {
  const navigate = useNavigate()
  const { setActiveMeetingId } = useActiveMeeting()
  const createMeeting = useCreateMeeting()
  const directoryQuery = useUserDirectory()
  const directory = directoryQuery.data ?? []
  const fileRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('Совещание (загрузка аудио)')
  const [platform, setPlatform] = useState<MeetingPlatform>('cisco_jabber')
  const [department, setDepartment] = useState('Дистанция пути Москва-Сортировочная')
  const [selected, setSelected] = useState<UserDirectoryItem[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)

  const busy = phase !== 'idle'
  const valid = title.trim() && selected.length > 0 && file

  const submit = async () => {
    if (!file) return
    setError(null)
    try {
      setPhase('creating')
      const meeting = await createMeeting.mutateAsync({
        title,
        platform,
        department: department || null,
        participant_ids: selected.map((u) => u.id),
      })
      setActiveMeetingId(meeting.id)
      setPhase('transcribing')
      await transcribeAudio(meeting.id, file)
      navigate('/transcript')
    } catch (err) {
      setError(apiErrorMessage(err))
      setPhase('idle')
    }
  }

  if (phase === 'transcribing') {
    return (
      <Box>
        <PageHeader title="Распознавание аудио" subtitle="Файл обрабатывается ASR-моделью и LLM" />
        <Card>
          <CardContent sx={{ py: 5 }}>
            <Stack alignItems="center" spacing={3}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 72, height: 72 }}>
                <AutoAwesomeIcon sx={{ fontSize: 36 }} />
              </Avatar>
              <Typography variant="h6" textAlign="center">
                Распознаём «{file?.name}» и выделяем поручения…
              </Typography>
              <Box sx={{ width: '100%', maxWidth: 480 }}><LinearProgress /></Box>
              <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                Для длинной записи это может занять до нескольких минут.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    )
  }

  return (
    <Box>
      <PageHeader
        title="Загрузка аудиозаписи"
        subtitle="Альтернатива записи через бота: загрузите готовый файл совещания для расшифровки"
      />

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Параметры совещания</Typography>
              <Stack spacing={2}>
                <TextField label="Название" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} />
                <TextField select label="Платформа" fullWidth value={platform} onChange={(e) => setPlatform(e.target.value as MeetingPlatform)}>
                  <MenuItem value="cisco_jabber">Cisco Jabber</MenuItem>
                  <MenuItem value="yandex_telemost">Яндекс Телемост</MenuItem>
                </TextField>
                <TextField label="Подразделение" fullWidth value={department} onChange={(e) => setDepartment(e.target.value)} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 0.5 }}>Участники</Typography>
              <Typography color="text.secondary" sx={{ fontSize: 13, mb: 2 }}>
                Выберите участников из справочника (для привязки поручений к ответственным).
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
                    <Chip {...getTagProps({ index })} key={option.id}
                      avatar={<Avatar>{initials(option.full_name)}</Avatar>} label={option.full_name} />
                  ))
                }
                renderInput={(params) => (
                  <TextField {...params} label="Выберите участников" placeholder="Поиск по ФИО…" />
                )}
              />

              <Box
                onClick={() => fileRef.current?.click()}
                sx={{
                  mt: 2.5, p: 3, border: '2px dashed', borderColor: file ? 'primary.main' : 'divider',
                  borderRadius: 2, textAlign: 'center', cursor: 'pointer',
                  bgcolor: file ? 'rgba(226,26,26,0.04)' : 'transparent',
                  transition: 'border-color .2s',
                }}
              >
                <input
                  ref={fileRef} type="file" accept={ACCEPT} hidden
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <Stack alignItems="center" spacing={1}>
                    <AudioFileIcon color="primary" sx={{ fontSize: 36 }} />
                    <Typography sx={{ fontWeight: 600 }}>{file.name}</Typography>
                    <Typography color="text.secondary" sx={{ fontSize: 12.5 }}>
                      {(file.size / 1024 / 1024).toFixed(1)} МБ · нажмите, чтобы заменить
                    </Typography>
                  </Stack>
                ) : (
                  <Stack alignItems="center" spacing={1}>
                    <UploadFileIcon sx={{ fontSize: 36, color: 'text.secondary' }} />
                    <Typography sx={{ fontWeight: 600 }}>Выберите аудиофайл</Typography>
                    <Typography color="text.secondary" sx={{ fontSize: 12.5 }}>
                      mp3, wav, m4a, ogg, flac, webm, mp4 и др.
                    </Typography>
                  </Stack>
                )}
              </Box>

              {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

              <Button
                sx={{ mt: 2.5 }} variant="contained" size="large" disabled={!valid || busy}
                startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
                onClick={submit}
              >
                {phase === 'creating' ? 'Создание…' : 'Распознать и выделить поручения'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
