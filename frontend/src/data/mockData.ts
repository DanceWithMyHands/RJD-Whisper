import type { Meeting, Participant, TranscriptSegment, Assignment } from '../types'

const participants: Participant[] = [
  {
    id: 'p1',
    name: 'Соколов Андрей Петрович',
    role: 'Начальник дистанции пути',
    email: 'a.sokolov@rzd.ru',
    consent: 'granted',
    speakerColor: '#E21A1A',
  },
  {
    id: 'p2',
    name: 'Михеева Елена Сергеевна',
    role: 'Руководитель ИТ-отдела',
    email: 'e.miheeva@rzd.ru',
    consent: 'granted',
    speakerColor: '#2C3E73',
  },
  {
    id: 'p3',
    name: 'Громов Виктор Иванович',
    role: 'Инженер по охране труда',
    email: 'v.gromov@rzd.ru',
    consent: 'granted',
    speakerColor: '#2E7D32',
  },
  {
    id: 'p4',
    name: 'Зайцева Ольга Николаевна',
    role: 'Специалист отдела логистики',
    email: 'o.zaytseva@rzd.ru',
    consent: 'granted',
    speakerColor: '#ED6C02',
  },
]

const transcript: TranscriptSegment[] = [
  { id: 's1', speakerId: 'p1', startSec: 12, endSec: 31, text: 'Коллеги, начнём оперативное совещание по итогам недели. Первый вопрос — состояние путевого хозяйства на участке Москва-Сортировочная.' },
  { id: 's2', speakerId: 'p3', startSec: 33, endSec: 58, text: 'По охране труда зафиксировано два замечания на перегоне. Необходимо до конца недели провести внеплановый инструктаж бригад и обновить журналы.' },
  { id: 's3', speakerId: 'p1', startSec: 60, endSec: 79, text: 'Виктор Иванович, прошу вас подготовить и провести этот инструктаж. Срок — до пятницы. Отчёт направьте мне на почту.' },
  { id: 's4', speakerId: 'p2', startSec: 82, endSec: 110, text: 'По ИТ-части: система мониторинга датчиков работает нестабильно. Предлагаю развернуть обновление серверного ПО и протестировать на стенде.' },
  { id: 's5', speakerId: 'p1', startSec: 112, endSec: 130, text: 'Елена Сергеевна, возьмите это в работу. Нужно обновить ПО мониторинга и предоставить результаты тестирования к следующему совещанию.' },
  { id: 's6', speakerId: 'p4', startSec: 133, endSec: 162, text: 'По логистике: задерживается поставка комплектующих для ремонта. Поставщик переносит сроки на две недели, это критично для графика.' },
  { id: 's7', speakerId: 'p1', startSec: 164, endSec: 188, text: 'Ольга Николаевна, согласуйте с поставщиком новый график и подготовьте альтернативные варианты закупки. Жду предложения к среде.' },
  { id: 's8', speakerId: 'p2', startSec: 190, endSec: 212, text: 'И ещё: нужно организовать обучение сотрудников новой системе документооборота. Предлагаю провести вебинар.' },
  { id: 's9', speakerId: 'p1', startSec: 214, endSec: 236, text: 'Согласен. Елена Сергеевна, организуйте вебинар по документообороту для всех отделов до конца месяца. На этом завершаем, спасибо всем.' },
]

