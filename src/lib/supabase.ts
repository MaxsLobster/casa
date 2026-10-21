import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Null, wenn keine Zugangsdaten gesetzt sind → Demo-Modus (lokal im Browser). */
export const supabase: SupabaseClient | null =
  url && anon && !url.includes('DEIN-PROJEKT')
    ? createClient(url, anon, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'implicit',
        },
      })
    : null

export const isDemo = supabase === null
