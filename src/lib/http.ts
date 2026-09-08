import { NextResponse } from 'next/server';
import { type z } from 'zod';

/**
 * The typed error envelope every route handler returns, plus the Zod-validation
 * front door. No handler parses a request body by hand (PRD §69).
 *
 * Success: { data: T }
 * Failure: { error: { code, message, details? } }
 *
 * `message` is safe to show a user. Internal detail goes to the logger, never
 * into the response.
 */

export const ERROR_CODES = [
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'UNPROCESSABLE',
  'NOT_CONFIGURED',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  NOT_CONFIGURED: 503,
  INTERNAL: 500,
};

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export type ApiSuccessBody<T> = { data: T };

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }

  get status(): number {
    return STATUS_BY_CODE[this.code];
  }
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json({ data }, init);
}

export function fail(
  code: ErrorCode,
  message: string,
  details?: unknown,
  init?: ResponseInit,
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: details === undefined ? { code, message } : { code, message, details },
  };
  return NextResponse.json(body, { status: STATUS_BY_CODE[code], ...init });
}

/** Field-level issues, shaped for a form to render next to its inputs. */
export function zodIssues(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Validate a JSON body. Throws ApiError, which `handle()` turns into a 400. */
export async function parseJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError('BAD_REQUEST', 'Request body must be valid JSON.');
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ApiError('BAD_REQUEST', 'Request body failed validation.', {
      fields: zodIssues(result.error),
    });
  }
  return result.data;
}

/** Validate `?a=1&b=2`. Repeated keys collapse to the last value. */
export function parseSearchParams<S extends z.ZodType>(
  url: string | URL,
  schema: S,
): z.infer<S> {
  const params = (url instanceof URL ? url : new URL(url)).searchParams;
  const raw = Object.fromEntries(params.entries());

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ApiError('BAD_REQUEST', 'Query parameters failed validation.', {
      fields: zodIssues(result.error),
    });
  }
  return result.data;
}
