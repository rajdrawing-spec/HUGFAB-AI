import { z } from 'zod';

/**
 * Pure schemas and parsers. This file touches neither `process.env` nor
 * `server-only`, which is what makes it unit-testable (src/lib/env.test.ts).
 * The modules that actually read the environment are `env.server.ts` and
 * `env.client.ts`.
 */

export type NodeEnv = 'development' | 'test' | 'production';

const nonEmpty = z.string().trim().min(1);

/** Treat "" the same as unset — a blank line in a .env file is not a value. */
const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === '' ? undefined : v));

/**
 * Required in production, optional elsewhere. Phase 0 has to boot without a
 * Supabase project so the scaffold can be developed before one exists; a
 * production build without these must fail loudly.
 */
function requiredInProduction(nodeEnv: NodeEnv) {
  return nodeEnv === 'production' ? nonEmpty : optional;
}

export function clientEnvSchema(nodeEnv: NodeEnv) {
  const supabase = requiredInProduction(nodeEnv);
  return z.object({
    NEXT_PUBLIC_SITE_URL: z
      .string()
      .trim()
      .url('must be an absolute URL, e.g. https://hugfab.com')
      .default('http://localhost:3000'),
    NEXT_PUBLIC_SUPABASE_URL: supabase,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabase,
    /** BCP-47 tag. Drives every date/number/currency format (PRD §73). */
    NEXT_PUBLIC_DEFAULT_LOCALE: z.string().trim().default('en-IN'),
    /** ISO-4217 code. India first; US/UK/UAE later without a code change. */
    NEXT_PUBLIC_DEFAULT_CURRENCY: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, 'must be a 3-letter ISO-4217 code, e.g. INR')
      .default('INR'),
    NEXT_PUBLIC_SENTRY_DSN: optional,
    NEXT_PUBLIC_POSTHOG_KEY: optional,
    NEXT_PUBLIC_POSTHOG_HOST: optional,
    NEXT_PUBLIC_BUILD_SHA: z.string().trim().default('dev'),
  });
}

export function serverEnvSchema(nodeEnv: NodeEnv) {
  return clientEnvSchema(nodeEnv).extend({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    /**
     * Bypasses RLS. Never imported by anything under src/components or
     * src/app/**\/page.tsx — only by `lib/supabase/admin.ts` (PRD §37).
     */
    SUPABASE_SERVICE_ROLE_KEY: requiredInProduction(nodeEnv),

    /** Absent in development: the rate limiter falls back to an in-memory store. */
    UPSTASH_REDIS_REST_URL: optional,
    UPSTASH_REDIS_REST_TOKEN: optional,

    /**
     * Salt for hashing click-out IP addresses. Optional, and its absence is
     * safe by design: without it no `ip_hash` is stored at all, because an
     * unsalted hash of an IPv4 address is reversible by brute force and would
     * be personal data wearing a disguise.
     */
    CLICK_IP_SALT: optional,

    SENTRY_ENVIRONMENT: z.string().trim().default(nodeEnv),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    // AI provider, affiliate network and payment keys are listed as commented
    // placeholders in .env.example and wired up in the phase that uses them
    // (PRD §36). Nothing unused is validated here.
  });
}

export type ClientEnv = z.infer<ReturnType<typeof clientEnvSchema>>;
export type ServerEnv = z.infer<ReturnType<typeof serverEnvSchema>>;

export class EnvValidationError extends Error {
  readonly issues: string[];
  constructor(scope: 'server' | 'client', issues: string[]) {
    super(
      `Invalid ${scope} environment:\n` +
        issues.map((i) => `  - ${i}`).join('\n') +
        `\n\nCompare your .env.local against .env.example.`,
    );
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.') || '(root)';
    return `${path}: ${issue.message}`;
  });
}

export function parseClientEnv(
  raw: Record<string, unknown>,
  nodeEnv: NodeEnv,
): ClientEnv {
  const result = clientEnvSchema(nodeEnv).safeParse(raw);
  if (!result.success) throw new EnvValidationError('client', formatIssues(result.error));
  return result.data;
}

export function parseServerEnv(
  raw: Record<string, unknown>,
  nodeEnv: NodeEnv,
): ServerEnv {
  const result = serverEnvSchema(nodeEnv).safeParse(raw);
  if (!result.success) throw new EnvValidationError('server', formatIssues(result.error));
  return result.data;
}
