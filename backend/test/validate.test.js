import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../src/db.js';
import { EMAIL_RE, hostName, kindOf, listUrl, password, text, uuid } from '../src/validate.js';

const erro = (status, re) => (e) => e instanceof HttpError && e.status === status && re.test(e.message);

test('text: corta espaços, obrigatório e tamanho máximo', () => {
  assert.equal(text('  Sala  ', 'Nome'), 'Sala');
  assert.equal(text(5, 'Nome'), '');
  assert.throws(() => text('', 'Nome', { required: true }), erro(400, /obrigatório/));
  assert.throws(() => text('abc', 'Nome', { max: 2 }), erro(400, /no máximo 2/));
});

test('password: 8 a 200 caracteres', () => {
  assert.equal(password('12345678'), '12345678');
  assert.throws(() => password('1234567'), erro(400, /8 caracteres/));
  assert.throws(() => password('x'.repeat(201)), erro(400, /longa/));
});

test('listUrl: só http(s) e sem espaços', () => {
  assert.equal(listUrl(' http://servidor.tv:8080/get.php?u=a '), 'http://servidor.tv:8080/get.php?u=a');
  assert.throws(() => listUrl('ftp://x'), erro(400, /http/));
  assert.throws(() => listUrl('http://a b'), erro(400, /http/));
  assert.throws(() => listUrl(''), erro(400, /obrigatório/));
});

test('uuid: formato errado vira 404 com o nome do registro', () => {
  const id = '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
  assert.equal(uuid(id), id);
  assert.throws(() => uuid('1', 'Canal'), erro(404, /Canal não encontrado/));
  assert.throws(() => uuid(undefined), erro(404, /Registro/));
});

test('hostName: servidor do link sem www e nome padrão', () => {
  assert.equal(hostName('http://www.minhalista.com:8080/x.m3u'), 'minhalista.com');
  assert.equal(hostName('não é link'), 'Minha lista');
});

test('kindOf e EMAIL_RE', () => {
  assert.equal(kindOf('movie'), 'movie');
  assert.equal(kindOf('series'), 'series');
  assert.equal(kindOf('qualquer'), 'live');
  assert.equal(kindOf(undefined), 'live');
  assert.ok(EMAIL_RE.test('a@b.com'));
  assert.ok(!EMAIL_RE.test('a@b'));
});
