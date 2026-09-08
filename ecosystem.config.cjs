/**
 * PM2 process file for the Hostinger VPS (docs/deployment.md).
 *
 * `.cjs` because package.json has no "type": "module" and PM2 reads this with
 * require(). It lives in the repo so the process configuration is reviewed like
 * any other change, rather than being edited in place on the server.
 */

module.exports = {
  apps: [
    {
      name: 'hugfab',
      // Next's standalone output puts its server entrypoint at the release root.
      script: 'server.js',
      cwd: '/var/www/hugfab/current',

      /**
       * One instance by default, deliberately.
       *
       * Raising this (or switching to 'max') requires UPSTASH_REDIS_REST_URL and
       * UPSTASH_REDIS_REST_TOKEN to be set: the rate limiter falls back to an
       * in-memory window per process, so N workers means N times the intended
       * budget. src/lib/ratelimit.ts picks the distributed limiter automatically
       * once those variables exist.
       */
      instances: 1,
      exec_mode: 'cluster',

      env: {
        NODE_ENV: 'production',
        // Next's standalone server binds 0.0.0.0 by default; Nginx is the only
        // thing that should reach it, so bind loopback and keep it off the
        // public interface even if the firewall is misconfigured.
        HOSTNAME: '127.0.0.1',
        PORT: 3000,
      },

      // Everything else comes from shared/.env.production, symlinked into the
      // release by the deploy job. Secrets are never baked into a build.
      node_args: '--env-file=.env.production',

      // Zero-downtime reload: PM2 waits for the new process to signal ready
      // before retiring the old one.
      wait_ready: false,
      listen_timeout: 10000,
      kill_timeout: 5000,

      max_memory_restart: '512M',
      autorestart: true,
      // Four restarts in quick succession means the release is broken, not
      // flaky. Stop thrashing and let the health check fail the deploy.
      max_restarts: 4,
      min_uptime: '30s',

      merge_logs: true,
      time: false, // the app already emits ISO timestamps in its JSON logs
      out_file: '/var/log/hugfab/out.log',
      error_file: '/var/log/hugfab/error.log',
    },

    /**
     * The ingestion worker is added here in Phase 1, when the first affiliate
     * feed is approved and workers/ingestion actually has an entrypoint:
     *
     * {
     *   name: 'hugfab-ingestion',
     *   script: 'workers/ingestion/index.js',
     *   cwd: '/var/www/hugfab/current',
     *   instances: 1,
     *   exec_mode: 'fork',
     *   autorestart: false,
     *   cron_restart: '0 *\/6 * * *',
     * }
     *
     * It is omitted rather than stubbed: PM2 would restart-loop on a script
     * that does not exist.
     */
  ],
};
