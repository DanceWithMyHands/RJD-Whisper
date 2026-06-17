import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, Typography, Button, Stack, Avatar, Checkbox, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Toolbar, alpha, IconButton,
  Tooltip, Menu, MenuItem, ListItemIcon, TextField, InputAdornment, Chip,
  Snackbar, Alert,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/DoneAll'
import SendIcon from '@mui/icons-material/Send'
import SearchIcon from '@mui/icons-material/Search'
import DownloadIcon from '@mui/icons-material/Download'
import CodeIcon from '@mui/icons-material/DataObject'
import PdfIcon from '@mui/icons-material/PictureAsPdf'
import WarningIcon from '@mui/icons-material/WarningAmber'
import PageHeader from '../components/PageHeader'
import { StatusChip, PriorityChip } from '../components/StatusChips'
import EditAssignmentDialog, { type AssignmentFormValue } from '../components/EditAssignmentDialog'
import SendEmailDialog from '../components/SendEmailDialog'
import { Loading, ErrorState, EmptyState } from '../components/QueryState'
import { useActiveMeeting } from '../store/ActiveMeetingContext'
import {
  useMeeting, useAssignments, useCreateAssignment, useUpdateAssignment,
  useDeleteAssignment, useConfirmAssignments, useSendAssignments,
} from '../hooks/queries'
import { downloadExport } from '../api/endpoints'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { isManagerial, type Assignment } from '../api/types'
import { formatDate, initials, isOverdue } from '../utils/format'

