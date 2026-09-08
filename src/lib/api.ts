import 'server-only';

import { type NextResponse } from 'next/server';
import { ApiError, fail } from './http';
import { logger } from './logger';

/**
 * Route-handler wrapper. Every handler under src/app/api is wrapped in this so
 * that no unexpected throw ever escapes as an HTML error page or leaks a stack
 * trace to the client.
 */

type Handler<Ctx> = (
  request: Request,
  context: Ctx,
) => Promise<NextResponse> | NextResponse;

export function handle<Ctx = unknown>(
  route: string,
  handler: Handler<Ctx>,
): Handler<Ctx> {
  return async (request, context) => {
    const requestId = crypto.randomUUID();
    const log = logger.child({ requestId, route, method: request.method });

    try {
      const response = await handler(request, context);
      response.headers.set('x-request-id', requestId);
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        // Expected, handled failure — info, not error.
        log.info('request rejected', { code: error.code, message: error.message });
        const response = fail(error.code, error.message, error.details);
        response.headers.set('x-request-id', requestId);
        return response;
      }

      log.error('unhandled route error', error);
      const response = fail(
        'INTERNAL',
        'Something went wrong on our side. Please try again.',
        // The id is the only thing a user can usefully quote back to support.
        { requestId },
      );
      response.headers.set('x-request-id', requestId);
      return response;
    }
  };
}
