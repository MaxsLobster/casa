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

export interface Task {
  id: Id
  household_id: Id
  title: string
  owner_member_id: Id
  due_date: string // YYYY-MM-DD
  status: TaskStatus
  note: string | null
  created_by: Id | null
  created_at: string
  updated_at: string
  done_at: string | null
}

export interface Event {
  id: Id
  household_id: Id
  title: string
  date: string
  start_time: string | null // HH:MM(:SS)
  end_time: string | null
  member_id: Id | null // null = beide
  note: string | null
  created_by: Id | null
  created_at: string
  updated_at: string
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
  created_at: string
  updated_at: string
}

export interface Settings {
  member_id: Id
  dark_mode_auto: boolean
  quiet_hours_start: string
  quiet_hours_end: string
  updated_at: string
}

export type TableName = 'households' | 'members' | 'tasks' | 'events' | 'normal_week' | 'week_overrides' | 'settings'

export interface TableRow {
  households: Household
  members: Member
  tasks: Task
  events: Event
  normal_week: NormalWeekRow
  week_overrides: WeekOverride
  settings: Settings
}
