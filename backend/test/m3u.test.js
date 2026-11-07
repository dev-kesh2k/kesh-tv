import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, parseM3U, splitEpisode } from '../src/m3u.js';

test('lê atributos, título com vírgula e grupo', () => {
  const [it] = parseM3U('#EXTM3U\n#EXTINF:-1 tvg-id="a.br" tvg-logo="http://x/l.png" group-title="Abertos",Globo, HD\nhttp://srv/live/u/p/1.ts\n');
  assert.equal(it.name, 'Globo, HD');
  assert.equal(it.groupTitle, 'Abertos');
  assert.equal(it.logo, 'http://x/l.png');
  assert.equal(it.tvgId, 'a.br');
  assert.equal(it.kind, 'live');
});

test('aceita CRLF, lista sem #EXTM3U e ignora URLs repetidas', () => {
  const items = parseM3U('#EXTINF:-1,A\r\nhttp://a/1.m3u8\r\n#EXTINF:-1,B\r\nhttp://a/1.m3u8\r\n');
  assert.equal(items.length, 1);
  assert.equal(items[0].name, 'A');
});

test('#EXTVLCOPT e formato Kodi (url|User-Agent=...) viram user-agent/referrer', () => {
  const [a, b] = parseM3U(
    '#EXTINF:-1,A\n#EXTVLCOPT:http-user-agent=Meu UA\n#EXTVLCOPT:http-referrer=http://ref/\nhttp://a/1.ts\n' +
      '#EXTINF:-1,B\nhttp://a/2.ts|User-Agent=Outro%20UA&Referer=http://r2/\n',
  );
  assert.equal(a.userAgent, 'Meu UA');
  assert.equal(a.referrer, 'http://ref/');
  assert.equal(b.url, 'http://a/2.ts');
  assert.equal(b.userAgent, 'Outro UA');
  assert.equal(b.referrer, 'http://r2/');
});

test('sem título usa o nome do arquivo; linhas que não são URL são ignoradas', () => {
  const items = parseM3U('#EXTINF:-1,\nlixo\nhttp://a/canal-novo.ts\n');
  assert.equal(items.length, 1);
  assert.equal(items[0].name, 'canal-novo');
});

test('classifica pelo link antes do grupo', () => {
  assert.equal(classify('http://a/movie/u/p/1.mp4', 'Séries'), 'movie');
  assert.equal(classify('http://a/series/u/p/1.mkv', 'Filmes'), 'series');
  assert.equal(classify('http://a/u/p/9.ts', 'Canais • Filmes e Series'), 'live');
  assert.equal(classify('http://a/x.mp4', 'Séries'), 'series');
  assert.equal(classify('http://a/x.mp4', 'Ação'), 'movie');
  assert.equal(classify('http://a/x', 'Esportes'), 'live');
});

test('separa série, temporada e episódio', () => {
  assert.deepEqual(splitEpisode('Greys Anatomy [L] S03E06'), { seriesName: 'Greys Anatomy [L]', season: 3, episode: 6 });
  assert.deepEqual(splitEpisode('Lost - S1 E2'), { seriesName: 'Lost', season: 1, episode: 2 });
  assert.deepEqual(splitEpisode('Filme 2020'), { seriesName: '', season: 0, episode: 0 });
});

test('episódios de série ganham seriesName/season/episode', () => {
  const [it] = parseM3U('#EXTINF:-1 group-title="Séries",Lost S02E03\nhttp://a/series/u/p/5.mp4\n');
  assert.equal(it.kind, 'series');
  assert.equal(it.seriesName, 'Lost');
  assert.equal(it.season, 2);
  assert.equal(it.episode, 3);
});

test('busca sem acentos: nome normalizado', async () => {
  const { normalizeSearch } = await import('../src/m3u.js');
  assert.equal(normalizeSearch('A Força do Amor'), 'a forca do amor');
  assert.equal(normalizeSearch('AÇÃO Ñandú'), 'acao nandu');
  const [it] = parseM3U('#EXTINF:-1,Canal Ação\nhttp://a/1.ts\n');
  assert.equal(it.searchName, 'canal acao');
});
