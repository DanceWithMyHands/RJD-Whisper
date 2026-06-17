// Хранение JWT-токенов (localStorage) + уведомление об инвалидации сессии.

const ACCESS_KEY = 'rzd_access_token'
const REFRESH_KEY = 'rzd_refresh_token'

type Listener = () => void
const listeners = new Set<Listener>()

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    listeners.forEach((l) => l())
  },
  onLogout(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)    }
  },
}
