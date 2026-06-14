// Типы предметной области системы документирования совещаний РЖД

export type ConsentStatus = 'pending' | 'granted' | 'declined'

export type RecordingState = 'idle' | 'connecting' | 'awaiting_consent' | 'recording' | 'paused' | 'processing' | 'done'

export type TaskStatus = 'draft' | 'confirmed' | 'sent'
export type TaskPriority = 'low' | 'medium' | 'high'

export type MeetingPlatform = 'Cisco Jabber' | 'Яндекс Телемост'

export interface Participant {
  id: string
  name: string
  role: string
  email: string
  consent: ConsentStatus
  speakerColor: string
}

export interface TranscriptSegment {
  id: string
  speakerId: string
  startSec: number
  endSec: number
  text: string
}

// Поручение
export interface Assignment {
  id: string
  title: string
  description: string
  assigneeId: string // ответственный (Participant.id)
  dueDate: string // ISO-дата дедлайна
  priority: TaskPriority
  status: TaskStatus
  sourceSegmentId?: string // ссылка на фрагмент транскрипта
}

export interface Meeting {
  id: string
  title: string
  platform: MeetingPlatform
  date: string // ISO datetime
  durationSec: number
  organizer: string
  department: string
  recordingState: RecordingState
  participants: Participant[]
  transcript: TranscriptSegment[]
  assignments: Assignment[]
  audioUrl?: string
}
