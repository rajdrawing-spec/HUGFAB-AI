import { describe, expect, it } from 'vitest';

import { absoluteUrl, canonicalPath, normaliseOrigin, SITE_URL } from './site-url';

describe('normaliseOrigin', () => {
  it('strips a trailing slash', () => {
    // The bug this prevents: `${origin}/search` against "https://hugfab.com/"
    // yields "https://hugfab.com//search", which is a different URL to a
    // crawler and a 404 on some hosts.
    expect(normaliseOrigin('https://hugfab.com/')).toBe('https://hugfab.com');
    expect(normaliseOrigin('https://hugfab.com')).toBe('https://hugfab.com');
    expect(normaliseOrigin('https://hugfab.com///')).toBe('https://hugfab.com');
  });

  it('keeps a base path, without its trailing slash', () => {
    expect(normaliseOrigin('https://example.test/shop/')).toBe(
      'https://example.test/shop',
    );
  });

  it('keeps an explicit port', () => {
    expect(normaliseOrigin('http://localhost:3000/')).toBe('http://localhost:3000');
  });

  it('does not invent a scheme it was not given', () => {
    // env.schema.ts rejects a malformed URL before this is reached; trimming
    // is still the right answer rather than throwing at import time.
    expect(normaliseOrigin('hugfab.com/')).toBe('hugfab.com');
  });
});

describe('absoluteUrl', () => {
  it('joins without doubling the separator', () => {
    expect(absoluteUrl('/search')).toBe(`${SITE_URL}/search`);
    expect(absoluteUrl('search')).toBe(`${SITE_URL}/search`);
  });

  it('returns the bare origin for the root', () => {
    expect(absoluteUrl('/')).toBe(SITE_URL);
    expect(absoluteUrl('')).toBe(SITE_URL);
  });

  it('never produces a double slash', () => {
    for (const path of ['/', '', 'a', '/a', '/a/b']) {
      expect(absoluteUrl(path).replace(/^https?:\/\//, '')).not.toContain('//');
    }
  });
});

describe('canonicalPath', () => {
  it('returns a path for Next to resolve against metadataBase', () => {
    // A path rather than an absolute URL, so the canonical link and the
    // sitemap cannot disagree about the host: both derive from SITE_URL once.
    expect(canonicalPath('/products/x')).toBe('/products/x');
    expect(canonicalPath('products/x')).toBe('/products/x');
    expect(canonicalPath('')).toBe('/');
  });
});

describe('the configured origin', () => {
  it('carries no trailing slash', () => {
    expect(SITE_URL.endsWith('/')).toBe(false);
  });
});
