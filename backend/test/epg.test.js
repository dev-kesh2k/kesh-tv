import { test } from 'node:test';
import assert from 'node:assert/strict';
import { epgUrlFor } from '../src/epg.js';
import { createParser } from '../src/m3u.js';

test('guia do cabeçalho da lista tem prioridade', () => {
  assert.equal(epgUrlFor('http://a/get.php?username=u&password=p', { 'url-tvg': 'https://epg/guia.xml.gz,https://outro' }), 'https://epg/guia.xml.gz');
});

test('servidor Xtream: xmltv.php com o mesmo usuário', () => {
  assert.equal(epgUrlFor('http://srv:80/get.php?username=u1&password=p%2B1&type=m3u_plus'), 'http://srv/xmltv.php?username=u1&password=p%2B1');
});

test('sem guia: lista por arquivo ou sem padrão Xtream', () => {
  assert.equal(epgUrlFor(null), null);
  assert.equal(epgUrlFor('http://a/lista.m3u'), null);
});

test('o leitor guarda os atributos do #EXTM3U', () => {
  const p = createParser();
  p.push('#EXTM3U x-tvg-url="http://epg/a.xml" url-tvg="http://epg/b.xml"');
  assert.equal(p.header['x-tvg-url'], 'http://epg/a.xml');
  assert.equal(p.header['url-tvg'], 'http://epg/b.xml');
});

test('programas sobrepostos do provedor são descartados', async () => {
  const { dropOverlaps } = await import('../src/epg.js');
  const t = (h, m) => new Date(Date.UTC(2026, 10, 7, h, m));
  const list = [
    { title: 'A', start: t(1, 39), stop: t(2, 3) },
    { title: 'A (repetido)', start: t(1, 44), stop: t(2, 8) },
    { title: 'B', start: t(2, 3), stop: t(2, 26) },
    { title: 'C', start: t(2, 25), stop: t(3, 0) },
  ];
  assert.deepEqual(dropOverlaps(list).map((p) => p.title), ['A', 'B', 'C']);
});
