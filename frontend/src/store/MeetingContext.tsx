import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Assignment, Meeting, Participant, RecordingState } from '../types'
import { currentMeeting as seedMeeting, archivedMeetings as seedArchive } from '../data/mockData'

interface MeetingContextValue {
  meeting: Meeting
  archive: Meeting[]
  setRecordingState: (s: RecordingState) => void
  grantAllConsent: () => void
  setConsent: (participantId: string, consent: Participant['consent']) => void
  updateAssignment: (a: Assignment) => void
  addAssignment: (a: Assignment) => void
  removeAssignment: (id: string) => void
  confirmAssignments: (ids: string[]) => void
  markSent: (ids: string[]) => void
  participantById: (id: string) => Participant | undefined
}

const MeetingContext = createContext<MeetingContextValue | null>(null)

export function MeetingProvider({ children }: { children: ReactNode }) {
  const [meeting, setMeeting] = useState<Meeting>(seedMeeting)
  const [archive] = useState<Meeting[]>(seedArchive)

  const value = useMemo<MeetingContextValue>(() => ({
    meeting,
    archive,
    setRecordingState: (s) => setMeeting((m) => ({ ...m, recordingState: s })),
    grantAllConsent: () =>
      setMeeting((m) => ({
        ...m,
        participants: m.participants.map((p) => ({ ...p, consent: 'granted' })),
      })),
    setConsent: (participantId, consent) =>
      setMeeting((m) => ({
        ...m,
        participants: m.participants.map((p) =>
          p.id === participantId ? { ...p, consent } : p,
        ),
      })),
    updateAssignment: (a) =>
      setMeeting((m) => ({
        ...m,
        assignments: m.assignments.map((x) => (x.id === a.id ? a : x)),
      })),
    addAssignment: (a) =>
      setMeeting((m) => ({ ...m, assignments: [...m.assignments, a] })),
    removeAssignment: (id) =>
      setMeeting((m) => ({
        ...m,
        assignments: m.assignments.filter((x) => x.id !== id),
      })),
    confirmAssignments: (ids) =>
      setMeeting((m) => ({
        ...m,
        assignments: m.assignments.map((x) =>
          ids.includes(x.id) && x.status === 'draft' ? { ...x, status: 'confirmed' } : x,
        ),
      })),
    markSent: (ids) =>
      setMeeting((m) => ({
        ...m,
        assignments: m.assignments.map((x) =>
          ids.includes(x.id) ? { ...x, status: 'sent' } : x,
        ),
      })),
    participantById: (id) => meeting.participants.find((p) => p.id === id),
  }), [meeting, archive])

  return <MeetingContext.Provider value={value}>{children}</MeetingContext.Provider>
}

export function useMeeting() {
  const ctx = useContext(MeetingContext)
  if (!ctx) throw new Error('useMeeting должен использоваться внутри MeetingProvider')
  return ctx
}
