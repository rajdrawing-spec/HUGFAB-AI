# The canonical domain

HugFab serves on **`https://hugfab.com`** — the apex, no `www`.

## Why the apex

`www.hugfab.com` resolves (a CNAME to `www.hugfab.com.cdn.hstgr.net`) but is not
registered as a hostname on the hosting account: no parked domain, no
subdomain. A hostname the host does not know about is a hostname the
certificate does not cover, which is why a browser reaching it gets
`ERR_CERT_COMMON_NAME_INVALID` rather than the site.

Apex is therefore the only host that works today. Making `www` canonical
instead would mean registering it, waiting for a certificate reissue, and
adding an apex→www redirect: three moving parts against zero.

## Where the canonical origin lives

One variable, `NEXT_PUBLIC_SITE_URL`, read in exactly one place —
`src/lib/site-url.ts` — which exports `SITE_URL`, `SITE_HOST`, `absoluteUrl()`
and `canonicalPath()`. Everything absolute derives from those:

| Consumer | File |
|---|---|
| `metadataBase`, Open Graph, Twitter card | `src/app/layout.tsx` |
| Per-page canonical links | each `page.tsx` |
| `sitemap.xml` | `src/app/sitemap.ts` |
| `robots.txt` (incl. `Sitemap:` and `Host:`) | `src/app/robots.ts` |
| Email-confirmation and OAuth redirect | `src/app/(auth)/auth-form.tsx` |
| Post-sign-in redirect base | `src/app/auth/callback/route.ts` |
| Click-out fallback | `src/app/api/affiliate/click/route.ts` |
| `www` → apex redirect | `src/middleware.ts` |

Nothing reads `clientEnv.NEXT_PUBLIC_SITE_URL` directly any more. One origin
means the site cannot advertise two hostnames for the same page — which is a
ranking problem when both work, and a broken sign-up when one of them has no
certificate.

## It is a build-time value

Next substitutes `process.env.NEXT_PUBLIC_*` into the browser bundle textually
at build time. Changing it in hPanel and restarting the app does **nothing** —
the old value is already compiled into the JavaScript the browser downloads.

**Every change to `NEXT_PUBLIC_SITE_URL` requires a rebuild, not a restart.**
This is not a detail: it is why a wrong value survives a restart and keeps
sending new users to a certificate warning.

## The www redirect

`src/middleware.ts` answers `www.hugfab.com` with a **308** to the same path on
the apex, preserving path, query and request method.

It is in the application rather than the host's redirect panel because it is
version-controlled, reviewable, testable before it ships, and leaves the
Node.js/Passenger configuration untouched.

**It cannot loop.** The only host that redirects is the exact string
`www.<canonical>`; the destination is `<canonical>`, which by construction is
not `www.<canonical>`. Every other host — the apex, a preview hostname,
localhost, a health check hitting the container directly — falls through
untouched. `src/middleware.test.ts` asserts each of those cases, the apex
no-redirect case explicitly labelled as the loop check.

### The one thing the redirect cannot fix

TLS is negotiated before HTTP. A browser reaching `www.hugfab.com` completes the
handshake *first*, and only then would it receive the 308. While `www` is not a
registered hostname on the account, the handshake fails and the redirect is
never sent.

So `www` still needs to exist on the host. The Hostinger API rejects creating
it (422 for a parked domain, a subdomain, and a redirect alike), so it has to be
added in hPanel: **Websites → hugfab.com → Domains**, add `www.hugfab.com`, and
let the certificate reissue. After that the middleware does the rest.

Until then, `www` shows a certificate warning. That costs little now that
nothing the site emits points at it.

## Supabase Auth must agree

Supabase will only redirect to an allow-listed URL, so the project needs:

- **Site URL** — `https://hugfab.com`
- **Redirect URLs** — `https://hugfab.com/**`, plus `http://localhost:3000/**`
  for local development

A mismatch does not error at build or start. It surfaces as a confirmation link
that refuses to sign the user in, which looks like a broken account rather than
a configuration problem.
