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

export type Repeat = 'weekly' | 'biweekly' | 'fourweekly' | 'monthly' | 'yearly'

/** Was ein Ereignis für die Normalwoche bedeutet */
export type EventEffect = 'termin' | 'valerie_weg' | 'kita_zu' | 'eltern_weg' | 'messe'

/** Bereich: Casa (Familie) oder MWF (Munich Watch Fair, Arbeit) */
export type Area = 'casa' | 'mwf'

export interface Task {
  id: Id
  household_id: Id
  title: string
  owner_member_id: Id | null // null = offen, noch niemand
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
  anchor_id: Id | null // gehört zu einem Anker
  is_step: boolean // die Aufgabe ist der nächste Schritt des Ankers
  area: Area
  fair_id: Id | null // Rundenpunkt dieser Messe
  template_id: Id | null // aus dieser Vorlagenzeile erzeugt
  is_running: boolean // laufend: kein Abhaken, endet am Messetag
  is_yearly: boolean // Jahres-Checkliste
  is_skipped: boolean // Altlast: bei der Ersteinrichtung übersprungen, zählt weder als erledigt noch als offen
  archived_at?: string | null // archiviert (nicht gelöscht), z. B. beim Aufräumen mit dem Casa-Manager
  /** geklärt: zählt nicht als Bringen/Holen von Valerie */
  valerie_cleared?: boolean
}

// ---------------------------------------------------------------------------
// MWF: Messen, Checklisten-Vorlage, Ideen
// ---------------------------------------------------------------------------

export interface Fair {
  id: Id
  household_id: Id
  date: string
  note: string | null
  created_at: string
}

export type TemplateSection = 'start' | 'until' | 'before' | 'eve' | 'fair'

export interface TemplateRow {
  id: Id
  household_id: Id
  area: Area
  title: string
  owner_member_id: Id | null // null = beide
  section: TemplateSection
  days_before: number | null // null = Freitag der Startwoche
  is_running: boolean
  sort: number
  created_at: string
  updated_at: string
}

export interface Idea {
  id: Id
  household_id: Id
  area: Area
  text: string
  created_by: Id | null
  created_at: string
  updated_at: string
}

