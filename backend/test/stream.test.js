import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sign, verify } from '../src/net.js';
import { rewriteHls, typeFromUrl, xtreamHls } from '../src/stream.js';

test('links assinados: ida e volta, adulteração e validade', () => {
  const q = Object.fromEntries(new URLSearchParams(sign('http://a/1.ts', { ua: 'UA', ttlSec: 60 })));
  assert.deepEqual(verify(q), { url: 'http://a/1.ts', ua: 'UA', ref: '' });
  assert.throws(() => verify({ ...q, u: Buffer.from('http://b/').toString('base64url') }), /inválido/);
  const old = Object.fromEntries(new URLSearchParams(sign('http://a/1.ts', { ttlSec: -10 })));
  assert.throws(() => verify(old), /expirado/);
});

test('reescreve segmentos, sub-playlists e URI de chaves para o proxy', () => {
  const out = rewriteHls('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:6,\nseg1.ts\nhttp://cdn/x/seg2.ts\n', 'http://srv/live/a/index.m3u8', '', '');
  const lines = out.split('\n');
  assert.match(lines[1], /URI="stream\?u=/);
  assert.match(lines[3], /^stream\?u=/);
  assert.match(lines[4], /^stream\?u=/);
  const seg1 = Object.fromEntries(new URLSearchParams(lines[3].slice('stream?'.length)));
  assert.equal(verify(seg1).url, 'http://srv/live/a/seg1.ts');
});

test('tipo pela extensão', () => {
  assert.equal(typeFromUrl('http://a/x.m3u8?t=1'), 'hls');
  assert.equal(typeFromUrl('http://a/x.ts'), 'ts');
  assert.equal(typeFromUrl('http://a/x.mkv'), 'file');
  assert.equal(typeFromUrl('http://a/x'), 'unknown');
});

test('alternativa .m3u8 de servidores Xtream', () => {
  assert.equal(xtreamHls('http://a:80/live/u/p/123.ts'), 'http://a/live/u/p/123.m3u8');
  assert.equal(xtreamHls('http://a:80/u/p/123.ts'), 'http://a/live/u/p/123.m3u8');
  assert.equal(xtreamHls('http://a/movie/u/p/1.mp4'), null);
});