const assignments: Assignment[] = [
  {
    id: 'a1',
    title: 'Провести внеплановый инструктаж бригад по охране труда',
    description: 'Подготовить и провести внеплановый инструктаж бригад на перегоне, обновить журналы, направить отчёт начальнику дистанции.',
    assigneeId: 'p3',
    dueDate: '2026-06-12',
    priority: 'high',
    status: 'draft',
    sourceSegmentId: 's3',
  },
  {
    id: 'a2',
    title: 'Обновить ПО системы мониторинга датчиков',
    description: 'Развернуть обновление серверного ПО мониторинга, протестировать на стенде и предоставить результаты тестирования к следующему совещанию.',
    assigneeId: 'p2',
    dueDate: '2026-06-15',
    priority: 'medium',
    status: 'draft',
    sourceSegmentId: 's5',
  },
  {
    id: 'a3',
    title: 'Согласовать новый график поставки комплектующих',
    description: 'Согласовать с поставщиком новый график поставки, подготовить альтернативные варианты закупки комплектующих.',
    assigneeId: 'p4',
    dueDate: '2026-06-10',
    priority: 'high',
    status: 'draft',
    sourceSegmentId: 's7',
  },
  {
    id: 'a4',
    title: 'Организовать вебинар по новой системе документооборота',
    description: 'Организовать и провести обучающий вебинар по новой системе документооборота для всех отделов подразделения.',
    assigneeId: 'p2',
    dueDate: '2026-06-30',
    priority: 'low',
    status: 'draft',
    sourceSegmentId: 's9',
  },
]

export const currentMeeting: Meeting = {
  id: 'm-2026-06-08',
  title: 'Оперативное совещание дистанции пути',
  platform: 'Cisco Jabber',
  date: '2026-06-08T09:00:00',
  durationSec: 254,
  organizer: 'Соколов Андрей Петрович',
  department: 'Дистанция пути Москва-Сортировочная',
  recordingState: 'done',
  participants,
  transcript,
  assignments,
  audioUrl: undefined,
}

// Архив прошедших совещаний
export const archivedMeetings: Meeting[] = [
  {
    id: 'm-2026-06-01',
    title: 'Планёрка по графику ремонтных работ',
    platform: 'Яндекс Телемост',
    date: '2026-06-01T10:30:00',
    durationSec: 1820,
    organizer: 'Соколов Андрей Петрович',
    department: 'Дистанция пути Москва-Сортировочная',
    recordingState: 'done',
    participants: participants.slice(0, 3),
    transcript: [],
    assignments: [
      { id: 'ar1', title: 'Подготовить смету на ремонт стрелочных переводов', description: '', assigneeId: 'p4', dueDate: '2026-06-05', priority: 'medium', status: 'sent' },
      { id: 'ar2', title: 'Согласовать окна для ремонтных работ', description: '', assigneeId: 'p1', dueDate: '2026-06-04', priority: 'high', status: 'sent' },
    ],
  },
  {
    id: 'm-2026-05-25',
    title: 'Совещание по цифровизации документооборота',
    platform: 'Cisco Jabber',
    date: '2026-05-25T14:00:00',
    durationSec: 2640,
    organizer: 'Михеева Елена Сергеевна',
    department: 'ИТ-отдел',
    recordingState: 'done',
    participants: participants.slice(1, 4),
    transcript: [],
    assignments: [
      { id: 'ar3', title: 'Развернуть пилот электронного архива', description: '', assigneeId: 'p2', dueDate: '2026-06-10', priority: 'high', status: 'confirmed' },
      { id: 'ar4', title: 'Провести опрос сотрудников об удобстве системы', description: '', assigneeId: 'p3', dueDate: '2026-05-30', priority: 'low', status: 'sent' },
      { id: 'ar5', title: 'Обновить регламент хранения документов', description: '', assigneeId: 'p4', dueDate: '2026-06-08', priority: 'medium', status: 'confirmed' },
    ],
  },
  {
    id: 'm-2026-05-18',
    title: 'Оперативка по безопасности движения',
    platform: 'Яндекс Телемост',
    date: '2026-05-18T09:00:00',
    durationSec: 1500,
    organizer: 'Громов Виктор Иванович',
    department: 'Служба охраны труда',
    recordingState: 'done',
    participants: participants.slice(0, 4),
    transcript: [],
    assignments: [
      { id: 'ar6', title: 'Обновить плакаты по технике безопасности', description: '', assigneeId: 'p3', dueDate: '2026-05-22', priority: 'low', status: 'sent' },
    ],
  },
]

export const priorityLabels: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
}

export const statusLabels: Record<string, string> = {
  draft: 'Черновик',
  confirmed: 'Подтверждено',
  sent: 'Отправлено',
}
