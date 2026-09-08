import 'server-only';

import {
  parseServerEnv,
  serverEnvSchema,
  type NodeEnv,
  type ServerEnv,
  EnvValidationError,
} from './env.schema';

/**
 * Server-side environment, validated once at module load. Importing this from a
 * client component is a build-time error: `server-only` has no browser export.
 *
 * Every secret in the application is read here and nowhere else (PRD §37).
 *
 * **Where strictness lives.** Exactly one place: `assertServerEnvironment()`,
 * called once from `instrumentation.ts` at server start.
 *
 * This module-level parse is deliberately lenient — it still rejects a
 * malformed URL, currency code or log level, but a *missing* key produces
 * `undefined` rather than a throw. Two reasons:
 *
 *   1. `next build` runs with NODE_ENV=production and has no business holding
 *      production secrets. CI must build a commit without them, and baking
 *      them into an artefact is how they leak.
 *   2. Throwing here fails whichever route happens to import it first, which
 *      reads as a random 500 on one endpoint while the rest of the site works.
 *      A misconfigured server should refuse to start, not half-work.
 */

const nodeEnv = (process.env.NODE_ENV ?? 'development') as NodeEnv;

/** Escape hatch for container image builds and one-off CI jobs. */
const skipValidation = process.env.SKIP_ENV_VALIDATION === 'true';

export const env: ServerEnv = parseServerEnv(process.env, 'development');

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * Feature switches derived from which keys are actually present, so an
 * integration silently no-ops rather than crashing when it is not configured
 * yet (PRD §36).
 */
export const features = {
  supabase: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  supabaseAdmin: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  distributedRateLimit: Boolean(
    env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN,
  ),
  sentry: Boolean(env.NEXT_PUBLIC_SENTRY_DSN),
  posthog: Boolean(env.NEXT_PUBLIC_POSTHOG_KEY),
} as const;

/**
 * The fail-fast gate, called once from `instrumentation.ts` at server start.
 *
 * In production a process missing a required key **exits** rather than serving
 * broken pages: PM2 then keeps the previous release live and the deploy's
 * health check fails, which is the outcome we want (docs/deployment.md).
 *
 * It exits rather than throws because Next logs an error thrown from
 * `register()` and carries on starting — which would leave a half-working
 * server, the exact failure mode this is here to prevent.
 */
export function assertServerEnvironment(): void {
  if (nodeEnv !== 'production' || skipValidation) return;

  const result = serverEnvSchema('production').safeParse(process.env);
  if (result.success) return;

  const error = new EnvValidationError(
    'server',
    result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    ),
  );

  console.error(`[hugfab] refusing to start.\n${error.message}`);
  process.exit(1);
}
