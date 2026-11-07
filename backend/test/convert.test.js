import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHeader } from '../src/convert.js';

/** Cabeçalho MKV mínimo: EBML + CodecID + CodecPrivate (avcC com o profile_idc) + Duration. */
function mkv(profile) {
  const parts = [
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x80]),
    Buffer.from([0x86, 0x8f]),
    Buffer.from('V_MPEG4/ISO/AVC'),
    Buffer.from([0x63, 0xa2, 0x85, 0x01, profile, 0x00, 0x28, 0xff]), // tamanho 5 (vint 0x85), avcC: versão 1, profile
    Buffer.from([0x44, 0x89, 0x88]),
    (() => { const b = Buffer.alloc(8); b.writeDoubleBE(60_000); return b; })(), // 60 s (escala padrão 1 ms)
    Buffer.from('A_AAC'),
  ];
  return Buffer.concat(parts);
}

test('MKV H.264 comum (High) pode ser só reempacotado', () => {
  const info = parseHeader(mkv(100));
  assert.equal(info.vcodec, 'h264');
  assert.equal(info.pix, '');
  assert.equal(Math.round(info.duration), 60);
  assert.equal(info.hasAudio, true);
});

test('MKV H.264 de 10 bits (Hi10P) é marcado para converter', () => {
  assert.equal(parseHeader(mkv(110)).pix, 'yuv420p10le');
  assert.equal(parseHeader(mkv(244)).pix, 'yuv420p10le');
});
