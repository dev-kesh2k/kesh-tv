import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPublic, blockedIp } from '../src/net.js';

test('bloqueia endereços internos em IPv4', () => {
  for (const ip of ['127.0.0.1', '0.0.0.0', '169.254.169.254', '172.17.0.1', '100.64.0.1', '224.0.0.1']) assert.equal(blockedIp(ip), true, ip);
  for (const ip of ['8.8.8.8', '192.168.1.10', '10.0.0.5', '104.26.14.69']) assert.equal(blockedIp(ip), false, ip);
});

test('bloqueia IPv4 interno escondido em IPv6 (qualquer escrita)', () => {
  for (const ip of ['::1', '::', '::ffff:127.0.0.1', '::ffff:7f00:1', '0:0:0:0:0:ffff:7f00:1', '::ffff:a9fe:a9fe', '::7f00:1', '64:ff9b::7f00:1', 'fe80::1', 'fd00::1', 'ff02::1'])
    assert.equal(blockedIp(ip), true, ip);
  for (const ip of ['2001:4860:4860::8888', '::ffff:8.8.8.8', '2606:4700::6810:84e5']) assert.equal(blockedIp(ip), false, ip);
});

test('URLs com IPv6 interno são recusadas antes de qualquer conexão', async () => {
  for (const u of ['http://[::ffff:127.0.0.1]/', 'http://[::ffff:7f00:1]:3000/x', 'http://[::ffff:a9fe:a9fe]/latest/meta-data']) {
    await assert.rejects(assertPublic(u), /não permitido/, u);
  }
});

test('safeFetch respeita pedido já cancelado', async () => {
  const { safeFetch } = await import('../src/net.js');
  const ctrl = new AbortController();
  ctrl.abort(new Error('fechou'));
  await assert.rejects(safeFetch('http://1.1.1.1/', { signal: ctrl.signal }), /fechou/);
});
