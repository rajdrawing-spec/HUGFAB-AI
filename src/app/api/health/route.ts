import { handle } from '@/lib/api';
import { ok } from '@/lib/http';
import { env, features } from '@/lib/env.server';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Liveness and readiness probe. Nginx, PM2 and the deploy workflow poll this to
 * decide whether a release came up healthy before traffic is switched over
 * (docs/deployment.md).
 *
 * It reports the build SHA so "which commit is actually live?" is answerable
 * without SSH.
 */

// The point is the current state of this process, never a cached snapshot.
export const dynamic = 'force-dynamic';

type DependencyStatus = 'ok' | 'degraded' | 'not-configured';

interface HealthBody {
  status: 'ok' | 'degraded';
  sha: string;
  environment: string;
  uptimeSeconds: number;
  checkedAt: string;
  dependencies: {
    database: DependencyStatus;
    rateLimiter: DependencyStatus;
  };
}

async function checkDatabase(): Promise<DependencyStatus> {
  if (!features.supabase) return 'not-configured';

  try {
    const supabase = await createServerSupabase();
    // Cheapest possible round trip that still proves auth + network reachability.
    const { error } = await supabase.auth.getSession();
    return error ? 'degraded' : 'ok';
  } catch {
    return 'degraded';
  }
}

export const GET = handle('GET /api/health', async () => {
  const database = await checkDatabase();
  const rateLimiter: DependencyStatus = features.distributedRateLimit
    ? 'ok'
    : 'not-configured';

  const body: HealthBody = {
    status: database === 'degraded' ? 'degraded' : 'ok',
    sha: env.NEXT_PUBLIC_BUILD_SHA,
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    checkedAt: new Date().toISOString(),
    dependencies: { database, rateLimiter },
  };

  return ok(body, {
    status: body.status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
});
