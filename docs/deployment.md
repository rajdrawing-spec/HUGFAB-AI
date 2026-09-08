# Deployment

> Status: **CI is live and blocking. The deploy workflow is written and dormant.**
>
> `.github/workflows/deploy.yml` exists but is gated on the repository variable
> `DEPLOY_ENABLED`, so merging it changes nothing. It stays dormant until the
> hosting decision is made and the secrets below are set.

## CI — built and enforcing

`.github/workflows/ci.yml` runs on every pull request and every push to `main`
and `develop`:

```
npm ci → lint → format:check → typecheck → test → build
```

The job holds **no secrets and needs none**. A build that only succeeds with
production credentials is not reproducible, and credentials baked into an
artefact are credentials that leak. Environment validation is therefore deferred
to server start (`src/lib/env.server.ts`), not build time.

## The blocking decision

Next.js server rendering needs a long-lived Node process.

- **Hostinger shared hosting cannot run one.** No SSH, no persistent process, no
  `pm2`. There is no configuration that makes this work.
- **Hostinger VPS or Cloud can.** Everything below assumes this.

If only shared hosting is available, the honest options are to upgrade, or to run
the app on a host that supports a Node process and keep Hostinger for DNS and the
domain. Nothing in the codebase depends on Vercel behaviour, so either is a
configuration change rather than a rewrite.

## Topology

```
GitHub (main)
   │  push
   ▼
CI: npm ci → lint → format → typecheck → test → build      (blocking)
   │  on success only  (workflow_run, same commit)
   ▼
Deploy: build → rsync over SSH → symlink swap → pm2 reload → health check
   │  health check fails ──► automatic rollback to previous release
   ▼
Hostinger VPS
   ├── Nginx — TLS, reverse proxy, static cache   (deploy/nginx.conf.example)
   ├── Node — Next.js standalone (PM2, 127.0.0.1:3000)  (ecosystem.config.cjs)
   └── Node — ingestion worker (PM2, cron)        (Phase 1)
   ▼
Cloudflare — DNS, CDN, image resizing
```

## Release layout

```
/var/www/hugfab/
  releases/20260908T161200Z-418e5fa/   one directory per deploy
  current -> releases/…                symlink; swapping it IS the release
  shared/.env.production               0600, never in git, never rsynced
  shared/previous_release              written before each swap, for rollback
```

`current` being a symlink is what makes rollback a symlink swap and a reload
rather than a rebuild.

## What the deploy job does

1. Resolves the commit — the CI run's `head_sha`, or the `ref` input on a manual
   dispatch.
2. Builds it with `NEXT_PUBLIC_BUILD_SHA` set to that commit.
3. Assembles the release: `.next/standalone`, plus `.next/static` and `public/`,
   which `output: 'standalone'` deliberately leaves out, plus
   `ecosystem.config.cjs`.
4. rsyncs into a new timestamped release directory.
5. Symlinks `shared/.env.production` into the release — secrets live only on the
   server, never in a build artefact.
6. Records the outgoing release, then `ln -sfn` the new one. That is atomic.
7. `pm2 reload` — zero downtime.
8. **Polls `/api/health` until it reports both `status: ok` and the SHA just
   deployed.** A 200 alone is not enough: it would also be returned by the old
   process still serving after a failed reload.
9. On health-check failure, symlinks back to the recorded previous release and
   reloads.
10. Prunes to the last five releases.

The SHA comparison in step 8 is the reason `next.config.ts` prefers
`NEXT_PUBLIC_BUILD_SHA` over `GITHUB_SHA`, and the reason `src/lib/env.server.ts`
references that variable by its literal name: Next inlines
`process.env.NEXT_PUBLIC_*` textually at build time, and a whole-object read of
`process.env` is not rewritten. Get either wrong and the health check can never
match, so every deploy rolls itself back.

## What you must configure before enabling it

### Repository variables (Settings → Secrets and variables → Actions → Variables)

| Variable | Value |
|---|---|
| `DEPLOY_ENABLED` | `true` — the master switch. Until this is set, the job never runs. |
| `PRODUCTION_URL` | e.g. `https://hugfab.com`, no trailing slash |

### Environment secrets (Settings → Environments → `production`)

Create a **GitHub Environment** named `production` and add required reviewers.
Put these there rather than in repository secrets, so a pull request from a fork
can never reach them.

| Secret | Value |
|---|---|
| `SSH_HOST` | VPS hostname or IP |
| `SSH_USER` | deploy user (not root) |
| `SSH_PORT` | optional, defaults to 22 |
| `SSH_PRIVATE_KEY` | private key for that user, whole PEM including header and footer |
| `SSH_KNOWN_HOSTS` | output of `ssh-keyscan -H <host>`. Optional but recommended — without it the job falls back to trust-on-first-use, which a redirected DNS record can abuse. |

### Server prerequisites

See `deploy/README.md` for the one-time setup commands. In summary: Node 22, PM2
with `pm2 startup`, Nginx from `deploy/nginx.conf.example`, TLS via Certbot or a
Cloudflare origin certificate, `/var/www/hugfab` owned by the deploy user, and
`shared/.env.production` at mode 0600 filled in from `.env.example`.

The firewall should permit 22, 80 and 443 only. The app binds `127.0.0.1`
(`ecosystem.config.cjs`), so Nginx is the only thing that can reach it even if
the firewall is wrong.

## Rollback

Automatic on a failed health check. Manual:

```bash
ssh deploy@<host>
ls -1dt /var/www/hugfab/releases/*/     # newest first
ln -sfn /var/www/hugfab/releases/<previous>/ /var/www/hugfab/current
cd /var/www/hugfab/current && pm2 reload ecosystem.config.cjs --update-env
curl -s https://<domain>/api/health | jq
```

Or re-run the deploy workflow with `workflow_dispatch` and the known-good SHA as
the `ref` input.

## Operational checks

- `GET /api/health` → `{ status, sha, environment, uptimeSeconds, dependencies }`.
  Returns 503 when the database is unreachable, so it is safe as an Nginx or
  uptime-monitor probe. Nginx is configured not to cache it.
- `pm2 logs hugfab` — structured JSON, one object per line in production.
- `pm2 describe hugfab` — restart count. Repeated restarts mean a broken
  release, not flakiness; `max_restarts: 4` stops it thrashing.
- Sentry captures server and browser errors once a DSN is set; without one it is
  not merely disabled but never downloaded.

## Scaling past one process

`ecosystem.config.cjs` runs a single instance on purpose. Raising `instances`
requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: the rate
limiter falls back to an in-memory window per process, so N workers means N times
the intended budget. `src/lib/ratelimit.ts` switches to the distributed limiter
automatically once those variables exist.
