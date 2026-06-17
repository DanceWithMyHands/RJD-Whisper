import { useState } from 'react'
import {
  Box, Card, Typography, Button, Stack, Avatar, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Tooltip, Switch,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Snackbar, Alert, Toolbar, List, ListItem, ListItemText,
} from '@mui/material'
import AddIcon from '@mui/icons-material/PersonAdd'
import AssignmentIcon from '@mui/icons-material/AssignmentInd'
import PageHeader from '../components/PageHeader'
import { StatusChip, PriorityChip } from '../components/StatusChips'
import { Loading, ErrorState } from '../components/QueryState'
import {
  useUsers, useCreateUser, useUpdateUser, useUserAssignments,
} from '../hooks/queries'
import { apiErrorMessage } from '../api/client'
import { roleLabels, type User, type UserCreatePayload, type UserRole } from '../api/types'
import { formatDate, initials } from '../utils/format'

const ROLE_COLORS: Record<UserRole, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  admin: 'error',
  manager: 'warning',
  deputy: 'info',
  organizer: 'info',
  employee: 'default',
}

export default function UsersPage() {
  const usersQuery = useUsers()
  const updateUser = useUpdateUser()
  const [createOpen, setCreateOpen] = useState(false)
  const [assigneeUser, setAssigneeUser] = useState<User | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  if (usersQuery.isLoading) return <Loading />
  if (usersQuery.isError) {
    return <ErrorState message={apiErrorMessage(usersQuery.error)} onRetry={() => usersQuery.refetch()} />
  }

  const users = usersQuery.data?.items ?? []

  const toggleActive = async (u: User) => {
    try {
      await updateUser.mutateAsync({ id: u.id, payload: { is_active: !u.is_active } })
      setToast(u.is_active ? 'Учётка заблокирована' : 'Учётка активирована')
    } catch (e) { setToast(apiErrorMessage(e)) }
  }

  return (
    <Box>
      <PageHeader
        title="Пользователи"
        subtitle="Справочник учётных записей и ролей (доступно администратору)"
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>Добавить</Button>}
      />

      <Card>
        <Toolbar>
          <Typography sx={{ fontWeight: 600 }}>Всего: {usersQuery.data?.total ?? 0}</Typography>
        </Toolbar>
        <TableContainer>
          <Table sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell>Сотрудник</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Должность</TableCell>
                <TableCell>Роль</TableCell>
                <TableCell>Активен</TableCell>
                <TableCell align="right">Поручения</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar sx={{ bgcolor: 'secondary.main', width: 34, height: 34, fontSize: 13 }}>
                        {initials(u.full_name)}
                      </Avatar>
                      <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{u.full_name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{u.email}</TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{u.position ?? '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={roleLabels[u.role]} color={ROLE_COLORS[u.role]} variant={u.role === 'employee' ? 'outlined' : 'filled'} />
                  </TableCell>
                  <TableCell>
                    <Switch checked={u.is_active} onChange={() => toggleActive(u)} size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Поручения пользователя">
                      <IconButton size="small" onClick={() => setAssigneeUser(u)}>
                        <AssignmentIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5, color: 'text.secondary' }}>Пользователей нет.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); setToast('Пользователь создан') }}
        onError={(m) => setToast(m)}
      />

      <UserAssignmentsDialog user={assigneeUser} onClose={() => setAssigneeUser(null)} />

      <Snackbar open={Boolean(toast)} autoHideDuration={2800} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" variant="filled" onClose={() => setToast(null)}>{toast}</Alert>
      </Snackbar>
    </Box>
  )
}

function CreateUserDialog({
  open, onClose, onCreated, onError,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
  onError: (m: string) => void
}) {
  const createUser = useCreateUser()
  const [form, setForm] = useState<UserCreatePayload>({
    email: '', full_name: '', position: '', department: '', role: 'employee', password: '',
  })

  const valid = form.email.includes('@') && form.full_name.trim() && form.password.length >= 8

  const submit = async () => {
    try {
      await createUser.mutateAsync(form)
      setForm({ email: '', full_name: '', position: '', department: '', role: 'employee', password: '' })
      onCreated()
    } catch (e) { onError(apiErrorMessage(e)) }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Новый пользователь</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField label="ФИО" fullWidth value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoFocus />
          <TextField label="Email" type="email" fullWidth value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField label="Должность" fullWidth value={form.position ?? ''} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          <TextField label="Подразделение" fullWidth value={form.department ?? ''} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          <TextField select label="Роль" fullWidth value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
            <MenuItem value="admin">Администратор (полный доступ)</MenuItem>
            <MenuItem value="manager">Начальник (совещания и поручения)</MenuItem>
            <MenuItem value="deputy">Заместитель (как начальник)</MenuItem>
            <MenuItem value="employee">Сотрудник (только просмотр своего)</MenuItem>
          </TextField>
          <TextField
            label="Пароль" type="password" fullWidth value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            helperText="Минимум 8 символов"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Отмена</Button>
        <Button variant="contained" disabled={!valid || createUser.isPending} onClick={submit}>
          {createUser.isPending ? 'Создание…' : 'Создать'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function UserAssignmentsDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const query = useUserAssignments(user?.id ?? null)
  const items = query.data ?? []

  return (
    <Dialog open={Boolean(user)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Поручения · {user?.full_name}
      </DialogTitle>
      <DialogContent>
        {query.isLoading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 3 }}>У пользователя нет поручений.</Typography>
        ) : (
          <List disablePadding>
            {items.map((a) => (
              <ListItem key={a.id} disableGutters
                secondaryAction={<Stack direction="row" spacing={1}><PriorityChip priority={a.priority} /><StatusChip status={a.status} /></Stack>}>
                <ListItemText
                  primary={a.title}
                  secondary={a.due_date ? `Срок: ${formatDate(a.due_date)}` : 'Без срока'}
                  primaryTypographyProps={{ fontSize: 14 }}
                  secondaryTypographyProps={{ fontSize: 12.5 }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  )
}
