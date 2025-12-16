import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Keep this file minimal: export a factory that creates a Supabase client
// when called. This avoids reading env vars at module import time which can
// lead to intermittent "missing env" issues in some dev workflows.
export function createSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export type { SupabaseClient };

