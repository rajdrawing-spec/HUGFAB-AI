import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Runs on every request that is not a static asset. Two jobs:
 *
 *   1. Security headers, including a per-request nonce CSP.
 *   2. Supabase session refresh — Server Components cannot write cookies, so
 *      the rotated auth token has to be set here or sessions expire mid-visit.
 *
 * This file deliberately does not import `lib/env.server`: middleware runs on
 * the Edge runtime, where `process.env` is not a plain enumerable object and
 * whole-object schema parsing is unreliable. Variables are read by literal name.
 */

const isProduction = process.env.NODE_ENV === 'production';

function buildCsp(nonce: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? '';

  const connect = [
    "'self'",
    supabaseUrl,
    supabaseUrl.replace(/^https:/, 'wss:'),
    posthogHost,
    'https://*.ingest.sentry.io',
  ].filter(Boolean);

  const directives: Array<[string, string[]]> = [
    ['default-src', ["'self'"]],
    [
      'script-src',
      [
        "'self'",
        `'nonce-${nonce}'`,
        // Lets Next's bootstrap script load the chunks it needs without
        // enumerating every hashed filename.
        "'strict-dynamic'",
        // Dev only: the React refresh runtime evaluates code at runtime.
        ...(isProduction ? [] : ["'unsafe-eval'"]),
      ],
    ],
    // Tailwind and next/font emit inline <style> during hydration; there is no
    // nonce hook for them yet, so inline styles stay permitted.
    ['style-src', ["'self'", "'unsafe-inline'"]],
    // Retailer imagery is hotlinked from many hosts per feed terms (PRD §32),
    // so image origins cannot be enumerated ahead of time.
    ['img-src', ["'self'", 'blob:', 'data:', 'https:']],
    ['font-src', ["'self'", 'data:']],
    ['connect-src', connect],
    ['media-src', ["'self'", 'https:']],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
    ['frame-src', ["'none'"]],
    ['worker-src', ["'self'", 'blob:']],
    ['manifest-src', ["'self'"]],
  ];

  const csp = directives
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');

  return isProduction ? `${csp}; upgrade-insecure-requests` : csp;
}

function applySecurityHeaders(response: NextResponse, csp: string): void {
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  );
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

  if (isProduction) {
    // Only ever sent over HTTPS; harmless but pointless on localhost.
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );
  }
}

export async function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = buildCsp(nonce);

  // Next reads the nonce back off the request's CSP header and stamps it onto
  // the scripts it renders.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>,
        ) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // Touching getUser() is what triggers the refresh. Do not remove.
    await supabase.auth.getUser();
  }

  applySecurityHeaders(response, csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next's own static output, the favicon, and common image
     * extensions — those are served straight from disk and need no session work.
     */
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
