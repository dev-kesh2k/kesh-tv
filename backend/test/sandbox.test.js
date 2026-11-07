import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { proxyStream, safeType, SANDBOX_HEADERS } from '../src/stream.js';
import { sign } from '../src/net.js';

test('tipos que o navegador executaria viram binário (SVG continua imagem, mas com sandbox)', () => {
  assert.equal(safeType('text/html; charset=utf-8'), 'application/octet-stream');
  assert.equal(safeType('application/javascript'), 'application/octet-stream');
  assert.equal(safeType('application/xhtml+xml'), 'application/octet-stream');
  assert.equal(safeType('video/mp2t'), 'video/mp2t');
  assert.equal(safeType('application/vnd.apple.mpegurl'), 'application/vnd.apple.mpegurl');
  assert.equal(safeType('image/svg+xml'), 'image/svg+xml');
  assert.equal(safeType(''), 'application/octet-stream');
});

test('respostas do proxy saem com CSP sandbox e nosniff', async () => {
  const app = express();
  app.get('/stream', (req, res, next) => proxyStream(req, res).catch(next));
  app.use((err, _req, res, _next) => res.status(err.status || 500).end());
  const srv = app.listen(0);
  try {
    // link para endereço bloqueado: mesmo o erro sai com os cabeçalhos
    const r = await fetch(`http://127.0.0.1:${srv.address().port}/stream?${sign('http://127.0.0.1/x')}`);
    assert.equal(r.headers.get('content-security-policy'), SANDBOX_HEADERS['Content-Security-Policy']);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  } finally {
    srv.close();
  }
});
