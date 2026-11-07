import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExport, parseImport } from '../src/favorites-io.js';

test('exporta nome, url, grupo e tipo', () => {
  const out = buildExport([{ name: 'A', url: 'http://a/1.ts', groupTitle: 'G', kind: 'live', id: 'x' }]);
  assert.equal(out.app, 'kesh-tv');
  assert.deepEqual(out.favorites, [{ name: 'A', url: 'http://a/1.ts', group: 'G', kind: 'live' }]);
});

test('importa o arquivo exportado e também uma lista simples', () => {
  const file = buildExport([{ name: 'A', url: 'http://a/1.ts', groupTitle: '', kind: 'live' }]);
  assert.deepEqual(parseImport(file), [{ name: 'A', url: 'http://a/1.ts', kind: 'live' }]);
  assert.equal(parseImport([{ name: 'B' }]).length, 1);
});

test('descarta itens inválidos e recusa arquivos estranhos', () => {
  assert.deepEqual(parseImport({ favorites: [{ url: 'javascript:x' }, {}, { name: ' C ', kind: 'xx' }] }), [{ name: 'C', url: '', kind: null }]);
  assert.throws(() => parseImport({ foo: 1 }), /inválido/);
  assert.throws(() => parseImport({ favorites: new Array(5001).fill({ name: 'a' }) }), /Máximo/);
});
