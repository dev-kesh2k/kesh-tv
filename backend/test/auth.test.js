import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearFailures, pruneAttempts, recordFailure, tooManyAttempts } from '../src/auth.js';

test('bloqueia depois de 10 tentativas erradas e libera ao acertar', () => {
  const key = '1.2.3.4:a@a.com';
  for (let i = 0; i < 10; i++) recordFailure(key);
  assert.equal(tooManyAttempts(key), true);
  clearFailures(key);
  assert.equal(tooManyAttempts(key), false);
});

test('tentativas antigas são apagadas da memória', () => {
  recordFailure('5.6.7.8:b@b.com');
  assert.ok(pruneAttempts() >= 1);
  assert.equal(pruneAttempts(Date.now() + 16 * 60_000), 0);
});

test('IP do visitante: CF-Connecting-IP só quando TRUST_CLOUDFLARE=1', async () => {
  const { clientIp } = await import('../src/auth.js');
  const req = { headers: { 'cf-connecting-ip': '203.0.113.9' }, ip: '172.18.0.1' };
  delete process.env.TRUST_CLOUDFLARE;
  assert.equal(clientIp(req), '172.18.0.1');
  process.env.TRUST_CLOUDFLARE = '1';
  assert.equal(clientIp(req), '203.0.113.9');
  delete process.env.TRUST_CLOUDFLARE;
});
