import { useMemo, useState } from 'react'
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
import EditAssignmentDialog from '../components/EditAssignmentDialog'
import SendEmailDialog from '../components/SendEmailDialog'
import { useMeeting } from '../store/MeetingContext'
import { formatDate, initials, isOverdue } from '../utils/format'
import { exportJSON, exportPDF } from '../utils/export'
import type { Assignment } from '../types'

export default function AssignmentsPage() {
  const { meeting, participantById, updateAssignment, addAssignment, removeAssignment, confirmAssignments, markSent } = useMeeting()

  const [selected, setSelected] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Assignment | null>(null)
  const [sendOpen, setSendOpen] = useState(false)
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null)
  const [toast, setToast] = useState<string | null>(null)

  const rows = useMemo(
    () => meeting.assignments.filter((a) => {
      if (!query) return true
      const assignee = participantById(a.assigneeId)
      return (
        a.title.toLowerCase().includes(query.toLowerCase()) ||
        (assignee?.name.toLowerCase().includes(query.toLowerCase()) ?? false)
      )
    }),
    [meeting.assignments, query, participantById],
  )

  const allSelected = rows.length > 0 && selected.length === rows.length
  const someSelected = selected.length > 0 && selected.length < rows.length

  const selectedAssignments = meeting.assignments.filter((a) => selected.includes(a.id))
  const confirmableSelected = selectedAssignments.filter((a) => a.status === 'draft')
  const sendableSelected = selectedAssignments.filter((a) => a.status === 'confirmed')

  const toggleAll = () => setSelected(allSelected ? [] : rows.map((r) => r.id))
  const toggleOne = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const openNew = () => { setEditing(null); setEditOpen(true) }
  const openEdit = (a: Assignment) => { setEditing(a); setEditOpen(true) }

  const handleSave = (a: Assignment) => {
    if (meeting.assignments.some((x) => x.id === a.id)) {
      updateAssignment(a)
      setToast('Поручение обновлено')
    } else {
      addAssignment(a)
      setToast('Поручение добавлено')
    }
    setEditOpen(false)
  }

  const handleConfirm = () => {
    confirmAssignments(confirmableSelected.map((a) => a.id))
    setToast(`Подтверждено поручений: ${confirmableSelected.length}`)
    setSelected([])
  }

  const draftCount = meeting.assignments.filter((a) => a.status === 'draft').length

  return (
    <Box>
      <PageHeader
        title="Поручения"
        subtitle={`${meeting.title} · выделено LLM · ${meeting.assignments.length} поручений (${draftCount} на подтверждении)`}
        action={
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={(e) => setExportAnchor(e.currentTarget)}>
              Экспорт
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
              Добавить
            </Button>
          </Stack>
        }
      />

      <Card>
        {/* Панель массовых действий */}
        {selected.length > 0 ? (
          <Toolbar sx={{ bgcolor: (t) => alpha(t.palette.primary.main, 0.08), borderRadius: '10px 10px 0 0', gap: 1.5 }}>
            <Typography sx={{ flex: 1, fontWeight: 600 }}>Выбрано: {selected.length}</Typography>
            <Button
              variant="contained" startIcon={<CheckIcon />} disabled={confirmableSelected.length === 0}
              onClick={handleConfirm}
            >
              Подтвердить ({confirmableSelected.length})
            </Button>
            <Button
              variant="contained" color="secondary" startIcon={<SendIcon />}
              disabled={sendableSelected.length === 0} onClick={() => setSendOpen(true)}
            >
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
                <TableCell padding="checkbox">
                  <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
                </TableCell>
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
                const assignee = participantById(a.assigneeId)
                const checked = selected.includes(a.id)
                const overdue = isOverdue(a.dueDate) && a.status !== 'sent'
                return (
                  <TableRow key={a.id} hover selected={checked}>
                    <TableCell padding="checkbox">
                      <Checkbox checked={checked} onChange={() => toggleOne(a.id)} />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{a.title}</Typography>
                      {a.description && (
                        <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }} noWrap>
                          {a.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar sx={{ bgcolor: assignee?.speakerColor, width: 30, height: 30, fontSize: 12 }}>
                          {assignee ? initials(assignee.name) : '—'}
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontSize: 13, fontWeight: 500 }} noWrap>{assignee?.name}</Typography>
                          <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }} noWrap>{assignee?.role}</Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {overdue && <Tooltip title="Срок истёк"><WarningIcon color="error" sx={{ fontSize: 16 }} /></Tooltip>}
                        <Typography sx={{ fontSize: 13, color: overdue ? 'error.main' : 'text.primary' }}>
                          {formatDate(a.dueDate)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell><PriorityChip priority={a.priority} /></TableCell>
                    <TableCell><StatusChip status={a.status} /></TableCell>
                    <TableCell align="right">
                      <Tooltip title="Редактировать">
                        <IconButton size="small" onClick={() => openEdit(a)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Удалить">
                        <IconButton size="small" onClick={() => { removeAssignment(a.id); setToast('Поручение удалено') }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
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

      {/* Меню экспорта */}
      <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
        <MenuItem onClick={() => { exportJSON(meeting); setExportAnchor(null); setToast('Экспорт в JSON') }}>
          <ListItemIcon><CodeIcon fontSize="small" /></ListItemIcon>
          Экспорт в JSON
        </MenuItem>
        <MenuItem onClick={() => { exportPDF(meeting); setExportAnchor(null); setToast('Сформирован PDF') }}>
          <ListItemIcon><PdfIcon fontSize="small" /></ListItemIcon>
          Экспорт в PDF
        </MenuItem>
      </Menu>

      <EditAssignmentDialog
        open={editOpen} assignment={editing} participants={meeting.participants}
        onClose={() => setEditOpen(false)} onSave={handleSave}
      />

      <SendEmailDialog
        open={sendOpen} assignments={sendableSelected} participants={meeting.participants}
        onClose={() => setSendOpen(false)}
        onSent={(ids) => { markSent(ids); setSelected([]); setToast('Поручения разосланы исполнителям') }}
      />

      <Snackbar
        open={Boolean(toast)} autoHideDuration={2800} onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setToast(null)}>{toast}</Alert>
      </Snackbar>
    </Box>
  )
}
