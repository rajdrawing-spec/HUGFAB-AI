# deploy/

Server-side configuration for the Hostinger VPS. Nothing here runs in CI; these
are the files a human installs once on the box.

| File | Goes to | Notes |
|---|---|---|
| `nginx.conf.example` | `/etc/nginx/sites-available/hugfab` | Replace the domain. Sets no security headers — the app does that per-request in `src/middleware.ts`. |
| `../ecosystem.config.cjs` | stays in the release | PM2 reads it from `current/`. |

## Release layout on the server

```
/var/www/hugfab/
  releases/<timestamp>-<sha>/   one directory per deploy
  current -> releases/…         symlink; swapping it IS the release
  shared/.env.production        0600, root-owned, never in git, never rsynced
```

`current` being a symlink is what makes rollback a symlink swap and a reload
rather than a rebuild.

## First-time setup

Run once, before the first deploy. See `docs/deployment.md` for the full runbook.

```bash
sudo mkdir -p /var/www/hugfab/{releases,shared} /var/log/hugfab
sudo chown -R deploy:deploy /var/www/hugfab /var/log/hugfab

sudo -u deploy install -m 600 /dev/null /var/www/hugfab/shared/.env.production
sudo -u deploy vim /var/www/hugfab/shared/.env.production   # fill from .env.example

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
sudo npm install -g pm2
sudo -u deploy pm2 startup systemd -u deploy --hp /home/deploy
```
