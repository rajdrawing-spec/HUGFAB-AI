/**
 * Production startup file.
 *
 * This exists for hosts that start an application by running a single entry
 * file from a configured Application Root — Hostinger's Node.js app manager
 * (Phusion Passenger) works this way, as do most cPanel-style Node hosts.
 * Point "Application Startup File" at this file.
 *
 * Everything here is anchored to `__dirname`, never to `process.cwd()`. A host
 * may start the process from any working directory, and if Next is asked to
 * find `.next` relative to the wrong one it reports a missing production build
 * on a build that is present and correct. That is the failure this file exists
 * to make impossible.
 *
 * It runs the ordinary Next production server, the same one `next start` runs,
 * against the `.next` build in this directory. `output: 'standalone'` is not
 * used — see the note in next.config.ts for why.
 *
 * CommonJS on purpose: package.json declares no "type", so `.js` is CommonJS
 * here, and Passenger loads the startup file with `require()`.
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { createServer } = require('node:http');

const APP_ROOT = __dirname;

/**
 * Next resolves some paths against the current working directory regardless of
 * the `dir` option, so align the two rather than relying on how we were called.
 */
process.chdir(APP_ROOT);

/**
 * A host may hand us a TCP port ("3000") or a Unix socket path
 * ("/tmp/passenger.sock"). `server.listen('3000')` treats a numeric *string* as
 * a pipe name and silently fails to bind a port, so the distinction has to be
 * made explicitly.
 */
function resolveListenTarget() {
  const raw = process.env.PORT;
  if (!raw) return 3000;
  return /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : raw;
}

/**
 * Which interface to bind.
 *
 * `HOSTNAME` is not a safe default: on shared hosting it is very often the
 * machine's name ("srv1234"), which is not a local address, and binding it
 * fails with EADDRNOTAVAIL — the app never starts and the log blames DNS.
 * Only an address we can actually bind is honoured; anything else falls back
 * to every interface.
 */
function resolveHost() {
  const candidate = process.env.HOST || process.env.HOSTNAME;
  if (!candidate) return '0.0.0.0';

  const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(candidate);
  const isIpv6 = candidate.includes(':');
  const isLoopbackName = candidate === 'localhost';

  if (isIpv4 || isIpv6 || isLoopbackName) return candidate;

  console.warn(
    `[hugfab] ignoring HOSTNAME="${candidate}" — not a bindable address; using 0.0.0.0`,
  );
  return '0.0.0.0';
}

function fail(message) {
  console.error(`[hugfab] ${message}`);
  process.exit(1);
}

const buildDir = path.join(APP_ROOT, '.next');
if (!fs.existsSync(path.join(buildDir, 'BUILD_ID'))) {
  fail(
    `No production build found at ${buildDir}.\n` +
      `Run "npm ci && npm run build" in ${APP_ROOT} before starting.\n` +
      `(.next is git-ignored, so it is never present from a checkout alone.)`,
  );
}

let next;
try {
  // Resolved from the app root, so a stray global install cannot be picked up.
  next = require(require.resolve('next', { paths: [APP_ROOT] }));
} catch {
  fail(
    `Could not load "next" from ${APP_ROOT}.\n` +
      `Run "npm ci" there — dependencies must be installed in the application root.`,
  );
}

const app = next({ dev: false, dir: APP_ROOT });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const target = resolveListenTarget();
    const server = createServer((req, res) => {
      handle(req, res).catch((error) => {
        console.error('[hugfab] request failed', error);
        res.statusCode = 500;
        res.end('Internal Server Error');
      });
    });

    server.on('error', (error) => fail(`Server failed to start: ${error.message}`));

    // A socket path takes no hostname.
    if (typeof target === 'string') {
      server.listen(target, () => {
        console.log(`[hugfab] ready on socket ${target} (root ${APP_ROOT})`);
      });
    } else {
      const host = resolveHost();
      server.listen(target, host, () => {
        console.log(`[hugfab] ready on http://${host}:${target} (root ${APP_ROOT})`);
      });
    }

    // Passenger and most process managers stop an app with SIGTERM. Closing the
    // server first lets in-flight requests finish instead of being cut off.
    for (const signal of ['SIGTERM', 'SIGINT']) {
      process.on(signal, () => {
        console.log(`[hugfab] ${signal} received, shutting down`);
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 10_000).unref();
      });
    }
  })
  .catch((error) => {
    console.error('[hugfab] failed to start', error);
    process.exit(1);
  });
