import { createClient } from '@supabase/supabase-js'

const cleanEnvironmentValue = (value) => value
  .trim()
  .replace(/^['"]|['"]$/g, '')

const supabaseUrl = cleanEnvironmentValue(import.meta.env.VITE_SUPABASE_URL || '')
const supabaseAnonKey = cleanEnvironmentValue(import.meta.env.VITE_SUPABASE_ANON_KEY || '')
  .replace(/\s/g, '')

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the deployment environment.'
  )
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)