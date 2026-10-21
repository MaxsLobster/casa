// Datenzugriff. Zwei Implementierungen:
//  - SupabaseStore: echte Datenbank (RLS sorgt dafür, dass nur der eigene Haushalt sichtbar ist)
//  - LocalStore:    Demo-Modus im Browser (localStorage), wenn keine Zugangsdaten gesetzt sind

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TableName, TableRow } from './types'
import { seedLocal } from './seed'

export type Filter = Record<string, string | number | boolean | null>

export interface Store {
  select<T extends TableName>(table: T, filter?: Filter): Promise<TableRow[T][]>
  insert<T extends TableName>(table: T, row: Partial<TableRow[T]>): Promise<TableRow[T]>
  update<T extends TableName>(table: T, key: Filter, patch: Partial<TableRow[T]>): Promise<void>
  upsert<T extends TableName>(table: T, row: Partial<TableRow[T]>, onConflict: string): Promise<TableRow[T]>
  remove<T extends TableName>(table: T, key: Filter): Promise<void>
  /** Ruft cb auf, wenn sich eine der Tabellen (durch wen auch immer) ändert. */
  onChange(tables: TableName[], cb: (table: TableName) => void): () => void
}

// ---------------------------------------------------------------------------

export class SupabaseStore implements Store {
  constructor(private db: SupabaseClient) {}

  async select<T extends TableName>(table: T, filter: Filter = {}): Promise<TableRow[T][]> {
    let q = this.db.from(table).select('*')
    for (const [k, v] of Object.entries(filter)) q = v === null ? q.is(k, null) : q.eq(k, v)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as TableRow[T][]
  }

  async insert<T extends TableName>(table: T, row: Partial<TableRow[T]>): Promise<TableRow[T]> {
    const { data, error } = await this.db.from(table).insert(row as never).select('*').single()
    if (error) throw error
    return data as TableRow[T]
  }

  async update<T extends TableName>(table: T, key: Filter, patch: Partial<TableRow[T]>): Promise<void> {
    let q = this.db.from(table).update(patch as never)
    for (const [k, v] of Object.entries(key)) q = q.eq(k, v)
    const { error } = await q
    if (error) throw error
  }

  async upsert<T extends TableName>(table: T, row: Partial<TableRow[T]>, onConflict: string): Promise<TableRow[T]> {
    const { data, error } = await this.db.from(table).upsert(row as never, { onConflict }).select('*').single()
    if (error) throw error
    return data as TableRow[T]
  }

  async remove<T extends TableName>(table: T, key: Filter): Promise<void> {
    let q = this.db.from(table).delete()
    for (const [k, v] of Object.entries(key)) q = q.eq(k, v)
    const { error } = await q
    if (error) throw error
  }

  onChange(tables: TableName[], cb: (table: TableName) => void): () => void {
    let channel = this.db.channel('casa-' + Math.random().toString(36).slice(2))
    for (const t of tables) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => cb(t))
    }
    channel.subscribe()
    return () => {
      this.db.removeChannel(channel)
    }
  }
}

// ---------------------------------------------------------------------------

type Listener = (table: TableName) => void

export class LocalStore implements Store {
  private listeners = new Set<Listener>()
  private prefix = 'casa.demo.'

  constructor() {
    if (!localStorage.getItem(this.prefix + 'seeded')) {
      seedLocal(this)
      localStorage.setItem(this.prefix + 'seeded', '1')
    }
    window.addEventListener('storage', (e) => {
      if (e.key?.startsWith(this.prefix)) {
        const t = e.key.slice(this.prefix.length) as TableName
        this.listeners.forEach((l) => l(t))
      }
    })
  }

  private read<T extends TableName>(table: T): TableRow[T][] {
    try {
      return JSON.parse(localStorage.getItem(this.prefix + table) ?? '[]')
    } catch {
      return []
    }
  }

  private write<T extends TableName>(table: T, rows: TableRow[T][]) {
    localStorage.setItem(this.prefix + table, JSON.stringify(rows))
    this.listeners.forEach((l) => l(table))
  }

  private matches(row: Record<string, unknown>, filter: Filter) {
    return Object.entries(filter).every(([k, v]) => row[k] === v)
  }

  async select<T extends TableName>(table: T, filter: Filter = {}): Promise<TableRow[T][]> {
    return this.read(table).filter((r) => this.matches(r as unknown as Record<string, unknown>, filter))
  }

  insertSync<T extends TableName>(table: T, row: Partial<TableRow[T]>): TableRow[T] {
    const now = new Date().toISOString()
    const full = { id: crypto.randomUUID(), created_at: now, updated_at: now, ...row } as TableRow[T]
    this.write(table, [...this.read(table), full])
    return full
  }

  async insert<T extends TableName>(table: T, row: Partial<TableRow[T]>): Promise<TableRow[T]> {
    return this.insertSync(table, row)
  }

  async update<T extends TableName>(table: T, key: Filter, patch: Partial<TableRow[T]>): Promise<void> {
    const now = new Date().toISOString()
    this.write(
      table,
      this.read(table).map((r) => (this.matches(r as unknown as Record<string, unknown>, key) ? { ...r, ...patch, updated_at: now } : r)),
    )
  }

  async upsert<T extends TableName>(table: T, row: Partial<TableRow[T]>, onConflict: string): Promise<TableRow[T]> {
    const keys = onConflict.split(',').map((s) => s.trim())
    const r = row as Record<string, unknown>
    const existing = this.read(table).find((x) => keys.every((k) => (x as unknown as Record<string, unknown>)[k] === r[k]))
    if (existing) {
      await this.update(table, { id: (existing as { id: string }).id }, row)
      return { ...existing, ...row } as TableRow[T]
    }
    return this.insertSync(table, row)
  }

  async remove<T extends TableName>(table: T, key: Filter): Promise<void> {
    this.write(table, this.read(table).filter((r) => !this.matches(r as unknown as Record<string, unknown>, key)))
  }

  onChange(tables: TableName[], cb: Listener): () => void {
    const l: Listener = (t) => {
      if (tables.includes(t)) cb(t)
    }
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
}
