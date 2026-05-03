// backend/lib/supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type SupabaseEnv = {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  SUPABASE_ANON_KEY?: string
}

const DEFAULT_SUPABASE_URL = 'https://dfdohjlpfrnstqjyakfp.supabase.co'
const DEFAULT_SUPABASE_KEY = 'sb_secret_XTC2Q7JHDO8l9blaR63P6g_AzAdXq0W'

const resolveSupabaseConfig = (env: SupabaseEnv) => {
  const supabaseUrl = env?.SUPABASE_URL || DEFAULT_SUPABASE_URL
  const supabaseKey = env?.SUPABASE_SERVICE_ROLE_KEY || env?.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY

  return {
    supabaseUrl,
    supabaseKey,
  }
}

export const createSupabaseClient = (env: SupabaseEnv): SupabaseClient => {
  const { supabaseUrl, supabaseKey } = resolveSupabaseConfig(env)
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (...args) => fetch(...args),
    },
  })
}
