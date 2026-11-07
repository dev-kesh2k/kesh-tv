import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SERIES_MARK, streamBase, toItem, xtreamCreds } from '../src/xtream.js';

const c = xtreamCreds('http://painel.exemplo/get.php?username=joao&password=s3nha&type=m3u_plus&output=ts');

test('reconhece link Xtream e ignora M3U comum', () => {
  assert.deepEqual(c, { origin: 'http://painel.exemplo', user: 'joao', pass: 's3nha', ext: 'ts' });
  assert.equal(xtreamCreds('http://x/lista.m3u'), null);
  assert.equal(xtreamCreds('http://x/get.php?username=a'), null);
  assert.equal(xtreamCreds('http://x/get.php?username=a&password=b&output=m3u8').ext, 'm3u8');
});

test('base dos vídeos vem do servidor informado (igual ao M3U)', () => {
  assert.equal(streamBase(c, { url: 'painel.exemplo', port: '80', server_protocol: 'http' }), 'http://painel.exemplo:80');
  assert.equal(streamBase(c, { url: 'cdn.x', https_port: '443', server_protocol: 'https' }), 'https://cdn.x:443');
  assert.equal(streamBase(c, null), 'http://painel.exemplo');
});

test('monta canal, filme e série com os mesmos links do M3U', () => {
  const ctx = { root: 'http://painel.exemplo:80', c, group: 'Notícias' };
  const live = toItem('live', { name: 'Jornal', stream_id: 7, stream_icon: 'http://l/x.png', epg_channel_id: 'jornal.br' }, ctx);
  assert.equal(live.url, 'http://painel.exemplo:80/joao/s3nha/7.ts');
  assert.equal(live.kind, 'live');
  assert.equal(live.tvgId, 'jornal.br');
  const movie = toItem('movie', { name: 'Ação Total', stream_id: 9, container_extension: 'mkv' }, ctx);
  assert.equal(movie.url, 'http://painel.exemplo:80/movie/joao/s3nha/9.mkv');
  assert.equal(movie.searchName, 'acao total');
  const serie = toItem('series', { name: 'Noite Fria', series_id: 42, cover: 'http://c' }, ctx);
  assert.equal(serie.tvgId, `${SERIES_MARK}42`);
  assert.equal(serie.seriesName, 'Noite Fria');
});
