// managed by glass-factory kit v1.4.0 (52566f1), do not edit; change factory/evidence.config.sh or factory/evidence/tests/
// Seed reset for the factory sandbox (PostgreSQL). No dependencies.
//
//   GET  /health  200 when up
//   POST /reset   runs SEED_FILE (default /seed/seed.sql) as one statement in one transaction; 200 or 500
//
// It only ever touches a sandbox database. On every request:
// - DATABASE_URL must be plain postgresql://user[:password]@service[:port]/name_factory: one "@", a
//   lowercase host that starts with a letter and has no dots (a compose service name, not localhost),
//   a database name ending in "_factory", nothing else (no query string, no percent-encoding, no
//   second host).
// - The host must resolve to an address on one of this container's own networks (the sandbox).
// - psql gets the checked parts (host as that address), no URL, no inherited PG* environment and no
//   .psqlrc (-X). The seed goes in with -c, so the server runs it as SQL only: psql backslash commands
//   such as \connect never run. A seed that starts with a backslash is refused.
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs/promises';
import dns from 'node:dns/promises';
import { execFile } from 'node:child_process';

const PORT = Number(process.env.PORT || 8090);
const DATABASE_URL = process.env.DATABASE_URL || '';
const SEED_FILE = process.env.SEED_FILE || '/seed/seed.sql';

const URL_RE =
  /^postgres(?:ql)?:\/\/([A-Za-z0-9_.-]+)(?::([^@/?#,%\s]*))?@([a-z][a-z0-9_-]*)(?::([0-9]{1,5}))?\/([a-z0-9_]+_factory)$/;

export function sandboxTarget(databaseUrl) {
  const m = URL_RE.exec(databaseUrl);
  if (!m) {
    return {
      ok: false,
      reason: 'DATABASE_URL must be postgresql://user[:password]@service[:port]/<name>_factory (compose service, nothing else)',
    };
  }
  const [, user, password = '', host, port = '5432', db] = m;
  if (host === 'localhost') return { ok: false, reason: 'host "localhost" is not a compose service' };
  return { ok: true, user, password, host, port, db };
}

const toInt = (ip) => ip.split('.').reduce((n, part) => n * 256 + Number(part), 0);

// True when the address lies in the subnet of one of this container's IPv4 interfaces.
export function onOwnNetwork(address, interfaces = os.networkInterfaces()) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) return false;
  for (const list of Object.values(interfaces)) {
    for (const nic of list || []) {
      if (nic.family !== 'IPv4' && nic.family !== 4) continue;
      if (nic.internal) continue;
      const mask = toInt(nic.netmask);
      if (((toInt(address) & mask) >>> 0) === ((toInt(nic.address) & mask) >>> 0)) return true;
    }
  }
  return false;
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function reset() {
  const target = sandboxTarget(DATABASE_URL);
  if (!target.ok) throw new Error(`refusing to reset: ${target.reason}`);
  const { address } = await dns.lookup(target.host, { family: 4 });
  if (!onOwnNetwork(address)) {
    throw new Error(`refusing to reset: ${target.host} (${address}) is not on this container's sandbox network`);
  }
  const seed = await fs.readFile(SEED_FILE, 'utf-8');
  if (/^\s*\\/.test(seed)) throw new Error('refusing to reset: seed.sql must be plain SQL (it starts with a psql backslash command)');

  const args = ['-X', '-q', '-1', '-v', 'ON_ERROR_STOP=1', '-h', address, '-p', target.port, '-U', target.user, '-d', target.db, '-c', seed];
  const env = {
    PATH: process.env.PATH,
    PGPASSWORD: target.password,
    PGCONNECT_TIMEOUT: '5',
    PGOPTIONS: '-c lock_timeout=15s -c statement_timeout=60s',
  };
  await new Promise((resolve, reject) =>
    execFile('psql', args, { env, timeout: 90_000 }, (err, _out, stderr) =>
      err ? reject(new Error((stderr || err.message).trim())) : resolve()
    )
  );
  return target;
}

// One reset at a time: a second request waits for the first.
let queue = Promise.resolve();
const serialReset = () => {
  const run = queue.then(reset, reset);
  queue = run.catch(() => {});
  return run;
};

if (process.argv[1] === new URL(import.meta.url).pathname) {
  http
    .createServer(async (req, res) => {
      const { pathname } = new URL(req.url, 'http://seed-reset');
      if (req.method === 'GET' && pathname === '/health') return send(res, 200, { ok: true });
      if (req.method === 'POST' && pathname === '/reset') {
        try {
          const target = await serialReset();
          return send(res, 200, { reset: true, database: target.db });
        } catch (err) {
          return send(res, 500, { error: err.message });
        }
      }
      return send(res, 404, { error: `no ${req.method} ${pathname}` });
    })
    .listen(PORT, () => console.log(`seed-reset on :${PORT}, seed ${SEED_FILE}`));
}
