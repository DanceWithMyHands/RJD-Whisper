import { createContext, useContext, useState, type ReactNode } from 'react'

const KEY = 'rzd_active_meeting_id'

interface ActiveMeetingContextValue {
  activeMeetingId: string | null
  setActiveMeetingId: (id: string | null) => void
}

const Ctx = createContext<ActiveMeetingContextValue | null>(null)

export function ActiveMeetingProvider({ children }: { children: ReactNode }) {
  const [activeMeetingId, setId] = useState<string | null>(() => localStorage.getItem(KEY))

  const setActiveMeetingId = (id: string | null) => {
    if (id) localStorage.setItem(KEY, id)
    else localStorage.removeItem(KEY)
    setId(id)
  }

  return (
    <Ctx.Provider value={{ activeMeetingId, setActiveMeetingId }}>{children}</Ctx.Provider>
  )
}

export function useActiveMeeting() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useActiveMeeting должен использоваться внутри ActiveMeetingProvider')
  return ctx
}
