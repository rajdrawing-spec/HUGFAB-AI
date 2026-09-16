import 'server-only';

import { env } from './env.server';

/**
 * Structured server logger. One JSON object per line in production so the VPS
 * log shipper can parse it; readable text in development.
 *
 * Never log a secret, a raw affiliate credential, or a full request body.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const threshold = LEVEL_ORDER[env.LOG_LEVEL];

export interface LogContext {
  [key: string]: unknown;
}

/**
 * Anything with a `message` is worth unpacking, not just an `Error`.
 *
 * PostgREST — and therefore every Supabase query — reports failure as a plain
 * object: `{ message, code, details, hint }`. It is not an `Error`, so the old
 * `String(error)` fallback rendered the entire thing as the literal text
 * "[object Object]" and threw away the only fields that say what went wrong.
 *
 * That is not a cosmetic loss. `PGRST205` ("could not find the table") means
 * the migrations have not been applied; `42P01` means the same at the SQL
 * level; an auth failure means the keys are wrong; a network error means the
 * project is unreachable. Those need completely different fixes, and in
 * production they were all logged identically and indistinguishably.
 */
function serialiseError(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        // `cause` carries the underlying failure for a wrapped error.
        ...(error.cause === undefined ? {} : { cause: describeUnknown(error.cause) }),
      },
    };
  }

  return { error: describeUnknown(error) };
}

/** The readable fields of a non-Error value, or its string form. */
function describeUnknown(value: unknown): unknown {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return String(value);

  const source = value as Record<string, unknown>;

  // The PostgREST error shape, and the shape most SDKs settle on. Picked by
  // name rather than spread wholesale: a query error can carry the offending
  // row, and a log line is not the place for user data.
  const picked: LogContext = {};
  for (const key of ['name', 'message', 'code', 'details', 'hint', 'status'] as const) {
    if (source[key] !== undefined) picked[key] = source[key];
  }

  if (Object.keys(picked).length > 0) return picked;

  // Nothing recognisable. JSON beats "[object Object]"; a value that cannot be
  // serialised (a cycle, a BigInt) falls back to its string form.
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return String(value);
  }
}

function emit(level: Level, message: string, context?: LogContext): void {
  if (LEVEL_ORDER[level] < threshold) return;

  const record = {
    level,
    time: new Date().toISOString(),
    message,
    ...context,
  };

  const line =
    env.NODE_ENV === 'production'
      ? JSON.stringify(record)
      : `${level.toUpperCase().padEnd(5)} ${record.time} ${message}` +
        (context ? ` ${JSON.stringify(context)}` : '');

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit('debug', message, context),
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, error?: unknown, context?: LogContext) =>
    emit('error', message, { ...context, ...(error ? serialiseError(error) : {}) }),

  /** A logger that stamps every line with the same fields, e.g. a request id. */
  child(bound: LogContext) {
    return {
      debug: (m: string, c?: LogContext) => emit('debug', m, { ...bound, ...c }),
      info: (m: string, c?: LogContext) => emit('info', m, { ...bound, ...c }),
      warn: (m: string, c?: LogContext) => emit('warn', m, { ...bound, ...c }),
      error: (m: string, e?: unknown, c?: LogContext) =>
        emit('error', m, { ...bound, ...c, ...(e ? serialiseError(e) : {}) }),
    };
  },
};
