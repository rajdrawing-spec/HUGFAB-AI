import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { clientEnv } from '@/lib/env.client';
import { logger } from '@/lib/logger';

/**
 * OAuth and email-confirmation landing point. Exchanges the one-time code for a
 * session cookie, then sends the user on.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  // Open-redirect guard: only same-origin, absolute-path destinations.
  const destination = next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', url.origin));
  }

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } catch (error) {
    logger.error('auth callback failed', error);
    return NextResponse.redirect(new URL('/login?error=auth_failed', url.origin));
  }

  // Behind Nginx the request origin is the proxy's; the configured site URL is
  // the one the browser actually knows.
  const base = clientEnv.NEXT_PUBLIC_SITE_URL || url.origin;
  return NextResponse.redirect(new URL(destination, base));
}
