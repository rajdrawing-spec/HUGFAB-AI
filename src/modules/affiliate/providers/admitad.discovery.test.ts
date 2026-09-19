import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAdmitadProvider } from './admitad';

/**
 * Account discovery, against the response shapes Admitad's own Python SDK
 * asserts in its test fixtures — the envelope `{results, _meta}` and the ad
 * space object with `id`, `name`, `status`, `site_url`.
 *
 * Those fixtures are the closest thing to a contract available without a live
 * account, which this codebase does not have: the publisher account is not
 * active, so no credential exists to call the real API with. These tests
 * therefore prove the adapter handles the documented shape and, just as
 * importantly, that it degrades usefully when the shape is not what was
 * expected — which is the case that will actually happen first.
 */

const credentials = { clientId: 'id', clientSecret: 'secret' };

function settings(): Record<string, unknown> {
  return { apiBaseUrl: 'https://api.example.test' };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Token first, then one response per API call, in order. */
function mockFetch(...responses: Response[]): void {
  const queue = [jsonResponse({ access_token: 't', expires_in: 3600 }), ...responses];
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(queue.shift() ?? jsonResponse({}, 500))),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('describeAccount', () => {
  it('reads the documented envelope and object fields', async () => {
    mockFetch(
      jsonResponse({
        results: [
          {
            id: 4,
            status: 'active',
            kind: 'website',
            name: 'HugFab',
            site_url: 'https://hugfab.com/',
            validation_passed: true,
          },
        ],
        _meta: { limit: 100, offset: 0, count: 1 },
      }),
      jsonResponse({
        results: [{ id: 91, name: 'A Retailer', status: 'active' }],
        _meta: { limit: 100, offset: 0, count: 1 },
      }),
    );

    const provider = createAdmitadProvider({ settings: settings(), credentials });
    const report = await provider.describeAccount!();

    expect(report.adSpaces).toHaveLength(1);
    expect(report.adSpaces[0]).toMatchObject({
      id: '4',
      label: 'HugFab',
      status: 'active',
    });
    // The whole object survives, so a first live run is evidence, not a guess.
    expect(report.adSpaces[0]?.raw.validation_passed).toBe(true);
    expect(report.programmes[0]).toMatchObject({ id: '91', label: 'A Retailer' });
    expect(report.problems).toEqual([]);
  });

  it('reports each section independently, so one failure does not hide the other', async () => {
    mockFetch(
      jsonResponse({ results: [{ id: 4, name: 'HugFab', status: 'active' }] }),
      // 403 is what an account without the granted scope, or one that is not
      // active, actually returns — the case this whole command exists for.
      jsonResponse({ error: 'forbidden' }, 403),
    );

    const provider = createAdmitadProvider({ settings: settings(), credentials });
    const report = await provider.describeAccount!();

    expect(report.adSpaces).toHaveLength(1);
    expect(report.programmes).toEqual([]);
    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]).toContain('programmes');
    expect(report.problems[0]).toContain('403');
  });

  it('does not throw when the objects are not shaped as expected', async () => {
    mockFetch(
      jsonResponse({ results: [{ unexpected: true }, null, 'nonsense'] }),
      jsonResponse({ results: [] }),
    );

    const provider = createAdmitadProvider({ settings: settings(), credentials });
    const report = await provider.describeAccount!();

    expect(report.adSpaces).toHaveLength(3);
    expect(report.adSpaces[0]).toMatchObject({ id: '(no id)', label: '(unnamed)' });
    expect(report.adSpaces[0]?.raw).toEqual({ unexpected: true });
    // `null` and a bare string are objects to nobody, and still must not throw.
    expect(report.adSpaces[1]?.raw).toEqual({});
    expect(report.adSpaces[2]?.raw).toEqual({});
    // Three unreadable rows are still three rows, so the unscoped-list warning
    // fires. That is correct: nothing here was retrieved badly enough to be a
    // retrieval failure.
    expect(report.problems.join(' ')).not.toContain('ad spaces:');
    expect(report.problems.join(' ')).not.toContain('programmes:');
  });

  it('flags an unscoped programme list when several ad spaces exist', async () => {
    mockFetch(
      jsonResponse({
        results: [
          { id: 1, name: 'One', status: 'active' },
          { id: 2, name: 'Two', status: 'active' },
        ],
      }),
      jsonResponse({ results: [] }),
    );

    const provider = createAdmitadProvider({ settings: settings(), credentials });
    const report = await provider.describeAccount!();

    expect(report.problems.join(' ')).toContain('ADMITAD_WEBSITE_ID');
  });

  it('never puts a credential in the error it raises for a rejected token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ error: 'invalid_client' }, 401))),
    );

    const provider = createAdmitadProvider({ settings: settings(), credentials });
    const report = await provider.describeAccount!();

    const text = report.problems.join(' ');
    expect(text).toContain('401');
    expect(text).not.toContain('secret');
  });
});
