import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, TextField, Button, Typography, Stack, Alert,
  InputAdornment, IconButton, CircularProgress,
} from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import LoginIcon from '@mui/icons-material/Login'
import Logo from '../components/Logo'
import { useAuth } from '../auth/AuthContext'
import { apiErrorMessage } from '../api/client'
import { RZD_RED } from '../theme'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname || '/'

  const [email, setEmail] = useState('admin@rzd.ru')
  const [password, setPassword] = useState('admin12345')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err, 'Не удалось войти. Проверьте email и пароль.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        background: `linear-gradient(135deg, ${RZD_RED}22, #1A1A2E11)`,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack alignItems="center" spacing={1} sx={{ mb: 3 }}>
            <Logo />
            <Typography color="text.secondary" sx={{ fontSize: 14, mt: 1 }}>
              Вход в систему документирования совещаний
            </Typography>
          </Stack>

          <form onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label="Email" type="email" fullWidth required autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                label="Пароль" fullWidth required
                type={showPassword ? 'text' : 'password'}
                value={password} onChange={(e) => setPassword(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword((v) => !v)} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                type="submit" variant="contained" size="large" fullWidth disabled={loading}
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LoginIcon />}
              >
                {loading ? 'Вход…' : 'Войти'}
              </Button>
            </Stack>
          </form>

          <Typography sx={{ mt: 3, fontSize: 12.5, color: 'text.secondary', textAlign: 'center' }}>
            Демо-доступ: admin@rzd.ru / admin12345
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
