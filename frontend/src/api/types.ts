// Типы, соответствующие схемам бэкенда (/api/v1)

export type MeetingPlatform = 'cisco_jabber' | 'yandex_telemost'
export type RecordingState =
  | 'idle' | 'connecting' | 'awaiting_consent' | 'recording'
  | 'paused' | 'processing' | 'done' | 'failed'
export type ConsentStatus = 'pending' | 'granted' | 'declined'
export type TaskStatus = 'draft' | 'confirmed' | 'sent'
export type TaskPriority = 'low' | 'medium' | 'high'
export type UserRole = 'admin' | 'manager' | 'deputy' | 'organizer' | 'employee'

export const MANAGERIAL_ROLES: UserRole[] = ['admin', 'manager', 'deputy', 'organizer']

export function isManagerial(role: UserRole | undefined | null): boolean {
  return role ? MANAGERIAL_ROLES.includes(role) : false
}

export const roleLabels: Record<UserRole, string> = {
  admin: 'Администратор',
  manager: 'Начальник',
  deputy: 'Заместитель',
  organizer: 'Организатор',
  employee: 'Сотрудник',
}

export interface Token {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface User {
  id: string
  email: string
  full_name: string
  position: string | null
  department: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface Participant {
  id: string
  meeting_id: string
  user_id: string | null
  name: string
  role: string | null
  email: string | null
  consent: ConsentStatus
  speaker_color: string | null
  speaker_label: string | null
}

export interface TranscriptSegment {
  id: string
  meeting_id: string
  speaker_id: string | null
  order_index: number
  start_sec: number
  end_sec: number
  text: string
}

export interface Assignment {
  id: string
  meeting_id: string
  assignee_id: string | null
  source_segment_id: string | null
  title: string
  description: string | null
  due_date: string | null
  priority: TaskPriority
  status: TaskStatus
  confirmed_at: string | null
  sent_at: string | null
  created_at: string
}

export interface Meeting {
  id: string
  title: string
  platform: MeetingPlatform
  conference_url: string | null
  department: string | null
  organizer_name: string | null
  scheduled_at: string | null
  started_at: string | null
  finished_at: string | null
  duration_sec: number
  recording_state: RecordingState
  audio_object_key: string | null
  summary: string | null
  created_at: string
}

export interface MeetingDetail extends Meeting {
  participants: Participant[]
  transcript: TranscriptSegment[]
  assignments: Assignment[]
}

export interface Page<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

// --- payload-типы ---

export interface MeetingCreate {
  title: string
  platform: MeetingPlatform
  conference_url?: string | null
  department?: string | null
  organizer_name?: string | null
  scheduled_at?: string | null
  participant_ids: string[]
}

export interface UserDirectoryItem {
  id: string
  full_name: string
  position: string | null
  department: string | null
  email: string
  role: UserRole
}

export interface UserCreatePayload {
  email: string
  full_name: string
  position?: string | null
  department?: string | null
  role: UserRole
  password: string
}

export interface UserUpdatePayload {
  full_name?: string
  position?: string | null
  department?: string | null
  role?: UserRole
  is_active?: boolean
  password?: string
}

export interface AssignmentCreate {
  title: string
  description?: string | null
  assignee_id?: string | null
  due_date?: string | null
  priority?: TaskPriority
  source_segment_id?: string | null
}

export interface AssignmentUpdate {
  title?: string
  description?: string | null
  assignee_id?: string | null
  due_date?: string | null
  priority?: TaskPriority
  status?: TaskStatus
}

export interface BulkActionResult {
  affected: number
  ids: string[]
}

// --- словари отображения ---

export const platformLabels: Record<MeetingPlatform, string> = {
  cisco_jabber: 'Cisco Jabber',
  yandex_telemost: 'Яндекс Телемост',
}

export const recordingStateLabels: Record<RecordingState, string> = {
  idle: 'Не начато',
  connecting: 'Подключение',
  awaiting_consent: 'Ожидание согласия',
  recording: 'Идёт запись',
  paused: 'Пауза',
  processing: 'Обработка',
  done: 'Готово',
  failed: 'Ошибка',
}

export const priorityLabels: Record<TaskPriority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
}

export const statusLabels: Record<TaskStatus, string> = {
  draft: 'Черновик',
  confirmed: 'Подтверждено',
  sent: 'Отправлено',
}
