# Deployment

> Status: **CI is live and blocking. Deploy is not built.**
>
> The deploy half of work item 0.9 is blocked on one decision: the Hostinger
> plan. Everything below the CI section is the intended runbook, written so that
> it can be executed the moment that decision lands — not a description of
> something that exists.

## CI — built and enforcing

`.github/workflows/ci.yml` runs on every pull request and on every push to
`main` and `develop`:

```
npm ci → lint → format:check → typecheck → test → build
```

The job holds **no secrets and needs none**. A build that only succeeds with
production credentials is not reproducible, and credentials baked into an
artefact are credentials that leak. Environment validation is therefore deferred
to server start (see `src/lib/env.server.ts`), not build time.

A red run blocks the merge, and — once the deploy job exists — blocks the deploy
(PRD §62).

`NEXT_PUBLIC_BUILD_SHA` is stamped from `github.sha` so `/api/health` can answer
"which commit is actually live?" without SSH.

## The blocking decision

Next.js server rendering needs a long-lived Node process.

- **Hostinger shared hosting cannot run one.** No SSH, no persistent process, no
  `pm2`. There is no configuration that makes this work.
- **Hostinger VPS or Cloud can.** This is what the runbook below assumes.

If only shared hosting is available, the two honest options are to upgrade to a
VPS, or to run the app on a host that supports a Node process and keep Hostinger
for DNS and the domain. Nothing in the codebase depends on Vercel behaviour, so
either is a configuration change rather than a rewrite.

## Intended topology

```
GitHub (main)
   │  push
   ▼
GitHub Actions: npm ci → lint → typecheck → test → build   (blocking)
   │  on success only
   ▼
Hostinger VPS
   ├── Nginx — TLS termination, reverse proxy, static cache
   ├── Node — Next.js standalone server (PM2, port 3000)
   └── Node — ingestion worker (PM2, cron)
   ▼
Cloudflare — DNS, CDN, image resizing
```

`next.config.ts` already sets `output: 'standalone'` and a custom image loader,
so the build artefact is a self-contained server directory with no Vercel
dependency.

## Intended release process

Releases are directories, and `current` is a symlink. That is what makes
rollback a symlink swap rather than a rebuild.

```
/var/www/hugfab/
  releases/
    2026-09-08T10-14-22-a1b2c3d/
    2026-09-08T09-02-11-9f8e7d6/
  current -> releases/2026-09-08T10-14-22-a1b2c3d
  shared/
    .env.production          # 0600, root-owned, never in git
```

1. CI builds `.next/standalone`, plus `.next/static` and `public/`.
2. rsync over SSH into a new timestamped release directory.
3. Symlink `shared/.env.production` into the release.
4. `ln -sfn` the new release to `current` — atomic.
5. `pm2 reload hugfab` — zero downtime; PM2 starts the new process, waits for it
   to be ready, then retires the old one.
6. Poll `/api/health` and check the returned `sha` matches the deployed commit.
   A non-200, or a mismatched SHA, fails the deploy.
7. Prune to the last five releases.

**Rollback** is step 4 and 5 against the previous release directory. No rebuild,
no network, seconds rather than minutes.

## Required before the deploy job can be written

| # | Needed | For |
|---|---|---|
| 1 | Confirmation of a VPS or Cloud plan | Everything below CI |
| 2 | `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_PORT` as GitHub secrets | The rsync step |
| 3 | Domain and DNS control | TLS and the Cloudflare layer |
| 4 | Supabase project URL and keys | `shared/.env.production` |

Deploy secrets belong in a GitHub **environment** with required reviewers, not
in repository secrets — so a pull request from a fork cannot reach them.

## Server prerequisites (VPS)

- Node 22 LTS, PM2 installed globally, `pm2 startup` configured.
- Nginx proxying `:443` → `127.0.0.1:3000`, with `proxy_set_header X-Real-IP`
  and `X-Forwarded-For` (the rate limiter reads these to identify callers) and
  `Host` preserved.
- TLS via Certbot, or Cloudflare origin certificates if Cloudflare is proxying.
- `/var/www/hugfab` owned by the deploy user; `shared/.env.production` mode 0600.
- A firewall permitting 22, 80, 443 only.

## Operational checks

- `GET /api/health` returns `{ status, sha, environment, uptimeSeconds, dependencies }`.
  It returns 503 when the database is unreachable, so it is safe as an Nginx or
  uptime-monitor probe.
- `pm2 logs hugfab` — structured JSON, one object per line in production.
- Sentry captures server and browser errors once a DSN is set; without one it is
  not merely disabled but never downloaded.
