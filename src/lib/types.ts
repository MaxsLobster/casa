export type Id = string

export interface Household { id: Id; name: string }

export interface Member {
  id: Id
  household_id: Id
  user_id: string | null
  email: string
  display_name: string
  role: string
}

export type TaskStatus = 'offen' | 'zugesagt' | 'geparkt' | 'erledigt'

export type Repeat = 'weekly' | 'monthly' | 'yearly'

export interface Task {
  id: Id
  household_id: Id
  title: string
  owner_member_id: Id
  due_date: string // YYYY-MM-DD
  status: TaskStatus
  note: string | null
  created_by: Id | null
  updated_by: Id | null
  created_at: string
  updated_at: string
  done_at: string | null
  repeat: Repeat | null
  repeat_until: string | null
}

export interface Event {
  id: Id
  household_id: Id
  title: string
  date: string
  end_date: string | null // mehrtägig: letzter Tag
  start_time: string | null // HH:MM(:SS)
  end_time: string | null
  member_id: Id | null // null = beide
  person_id: Id | null // z. B. Oma, Theresa
  note: string | null
  repeat: Repeat | null
  repeat_until: string | null
  created_by: Id | null
  updated_by: Id | null
  created_at: string
  updated_at: string
}

export interface Person {
  id: Id
  household_id: Id
  name: string
  kind: string
  sort: number
  created_at: string
}

export interface PushSubscriptionRow {
  id: Id
  member_id: Id
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string | null
  created_at: string
  last_ok_at: string | null
}

export interface ItemSeen {
  member_id: Id
  item_type: 'task' | 'event' | 'override'
  item_id: Id
  seen_at: string
}

export interface NotificationRow {
  id: Id
  household_id: Id
  recipient_member_id: Id
  kind: string
  title: string
  body: string
  url: string
  item_type: string | null
  item_id: Id | null
  created_at: string
  scheduled_for: string
  sent_at: string | null
  error: string | null
}

export type Slot =
  | 'valerie_bringen'
  | 'valerie_holen'
  | 'anna_arbeit'
  | 'nachmittag'
  | 'abend_essen'
  | 'abend_bett'
  | 'wochenende'

export interface NormalWeekRow {
  id: Id
  household_id: Id
  weekday: number // 1 = Montag … 7 = Sonntag
  slot: Slot
  value: string | null
  at: string | null
  is_open: boolean
  note: string | null
  updated_at: string
}

export interface WeekOverride {
  id: Id
  household_id: Id
  date: string
  slot: Slot
  value: string | null
  at: string | null
  note: string | null
  created_by: Id | null
  updated_by: Id | null
  created_at: string
  updated_at: string
}

export interface Settings {
  member_id: Id
  dark_mode_auto: boolean
  quiet_hours_start: string
  quiet_hours_end: string
  quiet_enabled: boolean
  briefing_time: string
  last_opened_at: string | null
  show_legend: boolean
  updated_at: string
}

export type TableName =
  | 'households'
  | 'members'
  | 'tasks'
  | 'events'
  | 'normal_week'
  | 'week_overrides'
  | 'settings'
  | 'people'
  | 'push_subscriptions'
  | 'item_seen'
  | 'notifications'

export interface TableRow {
  households: Household
  members: Member
  tasks: Task
  events: Event
  normal_week: NormalWeekRow
  week_overrides: WeekOverride
  settings: Settings
  people: Person
  push_subscriptions: PushSubscriptionRow
  item_seen: ItemSeen
  notifications: NotificationRow
}
