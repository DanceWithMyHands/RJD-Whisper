import { Chip } from '@mui/material'
import type { TaskStatus, TaskPriority } from '../types'

export function StatusChip({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, { label: string; color: 'default' | 'warning' | 'success' | 'info' }> = {
    draft: { label: 'Черновик', color: 'warning' },
    confirmed: { label: 'Подтверждено', color: 'info' },
    sent: { label: 'Отправлено', color: 'success' },
  }
  const { label, color } = map[status]
  return <Chip size="small" label={label} color={color} variant={status === 'draft' ? 'outlined' : 'filled'} />
}

export function PriorityChip({ priority }: { priority: TaskPriority }) {
  const map: Record<TaskPriority, { label: string; color: 'default' | 'error' | 'warning' | 'success' }> = {
    high: { label: 'Высокий', color: 'error' },
    medium: { label: 'Средний', color: 'warning' },
    low: { label: 'Низкий', color: 'success' },
  }
  const { label, color } = map[priority]
  return <Chip size="small" label={label} color={color} variant="outlined" />
}
