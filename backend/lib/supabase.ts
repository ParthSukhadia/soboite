// backend/lib/supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type SupabaseEnv = {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  SUPABASE_ANON_KEY?: string
}

const DEFAULT_SUPABASE_URL = 'https://example.supabase.co'
const DEFAULT_SUPABASE_KEY = 'example-key'

const resolveSupabaseConfig = (env: SupabaseEnv) => {
  const supabaseUrl = env.SUPABASE_URL ?? DEFAULT_SUPABASE_URL
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY

  if (!supabaseKey || supabaseUrl === DEFAULT_SUPABASE_URL) {
    const missingVars = []
    if (!supabaseKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY')
    if (supabaseUrl === DEFAULT_SUPABASE_URL) missingVars.push('SUPABASE_URL')
    console.warn(
      `Supabase configuration uses placeholder values. Set ${missingVars.join(' and ')} env vars for real data.`
    )
  }

  return {
    supabaseUrl,
    supabaseKey: supabaseKey ?? DEFAULT_SUPABASE_KEY,
  }
}

export const createSupabaseClient = (env: SupabaseEnv): SupabaseClient => {
  const { supabaseUrl, supabaseKey } = resolveSupabaseConfig(env)
  return createClient(supabaseUrl, supabaseKey)
}
