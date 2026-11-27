// managed by glass-factory kit v1.4.0 (38d025b), do not edit; change factory/evidence.config.sh or factory/evidence/tests/
// Seed reset for the factory sandbox (PostgreSQL). No dependencies.
//
//   GET  /health  200 when up
//   POST /reset   runs SEED_FILE (default /seed/seed.sql) with psql, ON_ERROR_STOP; 200 or 500 with the error
//
// It only touches a sandbox database: DATABASE_URL must point at a compose service (a host name
// without dots, no localhost, no IP) and a database whose name ends in "_factory". Anything else is
// refused on every request, so a wrong URL can never reach a real database. No query string either:
// psql would take a host or service from it.
import http from 'node:http';
import { execFile } from 'node:child_process';

const PORT = Number(process.env.PORT || 8090);
const DATABASE_URL = process.env.DATABASE_URL || '';
const SEED_FILE = process.env.SEED_FILE || '/seed/seed.sql';

export function sandboxTarget(databaseUrl) {
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    return { ok: false, reason: 'DATABASE_URL is not set or not a URL' };
  }
  const host = url.hostname;
  const db = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!/^postgres(ql)?:$/.test(url.protocol)) return { ok: false, reason: `not a PostgreSQL URL (${url.protocol})` };
  // psql reads connection options from the query string (?host=... would bypass the host check)
  if (url.search || url.hash) return { ok: false, reason: 'DATABASE_URL must not carry a query string' };
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(host) || host === 'localhost') {
    return { ok: false, reason: `host "${host}" is not a compose service name` };
  }
  if (!/^[a-z0-9_]+_factory$/i.test(db)) return { ok: false, reason: `database "${db}" does not end in "_factory"` };
  return { ok: true, host, db };
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function reset() {
  return new Promise((resolve, reject) => {
    const target = sandboxTarget(DATABASE_URL);
    if (!target.ok) return reject(new Error(`refusing to reset: ${target.reason}`));
    execFile('psql', [DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-f', SEED_FILE], (err, _out, stderr) =>
      err ? reject(new Error((stderr || err.message).trim())) : resolve(target)
    );
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  http
    .createServer(async (req, res) => {
      const { pathname } = new URL(req.url, 'http://seed-reset');
      if (req.method === 'GET' && pathname === '/health') return send(res, 200, { ok: true });
      if (req.method === 'POST' && pathname === '/reset') {
        try {
          const target = await reset();
          return send(res, 200, { reset: true, database: target.db });
        } catch (err) {
          return send(res, 500, { error: err.message });
        }
      }
      return send(res, 404, { error: `no ${req.method} ${pathname}` });
    })
    .listen(PORT, () => console.log(`seed-reset on :${PORT}, seed ${SEED_FILE}`));
}
