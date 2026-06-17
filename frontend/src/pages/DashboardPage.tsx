import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Typography, Button, Stack, Avatar,
  List, ListItem, ListItemAvatar, ListItemText, Chip, LinearProgress, Divider,
} from '@mui/material'
import VideocamIcon from '@mui/icons-material/Videocam'
import AssignmentIcon from '@mui/icons-material/AssignmentTurnedIn'
import GroupsIcon from '@mui/icons-material/Groups'
import ScheduleIcon from '@mui/icons-material/Schedule'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import PageHeader from '../components/PageHeader'
import { StatusChip } from '../components/StatusChips'
import { Loading, ErrorState } from '../components/QueryState'
import { useMeetings, useMeeting } from '../hooks/queries'
import { useActiveMeeting } from '../store/ActiveMeetingContext'
import { useAuth } from '../auth/AuthContext'
import { apiErrorMessage } from '../api/client'
import { isManagerial, platformLabels } from '../api/types'
import { formatDate, formatDateTime, formatDuration, initials, isOverdue } from '../utils/format'

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: string | number; label: string; color: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar sx={{ bgcolor: color, width: 48, height: 48 }}>{icon}</Avatar>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1 }}>{value}</Typography>
            <Typography color="text.secondary" sx={{ fontSize: 13.5 }}>{label}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const meetingsQuery = useMeetings()
  const { activeMeetingId, setActiveMeetingId } = useActiveMeeting()
  const { user } = useAuth()
  const canManage = isManagerial(user?.role)

  const meetings = meetingsQuery.data?.items ?? []
  // Активное совещание — выбранное либо самое свежее
  const focusId = activeMeetingId && meetings.some((m) => m.id === activeMeetingId)
    ? activeMeetingId
    : meetings[0]?.id ?? null
  const detailQuery = useMeeting(focusId)
  const detail = detailQuery.data

  useEffect(() => {
    if (!activeMeetingId && meetings[0]?.id) setActiveMeetingId(meetings[0].id)
  }, [activeMeetingId, meetings, setActiveMeetingId])

  if (meetingsQuery.isLoading) return <Loading />
  if (meetingsQuery.isError) {
    return <ErrorState message={apiErrorMessage(meetingsQuery.error)} onRetry={() => meetingsQuery.refetch()} />
  }

  const assignments = detail?.assignments ?? []
  const draft = assignments.filter((a) => a.status === 'draft').length
  const sent = assignments.filter((a) => a.status === 'sent').length
  const completionPct = assignments.length ? Math.round((sent / assignments.length) * 100) : 0

  return (
    <Box>
      <PageHeader
        title="Дашборд"
        subtitle="Сводка по совещаниям и поручениям подразделения"
        action={
          canManage ? (
            <Button variant="contained" size="large" startIcon={<VideocamIcon />} onClick={() => navigate('/connect')}>
              Новое совещание
            </Button>
          ) : undefined
        }
      />

      <Grid container spacing={2.5} sx={{ mb: 1 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<GroupsIcon />} value={meetingsQuery.data?.total ?? 0} label="Совещаний всего" color="#2C3E73" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<AssignmentIcon />} value={assignments.length} label="Поручений (тек. совещание)" color="#E21A1A" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<ScheduleIcon />} value={draft} label="Ждут подтверждения" color="#ED6C02" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<TaskAltIcon />} value={sent} label="Отправлено исполнителям" color="#2E7D32" />
        </Grid>
      </Grid>

      {meetings.length === 0 ? (
        <Card sx={{ mt: 1 }}>
          <CardContent>
            <Stack alignItems="center" spacing={2} sx={{ py: 5 }}>
              <Typography color="text.secondary">Совещаний пока нет. Создайте первое.</Typography>
              <Button variant="contained" startIcon={<VideocamIcon />} onClick={() => navigate('/connect')}>
                Новое совещание
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
          <Grid item xs={12} md={7}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                {detailQuery.isLoading || !detail ? (
                  <Loading label="Загрузка совещания…" />
                ) : (
                  <>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="h6">Текущее совещание</Typography>
                      <Chip label={platformLabels[detail.platform]} size="small" color="secondary" variant="outlined" />
                    </Stack>
                    <Typography variant="h5" sx={{ mb: 0.5 }}>{detail.title}</Typography>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>
                      {detail.scheduled_at ? formatDateTime(detail.scheduled_at) : '—'} ·{' '}
                      {formatDuration(detail.duration_sec)} · {detail.department ?? '—'}
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Typography sx={{ fontWeight: 600, mb: 1 }}>Поручения совещания</Typography>
                    {assignments.length === 0 ? (
                      <Typography color="text.secondary" sx={{ fontSize: 14 }}>
                        Поручений пока нет — проведите запись и обработку.
                      </Typography>
                    ) : (
                      <List dense disablePadding>
                        {assignments.map((a) => {
                          const assignee = detail.participants.find((p) => p.id === a.assignee_id)
                          return (
                            <ListItem key={a.id} disableGutters secondaryAction={<StatusChip status={a.status} />}>
                              <ListItemAvatar>
                                <Avatar sx={{ bgcolor: assignee?.speaker_color ?? '#999', width: 34, height: 34, fontSize: 13 }}>
                                  {assignee ? initials(assignee.name) : '—'}
                                </Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={a.title}
                                secondary={
                                  <Stack direction="row" spacing={1} alignItems="center" component="span">
                                    <span>{a.due_date ? `До ${formatDate(a.due_date)}` : 'Без срока'}</span>
                                    {a.due_date && isOverdue(a.due_date) && a.status !== 'sent' && (
                                      <Chip label="Просрочено" color="error" size="small" sx={{ height: 18, fontSize: 10 }} />
                                    )}
                                  </Stack>
                                }
                                primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }}
                              />
                            </ListItem>
                          )
                        })}
                      </List>
                    )}
                    <Button sx={{ mt: 2 }} variant="outlined" onClick={() => navigate('/assignments')}>
                      Перейти к поручениям
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={5}>
            <Stack spacing={2.5}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Исполнение поручений</Typography>
                  <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1 }}>
                    <Typography variant="h3" sx={{ fontWeight: 700 }}>{completionPct}%</Typography>
                    <Typography color="text.secondary">отправлено</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={completionPct} sx={{ height: 10, borderRadius: 5 }} />
                  <Typography color="text.secondary" sx={{ mt: 1.5, fontSize: 13 }}>
                    {sent} из {assignments.length} поручений направлены исполнителям
                  </Typography>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>Недавние совещания</Typography>
                  <List dense disablePadding>
                    {meetings.slice(0, 4).map((m) => (
                      <ListItem
                        key={m.id} disableGutters
                        secondaryAction={<Chip size="small" label={platformLabels[m.platform]} variant="outlined" />}
                        sx={{ cursor: 'pointer' }}
                        onClick={() => { setActiveMeetingId(m.id); navigate('/transcript') }}
                      >
                        <ListItemText
                          primary={m.title}
                          secondary={m.scheduled_at ? formatDate(m.scheduled_at) : '—'}
                          primaryTypographyProps={{ fontSize: 13.5, fontWeight: 500 }}
                          secondaryTypographyProps={{ fontSize: 12 }}
                        />
                      </ListItem>
                    ))}
                  </List>
                  <Button sx={{ mt: 1 }} size="small" onClick={() => navigate('/archive')}>Весь архив</Button>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      )}
    </Box>
  )
}
