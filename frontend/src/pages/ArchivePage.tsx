import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Typography, Stack, Chip, TextField,
  InputAdornment, MenuItem, Button, Divider,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import EventIcon from '@mui/icons-material/Event'
import ScheduleIcon from '@mui/icons-material/Schedule'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import PdfIcon from '@mui/icons-material/PictureAsPdf'
import InventoryIcon from '@mui/icons-material/Inventory2'
import PageHeader from '../components/PageHeader'
import { Loading, ErrorState, EmptyState } from '../components/QueryState'
import { useMeetings } from '../hooks/queries'
import { useActiveMeeting } from '../store/ActiveMeetingContext'
import { downloadExport } from '../api/endpoints'
import { apiErrorMessage } from '../api/client'
import { platformLabels, recordingStateLabels, type MeetingPlatform } from '../api/types'
import { formatDate, formatDuration } from '../utils/format'

export default function ArchivePage() {
  const navigate = useNavigate()
  const meetingsQuery = useMeetings(100, 0)
  const { activeMeetingId, setActiveMeetingId } = useActiveMeeting()
  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState<string>('all')

  if (meetingsQuery.isLoading) return <Loading />
  if (meetingsQuery.isError) {
    return <ErrorState message={apiErrorMessage(meetingsQuery.error)} onRetry={() => meetingsQuery.refetch()} />
  }

  const all = meetingsQuery.data?.items ?? []
  const filtered = all.filter((m) => {
    const matchQuery = !query ||
      m.title.toLowerCase().includes(query.toLowerCase()) ||
      (m.department ?? '').toLowerCase().includes(query.toLowerCase())
    const matchPlatform = platform === 'all' || m.platform === platform
    return matchQuery && matchPlatform
  })

  const open = (id: string, to: string) => { setActiveMeetingId(id); navigate(to) }

  return (
    <Box>
      <PageHeader title="Архив совещаний" subtitle="Хранилище записей, транскриптов и поручений" />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
        <TextField
          size="small" placeholder="Поиск по названию или подразделению…"
          value={query} onChange={(e) => setQuery(e.target.value)} sx={{ flex: 1 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <TextField select size="small" label="Платформа" value={platform} onChange={(e) => setPlatform(e.target.value as MeetingPlatform | 'all')} sx={{ minWidth: 200 }}>
          <MenuItem value="all">Все платформы</MenuItem>
          <MenuItem value="cisco_jabber">Cisco Jabber</MenuItem>
          <MenuItem value="yandex_telemost">Яндекс Телемост</MenuItem>
        </TextField>
      </Stack>

      {filtered.length === 0 ? (
        <Card><CardContent>
          <EmptyState icon={<InventoryIcon sx={{ fontSize: 40, color: 'text.disabled' }} />} title="Совещания не найдены." />
        </CardContent></Card>
      ) : (
        <Grid container spacing={2.5}>
          {filtered.map((m) => (
            <Grid item xs={12} md={6} key={m.id}>
              <Card sx={{ height: '100%', outline: m.id === activeMeetingId ? '2px solid' : 'none', outlineColor: 'primary.main' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                    <Chip size="small" label={platformLabels[m.platform]} color="secondary" variant="outlined" />
                    <Chip size="small" label={recordingStateLabels[m.recording_state]} color={m.recording_state === 'done' ? 'success' : 'default'} />
                  </Stack>
                  <Typography variant="h6" sx={{ mb: 0.5, fontSize: 17 }}>{m.title}</Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 13, mb: 1.5 }}>{m.department ?? '—'}</Typography>

                  <Stack direction="row" spacing={2} sx={{ mb: 2, color: 'text.secondary' }}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <EventIcon sx={{ fontSize: 16 }} />
                      <Typography sx={{ fontSize: 13 }}>{m.scheduled_at ? formatDate(m.scheduled_at) : '—'}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <ScheduleIcon sx={{ fontSize: 16 }} />
                      <Typography sx={{ fontSize: 13 }}>{formatDuration(m.duration_sec)}</Typography>
                    </Stack>
                  </Stack>

                  <Divider sx={{ mb: 1.5 }} />

                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="contained" startIcon={<OpenInNewIcon />} onClick={() => open(m.id, '/transcript')}>
                      Открыть
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => open(m.id, '/assignments')}>
                      Поручения
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    <Button size="small" variant="text" startIcon={<PdfIcon />} onClick={() => downloadExport(m.id, 'pdf')}>
                      PDF
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  )
}
