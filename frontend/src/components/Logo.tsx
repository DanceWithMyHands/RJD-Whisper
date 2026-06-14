import { Box, Typography } from '@mui/material'
import { RZD_RED } from '../theme'

export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '10px',
          background: `linear-gradient(135deg, ${RZD_RED}, #B71414)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 17h18M5 17l2-9h10l2 9M9 8V5h6v3"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="19.5" r="1.4" fill="#fff" />
          <circle cx="16" cy="19.5" r="1.4" fill="#fff" />
        </svg>
      </Box>
      {!compact && (
        <Box sx={{ lineHeight: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 17, color: RZD_RED, letterSpacing: 0.5 }}>
            РЖД · Протокол
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            Документирование совещаний
          </Typography>
        </Box>
      )}
    </Box>
  )
}
