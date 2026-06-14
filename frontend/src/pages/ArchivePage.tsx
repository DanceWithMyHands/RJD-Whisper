import { useMemo, useState } from 'react'
import {
  Box, Card, CardContent, Grid, Typography, Stack, Avatar, Chip, TextField,
  InputAdornment, MenuItem, AvatarGroup, Button, Divider, Tooltip,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import EventIcon from '@mui/icons-material/Event'
import ScheduleIcon from '@mui/icons-material/Schedule'
import DownloadIcon from '@mui/icons-material/Download'
import PdfIcon from '@mui/icons-material/PictureAsPdf'
import PageHeader from '../components/PageHeader'
import { useMeeting } from '../store/MeetingContext'
import { formatDate, formatDuration, initials } from '../utils/format'
import { exportPDF } from '../utils/export'
import type { Meeting } from '../types'

export default function ArchivePage() {
  const { meeting, archive } = useMeeting()
  const all = useMemo<Meeting[]>(() => [meeting, ...archive], [meeting, archive])

  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState('all')

  const filtered = all.filter((m) => {
    const matchQuery =
      !query ||
      m.title.toLowerCase().includes(query.toLowerCase()) ||
      m.department.toLowerCase().includes(query.toLowerCase())
    const matchPlatform = platform === 'all' || m.platform === platform
    return matchQuery && matchPlatform
  })

  return (
    <Box>
      <PageHeader
        title="Архив совещаний"
        subtitle="Хранилище записей, транскриптов и поручений прошедших совещаний"
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
        <TextField
          size="small" placeholder="Поиск по названию или подразделению…"
          value={query} onChange={(e) => setQuery(e.target.value)} sx={{ flex: 1 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <TextField
          select size="small" label="Платформа" value={platform}
          onChange={(e) => setPlatform(e.target.value)} sx={{ minWidth: 200 }}
        >
          <MenuItem value="all">Все платформы</MenuItem>
          <MenuItem value="Cisco Jabber">Cisco Jabber</MenuItem>
          <MenuItem value="Яндекс Телемост">Яндекс Телемост</MenuItem>
        </TextField>
      </Stack>

      <Grid container spacing={2.5}>
        {filtered.map((m) => {
          const sent = m.assignments.filter((a) => a.status === 'sent').length
          return (
            <Grid item xs={12} md={6} key={m.id}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                    <Chip size="small" label={m.platform} color="secondary" variant="outlined" />
                    {m.id === meeting.id && <Chip size="small" label="Текущее" color="primary" />}
                  </Stack>
                  <Typography variant="h6" sx={{ mb: 0.5, fontSize: 17 }}>{m.title}</Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 13, mb: 1.5 }}>{m.department}</Typography>

                  <Stack direction="row" spacing={2} sx={{ mb: 2, color: 'text.secondary' }}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <EventIcon sx={{ fontSize: 16 }} />
                      <Typography sx={{ fontSize: 13 }}>{formatDate(m.date)}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <ScheduleIcon sx={{ fontSize: 16 }} />
                      <Typography sx={{ fontSize: 13 }}>{formatDuration(m.durationSec)}</Typography>
                    </Stack>
                  </Stack>

                  <Divider sx={{ mb: 1.5 }} />

                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>Участники</Typography>
                      <AvatarGroup max={4} sx={{ mt: 0.5, justifyContent: 'flex-start', '& .MuiAvatar-root': { width: 30, height: 30, fontSize: 12 } }}>
                        {m.participants.map((p) => (
                          <Tooltip key={p.id} title={p.name}>
                            <Avatar sx={{ bgcolor: p.speakerColor }}>{initials(p.name)}</Avatar>
                          </Tooltip>
                        ))}
                      </AvatarGroup>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>Поручения</Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: 20 }}>
                        {m.assignments.length}
                        <Box component="span" sx={{ fontSize: 12, fontWeight: 400, color: 'success.main', ml: 0.5 }}>
                          ({sent} отпр.)
                        </Box>
                      </Typography>
                    </Box>
                  </Stack>

                  <Button
                    fullWidth variant="outlined" size="small" sx={{ mt: 2 }}
                    startIcon={<PdfIcon />} onClick={() => exportPDF(m)}
                  >
                    Протокол (PDF)
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
        {filtered.length === 0 && (
          <Grid item xs={12}>
            <Card><CardContent>
              <Stack alignItems="center" spacing={1.5} sx={{ py: 5 }}>
                <DownloadIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
                <Typography color="text.secondary">Совещания не найдены.</Typography>
              </Stack>
            </CardContent></Card>
          </Grid>
        )}
      </Grid>
    </Box>
  )
}
