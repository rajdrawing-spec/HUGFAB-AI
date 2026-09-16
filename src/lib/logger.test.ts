import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from './logger';

/**
 * These exist because of a production incident this fix closes.
 *
 * Supabase queries were failing on the live site and every one of them logged
 * `"error": "[object Object]"` — a PostgREST failure is a plain object, not an
 * `Error`, so `String(error)` discarded the message, the code and the hint.
 * The difference between "the migrations were never applied" and "the keys are
 * wrong" was invisible in the logs, which is the moment logs earn their keep.
 */

let errors: string[];

beforeEach(() => {
  errors = [];
  vi.spyOn(console, 'error').mockImplementation((line: string) => {
    errors.push(line);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function loggedError(): Record<string, unknown> {
  const line = errors[0];
  expect(line, 'nothing was logged').toBeTruthy();
  // Development formats as text with a trailing JSON context object.
  const json = line!.startsWith('{') ? line! : line!.slice(line!.indexOf('{'));
  return JSON.parse(json) as Record<string, unknown>;
}

describe('error serialisation', () => {
  it('unpacks a PostgREST error instead of stringifying it', () => {
    // The exact shape supabase-js hands back.
    logger.error('product lookup failed', {
      message: 'Could not find the table "public.products" in the schema cache',
      code: 'PGRST205',
      details: null,
      hint: null,
    });

    const record = loggedError();
    const error = record['error'] as Record<string, unknown>;

    expect(error).not.toBe('[object Object]');
    expect(error['code']).toBe('PGRST205');
    expect(error['message']).toContain('public.products');
  });

  it('keeps the distinction between a missing schema and bad credentials', () => {
    // These need completely different fixes and used to log identically.
    logger.error('a', { message: 'relation does not exist', code: '42P01' });
    const schemaMissing = loggedError();

    errors = [];
    logger.error('b', { message: 'Invalid API key', status: 401 });
    const badKey = loggedError();

    expect((schemaMissing['error'] as Record<string, unknown>)['code']).toBe('42P01');
    expect((badKey['error'] as Record<string, unknown>)['status']).toBe(401);
  });

  it('still handles a real Error', () => {
    logger.error('boom', new TypeError('nope'));
    const error = loggedError()['error'] as Record<string, unknown>;

    expect(error['name']).toBe('TypeError');
    expect(error['message']).toBe('nope');
    expect(typeof error['stack']).toBe('string');
  });

  it('unpacks a wrapped error’s cause', () => {
    const wrapped = new Error('upsert failed', {
      cause: { message: 'duplicate key', code: '23505' },
    });
    logger.error('persist failed', wrapped);

    const error = loggedError()['error'] as Record<string, unknown>;
    const cause = error['cause'] as Record<string, unknown>;

    expect(cause['code']).toBe('23505');
  });

  it('does not spread an unrecognised object wholesale', () => {
    // A query error can carry the offending row; a log line is not the place
    // for user data. Only the named diagnostic fields are lifted out.
    logger.error('x', { message: 'bad row', code: 'X1', email: 'user@example.test' });

    const error = loggedError()['error'] as Record<string, unknown>;
    expect(error['code']).toBe('X1');
    expect(error['email']).toBeUndefined();
  });

  it('falls back to JSON rather than [object Object]', () => {
    logger.error('x', { unexpected: 'shape' });
    const error = loggedError()['error'];

    expect(error).not.toBe('[object Object]');
    expect(error).toEqual({ unexpected: 'shape' });
  });

  it('survives a value that cannot be serialised', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;

    expect(() => logger.error('x', cyclic)).not.toThrow();
    expect(loggedError()['error']).toBeDefined();
  });

  it('handles primitives and null', () => {
    logger.error('x', 'a plain string');
    expect(loggedError()['error']).toBe('a plain string');
  });
});
