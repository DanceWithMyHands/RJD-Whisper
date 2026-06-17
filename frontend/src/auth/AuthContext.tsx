import {
  createContext, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { login as apiLogin, fetchMe } from '../api/endpoints'
import { tokenStore } from '../api/tokenStore'
import type { User } from '../api/types'

interface AuthContextValue {
  user: User | null
  initializing: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(true)

  // Восстановление сессии по сохранённому токену
  useEffect(() => {
    let active = true
    async function bootstrap() {
      if (!tokenStore.getAccess()) {
        setInitializing(false)
        return
      }
      try {
        const me = await fetchMe()
        if (active) setUser(me)
      } catch {
        tokenStore.clear()
      } finally {
        if (active) setInitializing(false)
      }
    }
    bootstrap()
    return () => {
      active = false
    }
  }, [])

  // Реакция на инвалидацию токена интерсептором (истёкшая сессия)
  useEffect(() => {
    return tokenStore.onLogout(() => {
      setUser(null)
      queryClient.clear()
    })
  }, [queryClient])

  const login = async (email: string, password: string) => {
    const token = await apiLogin(email, password)
    tokenStore.set(token.access_token, token.refresh_token)
    const me = await fetchMe()
    setUser(me)
  }

  const logout = () => {
    tokenStore.clear()
    setUser(null)
    queryClient.clear()
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      isAuthenticated: Boolean(user),
      login,
      logout,
    }),
    [user, initializing],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth должен использоваться внутри AuthProvider')
  return ctx
}
