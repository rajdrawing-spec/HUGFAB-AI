import { handle } from '@/lib/api';
import { ok } from '@/lib/http';
import { env, features } from '@/lib/env.server';
import { logger } from '@/lib/logger';
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

/**
 * `schema-missing` is its own state rather than a flavour of `degraded`.
 * "Postgres is unreachable" and "the migrations have not been applied" are
 * different problems with different fixes, and only the first is an emergency:
 * a monitor should page for an unreachable database, while an unmigrated one is
 * a deploy step you can read straight off this payload.
 */
type DependencyStatus = 'ok' | 'degraded' | 'schema-missing' | 'not-configured';

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

/** PostgREST's codes for "that table isn't there", via the API and via Postgres. */
const MISSING_RELATION_CODES = new Set(['PGRST205', 'PGRST202', '42P01']);

async function checkDatabase(): Promise<DependencyStatus> {
  if (!features.supabase) return 'not-configured';

  try {
    const supabase = await createServerSupabase();

    /**
     * A real query, on purpose.
     *
     * This used to call `auth.getSession()` and claim it proved "auth + network
     * reachability". It proved neither: with no auth cookie on the request —
     * which is every health check — `getSession()` reads local storage, returns
     * a null session and never touches the network. The probe reported `ok` for
     * any deployment whose environment variables were merely non-empty.
     *
     * `brands` is the cheapest honest target: RLS makes it readable by `anon`,
     * it is created by migration 0001, and one row settles credentials, network
     * and schema in a single round trip.
     */
    const { error } = await supabase.from('brands').select('id').limit(1);

    if (!error) return 'ok';
    if (error.code && MISSING_RELATION_CODES.has(error.code)) return 'schema-missing';

    logger.warn('health check could not reach the database', { cause: error.message });
    return 'degraded';
  } catch (error) {
    logger.error('health check threw', error);
    return 'degraded';
  }
}

export const GET = handle('GET /api/health', async () => {
  const database = await checkDatabase();
  const rateLimiter: DependencyStatus = features.distributedRateLimit
    ? 'ok'
    : 'not-configured';

  const body: HealthBody = {
    // Only an unreachable database makes the whole service unhealthy. A missing
    // schema is reported in `dependencies` and left at 200 on purpose: 503-ing
    // the marketing shell — and tripping every uptime monitor — because a
    // migration has not run yet helps nobody diagnose anything.
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