/** Zuruf: kurze Info von einem an den anderen (keine Aufgabe, nur Text) */
export interface Shout {
  id: Id
  household_id: Id
  area: Area
  from_member_id: Id
  to_member_id: Id
  text: string
  reply_to: Id | null // Antwort auf diesen Zuruf
  read_at: string | null // „gelesen" gedrückt
  archived_at: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Anker: laufende Lebensthemen
// ---------------------------------------------------------------------------

export type AnchorPhase = 'idee' | 'klaeren' | 'testen' | 'entscheiden' | 'laeuft'
export type AnchorVisibility = 'shared' | 'private'
export type AnchorLogKind = 'step_done' | 'phase' | 'note' | 'question' | 'sunday'

export interface Anchor {
  id: Id
  household_id: Id
  title: string
  why: string | null
  visibility: AnchorVisibility
  phase: AnchorPhase
  notes: string | null
  area: Area
  ask_next: boolean // Schritt erledigt, neuer noch nicht festgelegt
  moved_at: string // letzte Bewegung
  archived_at: string | null
  created_by: Id | null
  updated_by: Id | null
  created_at: string
  updated_at: string
}

export interface AnchorLog {
  id: Id
  household_id: Id
  anchor_id: Id
  kind: AnchorLogKind
  text: string
  author_member_id: Id | null
  at: string
  created_at: string
}

export interface AnchorQuestion {
  id: Id
  household_id: Id
  anchor_id: Id
  text: string
  resolved_at: string | null
  sort: number
  created_by: Id | null
  created_at: string
}

export interface AnchorPin {
  member_id: Id
  anchor_id: Id
  created_at: string
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
  effect: EventEffect
  // Übergabe bei „Valerie ist weg": wer bringt sie hin / holt sie ab (Name wie in der Woche), und wann
  dropoff_by: string | null
  dropoff_at: string | null
  pickup_by: string | null
  pickup_at: string | null
  /** geklärt: zählt nicht als Bringen/Holen von Valerie (Nachfrage mit Nein beantwortet) */
  valerie_cleared?: boolean
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
  | 'valerie_tag' // nur als Abweichung: wer hat Valerie tagsüber, wenn die Kita zu ist
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
  workday_on: string | null // Arbeitstag an diesem Datum (sonst aus)
  mwf_notify: 'aus' | 'briefing' | 'sofort'
  med_partner_ok?: boolean
  mila_notify?: boolean // Mila-Mitteilungen zur Wochenwahl (Standard an) // Zustimmung zur Abendfrage des Partners (Bereich Medikament)
  hidden_areas?: string[] // ausgeblendete Bereiche (Casa aufräumen), pro Person
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
  | 'anchors'
  | 'anchor_log'
  | 'anchor_questions'
  | 'anchor_pins'
  | 'fairs'
  | 'checklist_template'
  | 'ideas'
  | 'shouts'
  | 'slot_requests'
  | MedTableName
  | FreizeitTableName
  | MilaTableName
  | SonstigesTableName

export interface TableRow extends MilaTableRow, MedTableRow, FreizeitTableRow, SonstigesTableRow {
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
  anchors: Anchor
  anchor_log: AnchorLog
  anchor_questions: AnchorQuestion
  anchor_pins: AnchorPin
  fairs: Fair
  checklist_template: TemplateRow
  ideas: Idea
  shouts: Shout
  slot_requests: SlotRequest
}

/** „Kannst du übernehmen?“ – Anfrage für Bringen, Holen, Kochen, Bett an einem Tag */
export type SlotRequestStatus = 'offen' | 'zugesagt' | 'abgelehnt' | 'zurueckgezogen'
export interface SlotRequest {
  id: Id
  household_id: Id
  date: string
  slot: Slot
  at: string | null
  from_member_id: Id
  to_member_id: Id
  status: SlotRequestStatus
  note: string | null
  answered_at: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Mila · Essensplaner (eigener Bereich, Tabellen mit Präfix mila_)
// ---------------------------------------------------------------------------

export type MilaCategory = 'schnell' | 'mealprep' | 'wochenende' | 'grill' | 'fruehstueck'
export type ShopCategory = 'obst_gemuese' | 'kuehl' | 'fleisch_fisch' | 'trocken' | 'getraenke' | 'sonstiges'

export interface MilaNutrition {
  kcal?: number
  kj?: number
  protein_g?: number
  fett_g?: number
  ges_fett_g?: number
  kh_g?: number
  zucker_g?: number
  salz_g?: number
  ballaststoffe_g?: number
}
export interface MilaVariant {
  tausch: { statt: string; nimm: string }[]
  kcal_geschaetzt?: number | null
  protein_g_geschaetzt?: number | null
}
export type MilaVariantKey = 'original' | 'light' | 'protein'

export interface MilaBlend {
  id: Id
  household_id: Id
  key: string
  name: string
  ersetzt: string | null
  glas_rezept: { zutat: string; menge: number | null; einheit: string | null }[]
  portion: string | null
  haltbar: string | null
  scharf: boolean
  geschaetzt: boolean
  hinweis: string | null
}

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
  meal: MilaMeal
  label: string | null // Kartenkategorie, leer = alte Kategorie
  blurb: string | null // ein Satz für die Karte
  valerie_mag: boolean
  cook_double: boolean // „doppelt → Mittag“
  prep_box: boolean // komplett vorbereitbar
  // Fundus (HelloFresh-Import); bei eigenen Gerichten leer
  hf_id?: string | null
  source_url?: string | null
  subtitle?: string | null
  photo_path?: string | null // Pfad im Speicher „mila-fotos“
  difficulty?: 'leicht' | 'mittel' | 'aufwendig' | null
  tags?: string[]
  cuisine?: string[]
  allergens?: string[]
  traces?: string[]
  utensils?: string[]
  optional_items?: string[]
  nutrition?: MilaNutrition | null
  prep_info?: { tauglich: boolean; modus?: string; satz?: string; haltbar_tage?: number | null } | null
  device_tips?: { thermomix?: string | null; airfryer?: string | null } | null
  variants?: { light: MilaVariant | null; protein: MilaVariant | null } | null
  kit?: unknown
  anna?: { paprika_ersetzt?: boolean; hinweis?: string | null } | null
  created_by: Id | null
  updated_by: Id | null
  created_at: string
  updated_at: string
}

/** Wofür ein Gericht taugt */
export type MilaMeal = 'mittag' | 'abend' | 'beides'
/** Mahlzeit in der Woche */
export type MealSlot = 'mittag' | 'abend'

export interface MilaPrepStep {
  id: Id
  household_id: Id
  recipe_id: Id
  position: number
  text: string
  duration_min: number | null
  runs_alongside: boolean
  box_label: string | null
  day_before: boolean
}

export interface MilaSettings {
  household_id: Id
  lunches: number
  dinners: number
  card_weekday: number
  card_time: string
  close_weekday: number
  close_time: string
  adopt_weekday: number
  adopt_time: string
  shop_weekday: number
  prep_weekday: number
  prep_time: string
  updated_at: string
}

export type MilaVoteKind = 'nein' | 'ja' | 'joker'

export interface MilaVote {
  id: Id
  household_id: Id
  menu_id: Id
  member_id: Id
  recipe_id: Id
  meal: MealSlot
  vote: MilaVoteKind
  created_at: string
}

/** Eine Mahlzeit der verteilten Woche */
export interface PlanSlot {
  date: string
  meal: MealSlot
  recipe_id: Id
  leftover: boolean // Reste vom Vorabend
  servings: number
}

export interface PlanHit {
  recipe_id: Id
  meal: MealSlot
  kind: 'treffer' | 'joker' | 'aufgefuellt'
  joker_by: Id[]
  points: number
}

export interface MilaPlan {
  hits: PlanHit[]
  reserve: PlanHit[]
  /** Reihenfolge, die beim Ziehen geändert wird */
  dinners: Id[]
  lunches: Id[]
  slots: PlanSlot[]
  /** Tage, an denen ihr beide weg seid */
  skipped: string[]
  voters: Id[]
}

export interface MilaMenu {
  id: Id
  household_id: Id
  week: string
  dinner_ids: Id[]
  lunch_ids: Id[]
  opens_at: string
  closes_at: string
  adopt_at: string
  done_by: Id[]
  revealed_at: string | null
  plan: MilaPlan | null
  adopted_at: string | null
  adopted_by: Id | null
  prep_done: string[]
  created_by: Id | null
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
  hint?: string | null
  hf_original?: string | null
  blend_key?: string | null
  anna_swap?: boolean
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
  variant?: 'original' | 'thermomix'
  photo_path?: string | null
  in_prep?: boolean
}

export interface MilaWeekDay {
  id: Id
  household_id: Id
  date: string
  recipe_id: Id | null
  free_text: string | null
  added_to_list: boolean
  meal: MealSlot
  is_leftover: boolean
  servings: number | null
  variant?: MilaVariantKey
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
  is_stock: boolean // „meist Vorrat“: grau vorab abgehakt
  created_at: string
}

export type MilaTableName = 'mila_recipes' | 'mila_ingredients' | 'mila_steps' | 'mila_week_days' | 'mila_shopping_items' | 'mila_prep_steps' | 'mila_settings' | 'mila_menus' | 'mila_votes' | 'mila_hausmischungen' | 'mila_week_plans' | 'mila_swipes' | 'mila_matches' | 'mila_plan_items' | 'mila_haltbarkeit_regeln' | 'mila_vormerkungen'

/** Gericht schon mal vorgemerkt: kommt in den nächsten Stapel */
export interface MilaVormerkung {
  id: Id
  household_id: Id
  recipe_id: Id
  member_id: Id | null
  created_at: string
}

export interface MilaTableRow {
  mila_vormerkungen: MilaVormerkung
  mila_recipes: MilaRecipe
  mila_ingredients: MilaIngredient
  mila_steps: MilaStep
  mila_week_days: MilaWeekDay
  mila_shopping_items: MilaShoppingItem
  mila_prep_steps: MilaPrepStep
  mila_settings: MilaSettings
  mila_menus: MilaMenu
  mila_votes: MilaVote
  mila_hausmischungen: MilaBlend
  mila_week_plans: MilaWeekPlan
  mila_swipes: MilaSwipe
  mila_matches: MilaMatch
  mila_plan_items: MilaPlanItem
  mila_haltbarkeit_regeln: MilaShelfRule
}

// ---------------------------------------------------------------------------
// Medikament · privates Add-on (Tabellen mit Präfix med_, alles pro Mitglied)
// ---------------------------------------------------------------------------

export interface MedSettings {
  member_id: Id
  household_id: Id
  enabled: boolean
  t_morning: string
  t_1: string
  t_2: string
  t_3: string
  ask_partner: boolean
  t_partner: string
  updated_at: string
}

export interface MedCourse {
  id: Id
  member_id: Id
  household_id: Id
  name: string | null // leer = kein Medikament
  dose: string | null
  start_date: string
  created_at: string
}

export interface MedDay {
  id: Id
  member_id: Id
  household_id: Id
  date: string
  taken_at: string | null
  sleep: number | null
}

export type MedSlot = 1 | 2 | 3

export interface MedCheckin {
  id: Id
  member_id: Id
  household_id: Id
  date: string
  slot: MedSlot
  focus: number | null
  calm: number | null
  mood: number | null
  note: string | null
  appetite: number | null
  side_effects: string[]
}

export interface MedPartnerAnswer {
  id: Id
  household_id: Id
  about_member_id: Id
  from_member_id: Id
  date: string
  value: number
  note: string | null
}

export type MedTableName = 'med_settings' | 'med_courses' | 'med_days' | 'med_checkins' | 'med_partner_answers'

export interface MedTableRow {
  med_settings: MedSettings
  med_courses: MedCourse
  med_days: MedDay
  med_checkins: MedCheckin
  med_partner_answers: MedPartnerAnswer
}

// ---------------------------------------------------------------------------
// Freizeit: Wochenend-Tipps vom Freizeit-Scout (kommen über die Edge Function „freizeit-api“)
// ---------------------------------------------------------------------------

export type FreizeitTyp = 'haupt' | 'planb' | 'oma' | 'vorschau' | 'alarm'
export type FreizeitStatus = 'neu' | 'machen' | 'nix' | 'gemacht'

export interface FreizeitRadar {
  id: Id
  household_id: Id
  wochenende: string // Samstag
  wetter: string | null
  erstellt_am: string
}

export interface FreizeitTipp {
  id: Id
  household_id: Id
  radar_id: Id | null
  typ: FreizeitTyp
  titel: string
  start: string | null // ISO mit Zeitzone
  ende: string | null
  ganztags: boolean
  start_tag: string | null
  ort: string | null
  fahrzeit_min: number | null
  preis: string | null
  anmeldung: 'ja' | 'nein' | 'unbekannt'
  frist: string | null
  warum_valerie: string | null
  fuer_euch: string | null
  hinweis: string | null
  link: string | null
  grund: string | null
  status: FreizeitStatus
  notiz: string | null
  feedback_von: Id | null
  feedback_am: string | null
  event_id: Id | null // Eintrag in der Casa-Woche
  erstellt_am: string
}

export type FreizeitTableName = 'freizeit_radar' | 'freizeit_tipps'

export interface FreizeitTableRow {
  freizeit_radar: FreizeitRadar
  freizeit_tipps: FreizeitTipp
}

// ---------------------------------------------------------------------------
// Mila · Wochenwahl (Anzahl, Wischen, Treffer, Kombo, Heute dran)
// ---------------------------------------------------------------------------

export type MilaPlanStatus = 'wischen' | 'kombo' | 'aktiv' | 'fertig' | 'verworfen'
export interface MilaDeckCard {
  recipe_id: Id
  meal: MealSlot
}
export interface MilaWeekPlan {
  id: Id
  household_id: Id
  week: string // Montag
  abend_anzahl: number
  mittag_anzahl: number
  deadline: string
  status: MilaPlanStatus
  deck: MilaDeckCard[]
  deck_built_at: string | null
  beide_fertig_at: string | null
  kombo_at: string | null
  adopted_at: string | null
  adopted_by: Id | null
  einkauf_tag: string | null
  prep_tag: string | null
  prep_done: string[]
  erinnert_at?: string | null
  created_at: string
  updated_at: string
}
export type MilaWahl = 'ja' | 'nein' | 'stern'
export interface MilaSwipe {
  id: Id
  household_id: Id
  plan_id: Id
  member_id: Id
  recipe_id: Id
  wahl: MilaWahl
  created_at: string
}
export interface MilaMatch {
  id: Id
  household_id: Id
  plan_id: Id
  recipe_id: Id
  created_at: string
}
export type MilaItemSlot = 'abend' | 'mittag' | 'reste'
export type MilaItemGroup = 'zuerst' | 'prep' | 'schluss'
export type MilaItemArt = 'joker' | 'treffer' | 'halb' | 'offen' | 'dazu'
export type MilaItemStatus = 'offen' | 'gekocht' | 'eingefroren' | 'getauscht' | 'reserve'
export interface MilaPlanItem {
  id: Id
  household_id: Id
  plan_id: Id
  recipe_id: Id
  slot: MilaItemSlot
  gruppe: MilaItemGroup
  position: number
  art: MilaItemArt
  portionen: number
  variante: MilaVariantKey
  status: MilaItemStatus
  frist_bis: string | null
  parent_id: Id | null
  geplant_am: string | null
  gekocht_am: string | null
  created_at: string
  updated_at: string
}
export interface MilaShelfRule {
  id: Id
  household_id: Id
  stichwort: string
  tage: number | null // null = unbegrenzt
  gruppe: 'kurz' | 'mittel' | 'lang' | 'vorrat'
}

// ---------------------------------------------------------------------------
// Sonstiges: Hausbuch, Geschenk-Dose, Casa aufräumen
// ---------------------------------------------------------------------------
export interface HouseEntry {
  id: Id
  household_id: Id
  section: string
  title: string
  value: string | null
  date: string | null
  note: string | null
  hidden: boolean // erst nach Antippen sichtbar
  position: number
  created_by: Id | null
  updated_by: Id | null
  created_at: string
  updated_at: string
}
export interface GiftPerson {
  id: Id
  household_id: Id
  name: string
  birthday_day: number | null
  birthday_month: number | null
  birth_year: number | null
  member_id: Id | null // Max oder Anna selbst: Ideen privat
  note: string | null
  archived_at: string | null
  created_by: Id | null
  created_at: string
  updated_at: string
}
export interface GiftIdea {
  id: Id
  household_id: Id
  person_id: Id
  text: string
  done_at: string | null
  created_by: Id
  created_at: string
  updated_at: string
}
export interface AreaVisit {
  id?: Id
  member_id: Id
  household_id: Id
  area: string
  last_at: string
}
export type SonstigesTableName = 'house_entries' | 'gift_people' | 'gift_ideas' | 'area_visits'
export interface SonstigesTableRow {
  house_entries: HouseEntry
  gift_people: GiftPerson
  gift_ideas: GiftIdea
  area_visits: AreaVisit
}
