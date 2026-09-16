import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { env, features } from '@/lib/env.server';

/**
 * Anonymous Supabase client with no session and no cookies.
 *
 * `createServerSupabase()` reads `cookies()` from `next/headers`, which does
 * not exist during static generation — so it cannot be used from `sitemap.ts`,
 * which Next may evaluate at build time. This client holds the anon key only,
 * so RLS still decides what comes back: inactive products, mock rows and
 * anything else a visitor cannot see are as invisible here as anywhere else.
 *
 * Only for reads that genuinely have no user: the sitemap, and anything else
 * that describes the public catalogue rather than a person's view of it.
 *
 * Returns null rather than throwing when Supabase is not configured. A missing
 * database should cost the sitemap its product entries, not fail the build.
 */
export function createPublicSupabase() {
  if (!features.supabase) return null;

  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL as string,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
