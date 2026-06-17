// Функции обращения к API бэкенда.
import { api } from './client'
import type {
  Assignment,
  AssignmentCreate,
  AssignmentUpdate,
  BulkActionResult,
  ConsentStatus,
  Meeting,
  MeetingCreate,
  MeetingDetail,
  Page,
  Token,
  User,
  UserCreatePayload,
  UserDirectoryItem,
  UserUpdatePayload,
} from './types'

// --- Аутентификация ---

export async function login(email: string, password: string): Promise<Token> {
  const form = new URLSearchParams()
  form.set('username', email)
  form.set('password', password)
  const { data } = await api.post<Token>('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return data
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me')
  return data
}

// --- Совещания ---

export async function fetchMeetings(limit = 50, offset = 0): Promise<Page<Meeting>> {
  const { data } = await api.get<Page<Meeting>>('/meetings', { params: { limit, offset } })
  return data
}

export async function fetchMeeting(id: string): Promise<MeetingDetail> {
  const { data } = await api.get<MeetingDetail>(`/meetings/${id}`)
  return data
}

export async function createMeeting(payload: MeetingCreate): Promise<MeetingDetail> {
  const { data } = await api.post<MeetingDetail>('/meetings', payload)
  return data
}

export async function connectBot(id: string): Promise<MeetingDetail> {
  const { data } = await api.post<MeetingDetail>(`/meetings/${id}/connect-bot`)
  return data
}

export async function setParticipantConsent(
  meetingId: string,
  participantId: string,
  consent: ConsentStatus,
): Promise<MeetingDetail> {
  const { data } = await api.post<MeetingDetail>(
    `/meetings/${meetingId}/participants/${participantId}/consent`,
    { consent },
  )
  return data
}

export async function grantAllConsent(id: string): Promise<MeetingDetail> {
  const { data } = await api.post<MeetingDetail>(`/meetings/${id}/consent/grant-all`)
  return data
}

export async function startRecording(id: string): Promise<MeetingDetail> {
  const { data } = await api.post<MeetingDetail>(`/meetings/${id}/recording/start`)
  return data
}

export async function stopRecording(id: string): Promise<MeetingDetail> {
  const { data } = await api.post<MeetingDetail>(`/meetings/${id}/recording/stop`)
  return data
}

export async function transcribeAudio(id: string, file: File): Promise<MeetingDetail> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<MeetingDetail>(`/meetings/${id}/audio/transcribe`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 600_000, // распознавание длинного аудио может занять время
  })
  return data
}

// --- Поручения ---

export async function fetchAssignments(meetingId: string): Promise<Assignment[]> {
  const { data } = await api.get<Assignment[]>(`/meetings/${meetingId}/assignments`)
  return data
}

export async function createAssignment(
  meetingId: string,
  payload: AssignmentCreate,
): Promise<Assignment> {
  const { data } = await api.post<Assignment>(`/meetings/${meetingId}/assignments`, payload)
  return data
}

export async function updateAssignment(
  assignmentId: string,
  payload: AssignmentUpdate,
): Promise<Assignment> {
  const { data } = await api.patch<Assignment>(`/assignments/${assignmentId}`, payload)
  return data
}

export async function deleteAssignment(assignmentId: string): Promise<void> {
  await api.delete(`/assignments/${assignmentId}`)
}

export async function confirmAssignments(ids: string[]): Promise<BulkActionResult> {
  const { data } = await api.post<BulkActionResult>('/assignments/bulk/confirm', { ids })
  return data
}

export async function sendAssignments(ids: string[]): Promise<BulkActionResult> {
  const { data } = await api.post<BulkActionResult>('/assignments/bulk/send', { ids })
  return data
}

// --- Экспорт (скачивание файлов с авторизацией) ---

export async function downloadExport(meetingId: string, format: 'json' | 'pdf'): Promise<void> {
  const { data, headers } = await api.get(`/meetings/${meetingId}/export.${format}`, {
    responseType: 'blob',
  })
  const contentType =
    (headers['content-type'] as string | undefined) ||
    (format === 'pdf' ? 'application/pdf' : 'application/json')
  const blob = new Blob([data], { type: contentType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `protocol_${meetingId}.${format}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// --- Пользователи ---

export async function fetchUserDirectory(): Promise<UserDirectoryItem[]> {
  const { data } = await api.get<UserDirectoryItem[]>('/users/directory')
  return data
}

export async function fetchUsers(limit = 100, offset = 0): Promise<Page<User>> {
  const { data } = await api.get<Page<User>>('/users', { params: { limit, offset } })
  return data
}

export async function createUser(payload: UserCreatePayload): Promise<User> {
  const { data } = await api.post<User>('/users', payload)
  return data
}

export async function updateUser(id: string, payload: UserUpdatePayload): Promise<User> {
  const { data } = await api.patch<User>(`/users/${id}`, payload)
  return data
}

export async function fetchUserAssignments(userId: string): Promise<Assignment[]> {
  const { data } = await api.get<Assignment[]>(`/users/${userId}/assignments`)
  return data
}

export async function fetchMyAssignments(): Promise<Assignment[]> {
  const { data } = await api.get<Assignment[]>("/assignments/my")
  return data
}
