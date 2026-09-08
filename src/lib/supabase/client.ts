'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { clientEnv } from '@/lib/env.client';

/**
 * Browser Supabase client. Carries the anon key only — every read it can
 * perform is one RLS permits for the signed-in user (or `anon`).
 */
export function createClient() {
  const url = clientEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (see .env.example).',
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}
