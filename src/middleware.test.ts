import { beforeAll, describe, expect, it } from 'vitest';

/**
 * The canonical-host redirect.
 *
 * Worth testing rather than eyeballing, because the failure mode is a redirect
 * loop that takes the whole site down and is invisible until it is live.
 *
 * `NEXT_PUBLIC_SITE_URL` is read at module scope — Next substitutes it at build
 * time — so it has to be set before the module is imported.
 */
process.env['NEXT_PUBLIC_SITE_URL'] = 'https://hugfab.com';

type Middleware = (request: Request) => Promise<Response> | Response;

let middleware: Middleware;
let NextRequest: typeof import('next/server').NextRequest;

beforeAll(async () => {
  ({ NextRequest } = await import('next/server'));
  const mod = await import('./middleware');
  middleware = mod.middleware as unknown as Middleware;
});

function request(url: string, host: string, method = 'GET'): Request {
  return new NextRequest(new URL(url), { method, headers: { host } });
}

describe('canonical host redirect', () => {
  it('sends www to the apex, permanently', async () => {
    const response = await middleware(
      request('http://internal.local/search?q=hoodie', 'www.hugfab.com'),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://hugfab.com/search?q=hoodie');
  });

  it('preserves the path and query exactly', async () => {
    const response = await middleware(
      request('http://internal.local/products/levis-511?utm_source=x', 'www.hugfab.com'),
    );

    expect(response.headers.get('location')).toBe(
      'https://hugfab.com/products/levis-511?utm_source=x',
    );
  });

  it('uses 308 so a POST is not downgraded to a GET', async () => {
    const response = await middleware(
      request('http://internal.local/api/search', 'www.hugfab.com', 'POST'),
    );
    expect(response.status).toBe(308);
  });

  it('does NOT redirect the apex — this is the loop check', async () => {
    // A rule that matches its own output is how a redirect loop happens. The
    // destination host must fall through untouched.
    const response = await middleware(
      request('http://internal.local/search', 'hugfab.com'),
    );

    expect(response.status).not.toBe(308);
    expect(response.headers.get('location')).toBeNull();
  });

  it('leaves every other host alone', async () => {
    // A health check hitting the container directly, a preview hostname, or
    // localhost must not be dragged onto the production domain.
    for (const host of ['localhost:3000', '127.0.0.1:3000', 'hugfab.hostingersite.com']) {
      const response = await middleware(request('http://internal.local/', host));
      expect(response.headers.get('location')).toBeNull();
    }
  });

  it('forces https even when the inbound request is plain http', async () => {
    // TLS terminates at the proxy, so the request reaching Node is http.
    const response = await middleware(
      request('http://internal.local/', 'www.hugfab.com'),
    );
    expect(response.headers.get('location')?.startsWith('https://')).toBe(true);
  });

  it('still applies the security headers on a normal request', async () => {
    const response = await middleware(request('http://internal.local/', 'hugfab.com'));
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Content-Security-Policy')).toContain(
      "default-src 'self'",
    );
  });
});
