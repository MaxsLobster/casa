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
  | MilaTableName

export interface TableRow extends MilaTableRow {
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

// ---------------------------------------------------------------------------
// Mila · Essensplaner (eigener Bereich, Tabellen mit Präfix mila_)
// ---------------------------------------------------------------------------

export type MilaCategory = 'schnell' | 'mealprep' | 'wochenende' | 'grill' | 'fruehstueck'
export type ShopCategory = 'obst_gemuese' | 'kuehl' | 'trocken' | 'getraenke' | 'sonstiges'

export interface MilaRecipe {
  id: Id
  household_id: Id
  name: string
  category: MilaCategory
  time_min: number | null
  portions: number
  valerie_tauglich: boolean
  devices: string[] // thermomix | pfanne | topf | wok | ofen | plancha | bge | dutch_oven
  notes: string | null
  valerie_note: string | null
  image_url: string | null
  created_by: Id | null
  updated_by: Id | null
  created_at: string
  updated_at: string
}

export interface MilaIngredient {
  id: Id
  household_id: Id
  recipe_id: Id
  position: number
  name: string
  amount: number | null
  unit: string
  pantry_basic: boolean
  shop_category: ShopCategory
}

export interface MilaStep {
  id: Id
  household_id: Id
  recipe_id: Id
  position: number
  title: string | null
  text: string
  timer_sec: number | null
  is_thermomix: boolean
  tm_time_sec: number | null
  tm_temp: string | null
  tm_speed: string | null
  tm_reverse: boolean
  ingredient_ids: Id[]
}

export interface MilaWeekDay {
  id: Id
  household_id: Id
  date: string
  recipe_id: Id | null
  free_text: string | null
  added_to_list: boolean
  created_by: Id | null
  updated_by: Id | null
  created_at: string
  updated_at: string
}

export interface MilaShoppingItem {
  id: Id
  household_id: Id
  name: string
  amount: string
  category: ShopCategory
  source_label: string | null
  source_week: string | null
  source_recipe_ids: Id[]
  added_by: Id | null
  checked: boolean
  checked_by: Id | null
  checked_at: string | null
  created_at: string
}

export type MilaTableName = 'mila_recipes' | 'mila_ingredients' | 'mila_steps' | 'mila_week_days' | 'mila_shopping_items'

export interface MilaTableRow {
  mila_recipes: MilaRecipe
  mila_ingredients: MilaIngredient
  mila_steps: MilaStep
  mila_week_days: MilaWeekDay
  mila_shopping_items: MilaShoppingItem
}
