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
import { useMeeting } from '../store/MeetingContext'
import { archivedMeetings } from '../data/mockData'
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
  const { meeting, participantById } = useMeeting()

  const allMeetings = [meeting, ...archivedMeetings]
  const totalAssignments = allMeetings.reduce((s, m) => s + m.assignments.length, 0)
  const draft = meeting.assignments.filter((a) => a.status === 'draft').length
  const sent = allMeetings.reduce((s, m) => s + m.assignments.filter((a) => a.status === 'sent').length, 0)
  const completionPct = Math.round((sent / totalAssignments) * 100)

  return (
    <Box>
      <PageHeader
        title="Дашборд"
        subtitle="Сводка по совещаниям и поручениям подразделения"
        action={
          <Button variant="contained" size="large" startIcon={<VideocamIcon />} onClick={() => navigate('/connect')}>
            Новое совещание
          </Button>
        }
      />

      <Grid container spacing={2.5} sx={{ mb: 1 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<GroupsIcon />} value={allMeetings.length} label="Совещаний всего" color="#2C3E73" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<AssignmentIcon />} value={totalAssignments} label="Поручений сформировано" color="#E21A1A" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<ScheduleIcon />} value={draft} label="Ждут подтверждения" color="#ED6C02" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<TaskAltIcon />} value={sent} label="Отправлено исполнителям" color="#2E7D32" />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={7}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6">Последнее совещание</Typography>
                <Chip label={meeting.platform} size="small" color="secondary" variant="outlined" />
              </Stack>
              <Typography variant="h5" sx={{ mb: 0.5 }}>{meeting.title}</Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {formatDateTime(meeting.date)} · {formatDuration(meeting.durationSec)} · {meeting.department}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography sx={{ fontWeight: 600, mb: 1 }}>Поручения совещания</Typography>
              <List dense disablePadding>
                {meeting.assignments.map((a) => {
                  const assignee = participantById(a.assigneeId)
                  return (
                    <ListItem key={a.id} disableGutters secondaryAction={<StatusChip status={a.status} />}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: assignee?.speakerColor, width: 34, height: 34, fontSize: 13 }}>
                          {assignee ? initials(assignee.name) : '—'}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={a.title}
                        secondary={
                          <Stack direction="row" spacing={1} alignItems="center" component="span">
                            <span>До {formatDate(a.dueDate)}</span>
                            {isOverdue(a.dueDate) && a.status !== 'sent' && (
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
              <Button sx={{ mt: 2 }} variant="outlined" onClick={() => navigate('/assignments')}>
                Перейти к поручениям
              </Button>
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
                  {sent} из {totalAssignments} поручений направлены исполнителям
                </Typography>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 1.5 }}>Недавние совещания</Typography>
                <List dense disablePadding>
                  {archivedMeetings.slice(0, 3).map((m) => (
                    <ListItem key={m.id} disableGutters secondaryAction={
                      <Chip size="small" label={`${m.assignments.length} пор.`} variant="outlined" />
                    }>
                      <ListItemText
                        primary={m.title}
                        secondary={`${formatDate(m.date)} · ${m.platform}`}
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
    </Box>
  )
}
