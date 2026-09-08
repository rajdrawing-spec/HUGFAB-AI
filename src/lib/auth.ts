import 'server-only';

import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { features } from './env.server';
import { ApiError } from './http';
import { logger } from './logger';
import { createServerSupabase } from './supabase/server';
import type { UserRole } from './supabase/types';

/**
 * Server-side auth guards. The role is read from the database on every check —
 * never from a client-supplied header, query parameter or JWT claim the user
 * could influence.
 */

export interface SessionUser {
  id: string;
  email: string | null;
  role: UserRole;
}

/**
 * The signed-in user, or null. Uses `getUser()` rather than `getSession()`:
 * only `getUser()` revalidates the token with the auth server, so a forged or
 * expired cookie cannot pass.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  if (!features.supabase) return null;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    role: await readRole(supabase, data.user),
  };
}

/**
 * Role lookup against `profiles`. Fails closed: if the row or the table is
 * missing, or the query errors, the user is not an admin.
 *
 * `profiles` is created by migration 0001 (work item 0.4). Until it exists this
 * correctly returns 'user' for everyone.
 */
async function readRole(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  user: User,
): Promise<UserRole> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: UserRole }>();

  if (error) {
    logger.warn('could not read profile role, defaulting to "user"', {
      userId: user.id,
      cause: error.message,
    });
    return 'user';
  }

  return data?.role === 'admin' ? 'admin' : 'user';
}

/** For pages. Sends anonymous visitors to /login with a return path. */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : '';
    redirect(`/login${next}`);
  }
  return user;
}

/** For pages. */
export async function requireAdmin(returnTo?: string): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (user.role !== 'admin') {
    logger.warn('admin route denied', { userId: user.id });
    // 404 rather than 403: an admin surface should not confirm it exists.
    redirect('/not-found');
  }
  return user;
}

/** For route handlers. Throws an ApiError that `handle()` renders as JSON. */
export async function requireApiUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError('UNAUTHORIZED', 'You need to be signed in to do that.');
  return user;
}

/** For route handlers. */
export async function requireApiAdmin(): Promise<SessionUser> {
  const user = await requireApiUser();
  if (user.role !== 'admin') {
    logger.warn('admin API denied', { userId: user.id });
    throw new ApiError('NOT_FOUND', 'Not found.');
  }
  return user;
}