export default function AssignmentsPage() {
  const navigate = useNavigate()
  const { activeMeetingId } = useActiveMeeting()
  const { user } = useAuth()
  const canManage = isManagerial(user?.role)
  const mid = activeMeetingId ?? ''

  const meetingQuery = useMeeting(activeMeetingId)
  const assignmentsQuery = useAssignments(activeMeetingId)

  const createM = useCreateAssignment(mid)
  const updateM = useUpdateAssignment(mid)
  const deleteM = useDeleteAssignment(mid)
  const confirmM = useConfirmAssignments(mid)
  const sendM = useSendAssignments(mid)

  const [selected, setSelected] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Assignment | null>(null)
  const [sendOpen, setSendOpen] = useState(false)
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null)
  const [toast, setToast] = useState<string | null>(null)

  const participants = meetingQuery.data?.participants ?? []
  const participantById = useMemo(() => {
    const m = new Map(participants.map((p) => [p.id, p]))
    return (id: string | null) => (id ? m.get(id) : undefined)
  }, [participants])

  const assignments = assignmentsQuery.data ?? []
  const rows = useMemo(
    () => assignments.filter((a) => {
      if (!query) return true
      const assignee = participantById(a.assignee_id)
      return (
        a.title.toLowerCase().includes(query.toLowerCase()) ||
        (assignee?.name.toLowerCase().includes(query.toLowerCase()) ?? false)
      )
    }),
    [assignments, query, participantById],
  )

  if (!activeMeetingId) {
    return (
      <Box>
        <PageHeader title="Поручения" />
        <Card><Box sx={{ p: 2 }}><EmptyState
          icon={<AssignmentIconPlaceholder />} title="Нет активного совещания."
          action={<Button variant="contained" onClick={() => navigate('/archive')}>Выбрать в архиве</Button>}
        /></Box></Card>
      </Box>
    )
  }
  if (assignmentsQuery.isLoading || meetingQuery.isLoading) return <Loading />
  if (assignmentsQuery.isError) {
    return <ErrorState message={apiErrorMessage(assignmentsQuery.error)} onRetry={() => assignmentsQuery.refetch()} />
  }

  const allSelected = rows.length > 0 && selected.length === rows.length
  const someSelected = selected.length > 0 && selected.length < rows.length
  const selectedAssignments = assignments.filter((a) => selected.includes(a.id))
  const confirmableSelected = selectedAssignments.filter((a) => a.status === 'draft')
  const sendableSelected = selectedAssignments.filter((a) => a.status === 'confirmed')
  const draftCount = assignments.filter((a) => a.status === 'draft').length

  const toggleAll = () => setSelected(allSelected ? [] : rows.map((r) => r.id))
  const toggleOne = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const openNew = () => { setEditing(null); setEditOpen(true) }
  const openEdit = (a: Assignment) => { setEditing(a); setEditOpen(true) }

  const handleSave = async (value: AssignmentFormValue) => {
    try {
      if (editing) {
        await updateM.mutateAsync({ id: editing.id, payload: value })
        setToast('Поручение обновлено')
      } else {
        await createM.mutateAsync(value)
        setToast('Поручение добавлено')
      }
      setEditOpen(false)
    } catch (e) { setToast(apiErrorMessage(e)) }
  }

  const handleConfirm = async () => {
    try {
      const res = await confirmM.mutateAsync(confirmableSelected.map((a) => a.id))
      setToast(`Подтверждено поручений: ${res.affected}`)
      setSelected([])
    } catch (e) { setToast(apiErrorMessage(e)) }
  }

  const handleSend = async () => {
    try {
      const res = await sendM.mutateAsync(sendableSelected.map((a) => a.id))
      setToast(`Разослано поручений: ${res.affected}`)
      setSendOpen(false)
      setSelected([])
    } catch (e) { setToast(apiErrorMessage(e)) }
  }

  const handleDelete = async (id: string) => {
    try { await deleteM.mutateAsync(id); setToast('Поручение удалено') }
    catch (e) { setToast(apiErrorMessage(e)) }
  }

  const handleExport = async (format: 'json' | 'pdf') => {
    setExportAnchor(null)
    try { await downloadExport(mid, format); setToast(format === 'pdf' ? 'Сформирован PDF' : 'Экспорт в JSON') }
    catch (e) { setToast(apiErrorMessage(e)) }
  }

  return (
    <Box>
      <PageHeader
        title="Поручения"
        subtitle={`${meetingQuery.data?.title ?? ''} · ${assignments.length} поручений (${draftCount} на подтверждении)`}
        action={
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={(e) => setExportAnchor(e.currentTarget)}>Экспорт</Button>
            {canManage && <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Добавить</Button>}
          </Stack>
        }
      />

      <Card>
        {selected.length > 0 && canManage ? (
          <Toolbar sx={{ bgcolor: (t) => alpha(t.palette.primary.main, 0.08), borderRadius: '10px 10px 0 0', gap: 1.5 }}>
            <Typography sx={{ flex: 1, fontWeight: 600 }}>Выбрано: {selected.length}</Typography>
            <Button variant="contained" startIcon={<CheckIcon />} disabled={confirmableSelected.length === 0 || confirmM.isPending} onClick={handleConfirm}>
              Подтвердить ({confirmableSelected.length})
            </Button>
            <Button variant="contained" color="secondary" startIcon={<SendIcon />} disabled={sendableSelected.length === 0} onClick={() => setSendOpen(true)}>
              Разослать ({sendableSelected.length})
            </Button>
          </Toolbar>
        ) : (
          <Toolbar sx={{ gap: 1.5 }}>
            <TextField
              size="small" placeholder="Поиск по поручениям и ответственным…"
              value={query} onChange={(e) => setQuery(e.target.value)} sx={{ width: { xs: '100%', sm: 360 } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <Box sx={{ flex: 1 }} />
            <Chip label={`Черновиков: ${draftCount}`} color="warning" variant="outlined" size="small" />
          </Toolbar>
        )}

        <TableContainer>
          <Table sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                {canManage && (
                  <TableCell padding="checkbox">
                    <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
                  </TableCell>
                )}
                <TableCell>Поручение</TableCell>
                <TableCell>Ответственный</TableCell>
                <TableCell>Срок</TableCell>
                <TableCell>Приоритет</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell align="right">Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((a) => {
                const assignee = participantById(a.assignee_id)
                const checked = selected.includes(a.id)
                const overdue = a.due_date && isOverdue(a.due_date) && a.status !== 'sent'
                return (
                  <TableRow key={a.id} hover selected={checked}>
                    {canManage && (
                      <TableCell padding="checkbox">
                        <Checkbox checked={checked} onChange={() => toggleOne(a.id)} />
                      </TableCell>
                    )}
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{a.title}</Typography>
                      {a.description && (
                        <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }} noWrap>{a.description}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar sx={{ bgcolor: assignee?.speaker_color ?? '#999', width: 30, height: 30, fontSize: 12 }}>
                          {assignee ? initials(assignee.name) : '—'}
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontSize: 13, fontWeight: 500 }} noWrap>{assignee?.name ?? 'Не назначен'}</Typography>
                          <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }} noWrap>{assignee?.role}</Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {overdue && <Tooltip title="Срок истёк"><WarningIcon color="error" sx={{ fontSize: 16 }} /></Tooltip>}
                        <Typography sx={{ fontSize: 13, color: overdue ? 'error.main' : 'text.primary' }}>
                          {a.due_date ? formatDate(a.due_date) : '—'}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell><PriorityChip priority={a.priority} /></TableCell>
                    <TableCell><StatusChip status={a.status} /></TableCell>
                    <TableCell align="right">
                      {canManage ? (
                        <>
                          <Tooltip title="Редактировать">
                            <IconButton size="small" onClick={() => openEdit(a)}><EditIcon fontSize="small" /></IconButton>
                          </Tooltip>
                          <Tooltip title="Удалить">
                            <IconButton size="small" onClick={() => handleDelete(a.id)}><DeleteIcon fontSize="small" /></IconButton>
                          </Tooltip>
                        </>
                      ) : (
                        <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>—</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    Поручения не найдены.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
        <MenuItem onClick={() => handleExport('json')}>
          <ListItemIcon><CodeIcon fontSize="small" /></ListItemIcon>Экспорт в JSON
        </MenuItem>
        <MenuItem onClick={() => handleExport('pdf')}>
          <ListItemIcon><PdfIcon fontSize="small" /></ListItemIcon>Экспорт в PDF
        </MenuItem>
      </Menu>

      <EditAssignmentDialog
        open={editOpen} assignment={editing} participants={participants}
        saving={createM.isPending || updateM.isPending}
        onClose={() => setEditOpen(false)} onSubmit={handleSave}
      />

      <SendEmailDialog
        open={sendOpen} assignments={sendableSelected} participants={participants}
        sending={sendM.isPending} onClose={() => setSendOpen(false)} onSend={handleSend}
      />

      <Snackbar
        open={Boolean(toast)} autoHideDuration={2800} onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="info" variant="filled" onClose={() => setToast(null)}>{toast}</Alert>
      </Snackbar>
    </Box>
  )
}

function AssignmentIconPlaceholder() {
  return <WarningIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
}
