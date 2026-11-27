// Mock Ollama for the factory sandbox. No dependencies. Contract: samples/ (from the Ollama API docs, POST /api/chat with stream=false,
// which is what ollama-ai-provider-v2 sends for generateText in apps/worker/lib/autoTagLink.ts).
//
//   GET  /health          200 when up
//   GET  /api/tags        the one fake model
//   POST /api/chat        fixed tag answer (failure triggers below), recorded
//   GET  /_mock/events    what the app sent, JSON
//   POST /_mock/reset     forget events (the database is reset by the kit's seed-reset service)
//   GET  /                inspector page (events as a table)
//
// Failure triggers (the last user message decides):
//   contains "factory-fail-once"  500 on the first call, normal answer afterwards
//   contains "factory-bad-json"   answer that is not a JSON array of tags
//   contains "factory-timeout"    no answer for 120 s
import http from 'node:http';

const PORT = 11434;
const MODEL = process.env.OLLAMA_MODEL || 'factory-mock';

let events = [];
const failedOnce = new Set();

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'content-type': type });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : null);
      } catch {
        resolve(raw);
      }
    });
  });
}

function chatAnswer(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const last = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const text = typeof last === 'string' ? last : JSON.stringify(last);

  if (text.includes('factory-fail-once') && !failedOnce.has(text)) {
    failedOnce.add(text);
    return { status: 500, body: { error: 'model runner has unexpectedly stopped' } };
  }
  if (text.includes('factory-timeout')) return { status: 0 };
  const content = text.includes('factory-bad-json') ? 'Sure! Here are some tags: books, reading' : '["factory", "bookmark"]';

  return {
    status: 200,
    body: {
      model: body?.model || MODEL,
      created_at: new Date().toISOString(),
      message: { role: 'assistant', content },
      done_reason: 'stop',
      done: true,
      total_duration: 1000000,
      load_duration: 100000,
      prompt_eval_count: 10,
      prompt_eval_duration: 100000,
      eval_count: 5,
      eval_duration: 100000,
    },
  };
}

function inspectorPage() {
  const rows = events
    .map(
      (e, i) =>
        `<tr><td>${i + 1}</td><td>${e.at}</td><td>${e.method}</td><td>${e.path}</td><td><code>${String(
          JSON.stringify(e.body) ?? ''
        )
          .slice(0, 300)
          .replace(/</g, '&lt;')}</code></td></tr>`
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Mock Ollama</title>
<style>body{font:16px system-ui,sans-serif;margin:24px;background:#111;color:#eee}table{border-collapse:collapse;width:100%}
td,th{border:1px solid #444;padding:6px 10px;text-align:left}th{background:#222}code{font-size:13px}</style></head>
<body><h1>Mock Ollama (factory sandbox)</h1><p id="count">${events.length} request(s) from the app</p>
<table><thead><tr><th>#</th><th>Time</th><th>Method</th><th>Path</th><th>Body</th></tr></thead><tbody>${
    rows || '<tr><td colspan="5">No requests from the app.</td></tr>'
  }</tbody></table></body></html>`;
}

http
  .createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://mock');

    if (req.method === 'GET' && pathname === '/health') return send(res, 200, { ok: true });
    if (req.method === 'GET' && pathname === '/_mock/events') return send(res, 200, { events });
    if (req.method === 'POST' && pathname === '/_mock/reset') {
      events = [];
      failedOnce.clear();
      return send(res, 200, { reset: true });
    }
    if (req.method === 'GET' && pathname === '/') return send(res, 200, inspectorPage(), 'text/html; charset=utf-8');

    const body = req.method === 'POST' ? await readBody(req) : null;
    events.push({ at: new Date().toISOString(), method: req.method, path: pathname, body });

    if (req.method === 'GET' && pathname === '/api/tags') {
      return send(res, 200, {
        models: [{ name: MODEL, model: MODEL, modified_at: '2026-11-01T00:00:00Z', size: 1, digest: 'factory' }],
      });
    }
    if (req.method === 'POST' && pathname === '/api/chat') {
      const answer = chatAnswer(body);
      if (answer.status === 0) return setTimeout(() => send(res, 504, { error: 'timeout' }), 120_000);
      return send(res, answer.status, answer.body);
    }
    return send(res, 404, { error: `mock has no ${req.method} ${pathname}` });
  })
  .listen(PORT, () => console.log(`mock ollama on :${PORT}`));
