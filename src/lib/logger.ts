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

function serialiseError(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      error: { name: error.name, message: error.message, stack: error.stack },
    };
  }
  return { error: String(error) };
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
