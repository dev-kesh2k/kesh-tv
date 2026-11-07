import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createXmltvParser, decodeXml, parseXmltvTime } from '../src/xmltv.js';

const XML = `<?xml version="1.0"?><tv>
<channel id="globo.br"><display-name>Globo</display-name></channel>
<programme start="20261107200000 -0300" stop="20261107213000 -0300" channel="globo.br">
  <title lang="pt">Jornal &amp; Notícias</title><desc>Resumo do dia &#233; agora</desc>
</programme>
<programme start="20261107213000 -0300" stop="20261107230000 -0300" channel="globo.br"><title><![CDATA[Novela <das 9>]]></title></programme>
<programme start="ruim" stop="20261107230000" channel="x"><title>Inválido</title></programme>
</tv>`;

test('horário XMLTV com e sem fuso', () => {
  assert.equal(parseXmltvTime('20261107200000 -0300').toISOString(), '2026-11-07T23:00:00.000Z');
  assert.equal(parseXmltvTime('20261107200000').toISOString(), '2026-11-07T20:00:00.000Z');
  assert.equal(parseXmltvTime('2026'), null);
});

test('entidades e CDATA', () => {
  assert.equal(decodeXml('A &amp; B &#233; &#x41;'), 'A & B é A');
  assert.equal(decodeXml('<![CDATA[x < y]]>'), 'x < y');
});

test('lê programas mesmo cortados em pedaços aleatórios', () => {
  const p = createXmltvParser();
  const got = [];
  for (let i = 0; i < XML.length; i += 7) got.push(...p.push(XML.slice(i, i + 7)));
  assert.equal(got.length, 2);
  assert.equal(got[0].channel, 'globo.br');
  assert.equal(got[0].title, 'Jornal & Notícias');
  assert.equal(got[0].desc, 'Resumo do dia é agora');
  assert.equal(got[0].start.toISOString(), '2026-11-07T23:00:00.000Z');
  assert.equal(got[1].title, 'Novela <das 9>');
});
