import { Box, CircularProgress, Alert, Button, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'

export function Loading({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8, gap: 2 }}>
      <CircularProgress size={28} />
      <Typography color="text.secondary">{label}</Typography>
    </Box>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert
      severity="error"
      action={onRetry ? <Button color="inherit" size="small" onClick={onRetry}>Повторить</Button> : undefined}
    >
      {message}
    </Alert>
  )
}

export function EmptyState({ icon, title, action }: { icon?: ReactNode; title: string; action?: ReactNode }) {
  return (
    <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
      {icon}
      <Typography color="text.secondary">{title}</Typography>
      {action}
    </Stack>
  )
}
