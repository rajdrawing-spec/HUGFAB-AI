import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { env, features } from '@/lib/env.server';

/**
 * Service-role client. **Bypasses RLS entirely.**
 *
 * Only the ingestion worker and audited admin actions may use it. It must never
 * be reached from a request handler that acts on behalf of a user — use
 * `createServerSupabase()` there so the database enforces the user's permissions.
 */
export function createAdminSupabase() {
  if (!features.supabaseAdmin) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Admin and ingestion operations ' +
        'are unavailable (see .env.example).',
    );
  }

  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL as string,
    env.SUPABASE_SERVICE_ROLE_KEY as string,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
