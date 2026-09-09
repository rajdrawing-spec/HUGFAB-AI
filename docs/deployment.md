# Deployment

> Status: **CI is live and blocking. The deploy workflow is written and dormant.**
>
> `.github/workflows/deploy.yml` exists but is gated on the repository variable
> `DEPLOY_ENABLED`, so merging it changes nothing. It stays dormant until the
> hosting decision is made and the secrets below are set.
>
> **There has never been a deployment of this repository.** The first commit was
> a README and a `.gitignore`; no startup file, `.htaccess` or host
> configuration has ever been committed. Anything describing a "previous
> working structure" is describing something outside this repository.

## The entry point

One file, one start path, everywhere:

```
index.js        →  the production server. Used by npm start, by PM2, and as a
                   Passenger-style host's Application Startup File.
```

`npm start` is `node index.js`. `ecosystem.config.cjs` runs `index.js`. A host
configured with an Application Root and a Startup File points at `index.js`.
There is deliberately no second way to start the application.

Everything in it is anchored to `__dirname`, never `process.cwd()`. A host may
launch the process from any directory; anchoring to the app root is what stops
Next reporting "no production build found" on a build that is present.

It also handles two things the generic servers get wrong on shared hosting:

- **`PORT` may be a Unix socket path**, not a number. `server.listen('3000')`
  treats a numeric *string* as a pipe name and never binds the port, so the two
  cases are distinguished explicitly.
- **`HOSTNAME` is often the machine's name** ("srv1234"), which is not a
  bindable address. Binding it fails with `EADDRNOTAVAIL` and the app never
  starts. Only an address that can actually be bound is honoured; anything else
  falls back to `0.0.0.0` with a warning.

## Why `output: 'standalone'` is not used

It was set, and it was wrong for this host. Three reasons, each verified:

1. Next refuses to run the normal production server when it is set — *"next
   start does not work with output: standalone"* — so `npm start` and any root
   startup file stop working. A host that starts one entry file has nothing
   valid to point at.
2. The bundle it emits is **incomplete**. `.next/static` and `public/` are left
   out and must be copied in by a separate step. Point a Startup File at
   `.next/standalone/server.js` without that copy and the site serves HTML
   while every stylesheet and script 404s — a failure that looks like a CSS bug.
3. It bakes **absolute build-machine paths** into the runtime config blob
   (`loaderFile`, `outputFileTracingRoot`, `turbopack.root`), so the artefact
   carries the layout of whatever machine built it.

Standalone earns its keep in a container, where the image is the unit of
deployment. Here the host installs dependencies at the application root and runs
one entry file.

## Hostinger — Node.js application (hPanel)

For the Passenger-based Node.js app manager, which is what "Application Root"
and "Application Startup File" mean.

| Setting | Value |
|---|---|
| Application Root | the directory holding `package.json` and `index.js` |
| Application Startup File | `index.js` |
| Node version | 22 (20.11+ works; CI runs 22) |
| Build command | `npm ci && npm run build` — run in the Application Root |
| Start command | none needed; the host runs the Startup File |

`.next` is git-ignored, so a checkout alone never contains a build. The build
must run on the host after install, or be uploaded alongside the source.

### The one trap that silently breaks authentication

`NEXT_PUBLIC_*` variables are **inlined into the browser bundle when
`npm run build` runs**. Setting them afterwards does not reach the browser: the
server picks them up, the client does not, and login fails with no obvious
cause.

Verified: an app built without them and given them at runtime reports
`database: ok` from `/api/health` while the runtime value appears nowhere in
`.next/static`.

**Set every `NEXT_PUBLIC_*` variable before building.** Changing one later means
rebuilding, not restarting.

### Environment variables

Either the host's environment-variable UI or a `.env.production` file in the
Application Root — Next loads it automatically at startup (verified). If you use
a file, it must be `chmod 600`: it holds the service-role key.

Required in production, or the process refuses to start:

```
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

That refusal is deliberate. `assertServerEnvironment()` prints the missing keys
and exits 1 rather than serving a half-working site.

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
3. Assembles the release: the `.next` build, `public/`, `index.js`,
   `package.json`, `package-lock.json`, `next.config.ts` and
   `ecosystem.config.cjs`. No standalone bundle and no asset-copying step that
   can be forgotten.
4. rsyncs into a new timestamped release directory.
5. Runs `npm ci --omit=dev` on the host, so nothing native is carried across
   from the runner, then symlinks `shared/.env.production` into the release —
   secrets live only on the server, never in a build artefact.
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
