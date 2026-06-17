// React Query: запросы и мутации к API.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as apiEndpoints from '../api/endpoints'
import type {
  AssignmentCreate,
  AssignmentUpdate,
  ConsentStatus,
  MeetingCreate,
  UserCreatePayload,
  UserUpdatePayload,
} from '../api/types'

export const qk = {
  meetings: ['meetings'] as const,
  meeting: (id: string) => ['meeting', id] as const,
  assignments: (id: string) => ['assignments', id] as const,
  users: ['users'] as const,
  userDirectory: ['users', 'directory'] as const,
  userAssignments: (id: string) => ['users', id, 'assignments'] as const,
  myAssignments: ['assignments', 'my'] as const,
}

// --- Запросы ---

export function useMeetings(limit = 50, offset = 0) {
  return useQuery({
    queryKey: [...qk.meetings, limit, offset],
    queryFn: () => apiEndpoints.fetchMeetings(limit, offset),
  })
}

export function useMeeting(id: string | null) {
  return useQuery({
    queryKey: id ? qk.meeting(id) : ['meeting', 'none'],
    queryFn: () => apiEndpoints.fetchMeeting(id as string),
    enabled: Boolean(id),
  })
}

export function useAssignments(meetingId: string | null) {
  return useQuery({
    queryKey: meetingId ? qk.assignments(meetingId) : ['assignments', 'none'],
    queryFn: () => apiEndpoints.fetchAssignments(meetingId as string),
    enabled: Boolean(meetingId),
  })
}

// --- Мутации совещаний ---

export function useCreateMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: MeetingCreate) => apiEndpoints.createMeeting(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.meetings }),
  })
}

function invalidateMeeting(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: qk.meeting(id) })
  qc.invalidateQueries({ queryKey: qk.assignments(id) })
  qc.invalidateQueries({ queryKey: qk.meetings })
}

export function useConnectBot(meetingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiEndpoints.connectBot(meetingId),
    onSuccess: () => invalidateMeeting(qc, meetingId),
  })
}

export function useGrantAllConsent(meetingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiEndpoints.grantAllConsent(meetingId),
    onSuccess: () => invalidateMeeting(qc, meetingId),
  })
}

export function useSetConsent(meetingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { participantId: string; consent: ConsentStatus }) =>
      apiEndpoints.setParticipantConsent(meetingId, vars.participantId, vars.consent),
    onSuccess: () => invalidateMeeting(qc, meetingId),
  })
}

export function useStartRecording(meetingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiEndpoints.startRecording(meetingId),
    onSuccess: () => invalidateMeeting(qc, meetingId),
  })
}

export function useStopRecording(meetingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiEndpoints.stopRecording(meetingId),
    onSuccess: () => invalidateMeeting(qc, meetingId),
  })
}

export function useTranscribeAudio(meetingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => apiEndpoints.transcribeAudio(meetingId, file),
    onSuccess: () => invalidateMeeting(qc, meetingId),
  })
}

// --- Мутации поручений ---

export function useCreateAssignment(meetingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AssignmentCreate) => apiEndpoints.createAssignment(meetingId, payload),
    onSuccess: () => invalidateMeeting(qc, meetingId),
  })
}

export function useUpdateAssignment(meetingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; payload: AssignmentUpdate }) =>
      apiEndpoints.updateAssignment(vars.id, vars.payload),
    onSuccess: () => invalidateMeeting(qc, meetingId),
  })
}

export function useDeleteAssignment(meetingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiEndpoints.deleteAssignment(id),
    onSuccess: () => invalidateMeeting(qc, meetingId),
  })
}

export function useConfirmAssignments(meetingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => apiEndpoints.confirmAssignments(ids),
    onSuccess: () => invalidateMeeting(qc, meetingId),
  })
}

export function useSendAssignments(meetingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => apiEndpoints.sendAssignments(ids),
    onSuccess: () => invalidateMeeting(qc, meetingId),
  })
}

// --- Пользователи ---

export function useUserDirectory(enabled = true) {
  return useQuery({
    queryKey: qk.userDirectory,
    queryFn: () => apiEndpoints.fetchUserDirectory(),
    enabled,
  })
}

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: qk.users,
    queryFn: () => apiEndpoints.fetchUsers(),
    enabled,
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UserCreatePayload) => apiEndpoints.createUser(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.users })
      qc.invalidateQueries({ queryKey: qk.userDirectory })
    },
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; payload: UserUpdatePayload }) =>
      apiEndpoints.updateUser(vars.id, vars.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.users })
      qc.invalidateQueries({ queryKey: qk.userDirectory })
    },
  })
}

export function useUserAssignments(userId: string | null) {
  return useQuery({
    queryKey: userId ? qk.userAssignments(userId) : ['users', 'none', 'assignments'],
    queryFn: () => apiEndpoints.fetchUserAssignments(userId as string),
    enabled: Boolean(userId),
  })
}

export function useMyAssignments() {
  return useQuery({
    queryKey: qk.myAssignments,
    queryFn: () => apiEndpoints.fetchMyAssignments(),
  })
}
