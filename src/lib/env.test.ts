import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseClientEnv, parseServerEnv } from './env.schema';

const PRODUCTION_ENV = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_SITE_URL: 'https://hugfab.com',
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
};

describe('server environment', () => {
  it('accepts a complete production environment', () => {
    const env = parseServerEnv(PRODUCTION_ENV, 'production');
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://project.supabase.co');
    expect(env.NODE_ENV).toBe('production');
  });

  it('fails fast when a production build is missing the service-role key', () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _omitted, ...incomplete } = PRODUCTION_ENV;

    expect(() => parseServerEnv(incomplete, 'production')).toThrow(EnvValidationError);

    try {
      parseServerEnv(incomplete, 'production');
    } catch (error) {
      // The message has to name the key, or the CI failure is a guessing game.
      expect((error as EnvValidationError).issues.join()).toContain(
        'SUPABASE_SERVICE_ROLE_KEY',
      );
    }
  });

  it('lets development boot without a Supabase project', () => {
    const env = parseServerEnv({ NODE_ENV: 'development' }, 'development');
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(env.NEXT_PUBLIC_SITE_URL).toBe('http://localhost:3000');
  });

  it('treats a blank value as unset rather than as a valid key', () => {
    const env = parseServerEnv(
      { NODE_ENV: 'development', SUPABASE_SERVICE_ROLE_KEY: '   ' },
      'development',
    );
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });

  it('rejects a blank required value in production', () => {
    expect(() =>
      parseServerEnv({ ...PRODUCTION_ENV, SUPABASE_SERVICE_ROLE_KEY: '' }, 'production'),
    ).toThrow(EnvValidationError);
  });

  it('applies the India-first locale and currency defaults', () => {
    const env = parseServerEnv({}, 'development');
    expect(env.NEXT_PUBLIC_DEFAULT_LOCALE).toBe('en-IN');
    expect(env.NEXT_PUBLIC_DEFAULT_CURRENCY).toBe('INR');
    expect(env.LOG_LEVEL).toBe('info');
  });
});

describe('client environment', () => {
  it('rejects a site URL that is not absolute', () => {
    expect(() =>
      parseClientEnv({ NEXT_PUBLIC_SITE_URL: 'hugfab.com' }, 'development'),
    ).toThrow(EnvValidationError);
  });

  it('rejects a currency that is not an ISO-4217 code', () => {
    expect(() =>
      parseClientEnv({ NEXT_PUBLIC_DEFAULT_CURRENCY: 'rupees' }, 'development'),
    ).toThrow(EnvValidationError);
  });

  it('does not expose server-only keys', () => {
    const env = parseClientEnv(
      { ...PRODUCTION_ENV, SUPABASE_SERVICE_ROLE_KEY: 'service-key' },
      'production',
    );
    expect(env).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY');
  });
});
