import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from './database.types';
import { env, features } from '@/lib/env.server';
import { ApiError } from '@/lib/http';

interface CookieSet {
  name: string;
  value: string;
  options: CookieOptions;
}

/**
 * Request-scoped Supabase client that reads and refreshes the auth cookie.
 * Use this for anything acting *as the signed-in user* — RLS applies.
 */
export async function createServerSupabase() {
  if (!features.supabase) {
    throw new ApiError(
      'NOT_CONFIGURED',
      'This feature needs a database connection that is not configured yet.',
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL as string,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieSet[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. The middleware refreshes
            // the session on every request, so this is safe to ignore here.
          }
        },
      },
    },
  );
}
