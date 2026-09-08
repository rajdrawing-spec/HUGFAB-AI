/**
 * Database types.
 *
 * These are hand-written placeholders for the shape Phase 0.4's migration
 * `0001_core.sql` creates. Once that migration lands they are replaced wholesale
 * by `supabase gen types typescript --local > src/lib/supabase/database.types.ts`
 * and this file is deleted.
 */

export type UserRole = 'user' | 'admin';

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}
