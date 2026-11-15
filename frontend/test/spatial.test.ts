import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextInDirection } from '../src/spatial.ts';

const rect = (left: number, top: number, w = 100, h = 50) => ({ left, top, width: w, height: h, right: left + w, bottom: top + h }) as DOMRect;
const item = (id: string, left: number, top: number) => ({ el: { id } as unknown as HTMLElement, rect: rect(left, top) });

// Grade 3×2: a1 a2 a3 / b1 b2 b3 (100×50, espaço de 20).
const grid = [item('a1', 0, 0), item('a2', 120, 0), item('a3', 240, 0), item('b1', 0, 70), item('b2', 120, 70), item('b3', 240, 70)];
const go = (from: string, dir: 'up' | 'down' | 'left' | 'right') => {
  const f = grid.find((g) => (g.el as unknown as { id: string }).id === from)!;
  const out = nextInDirection(f.rect, dir, grid.filter((g) => g !== f));
  return out ? (out as unknown as { id: string }).id : null;
};

test('nextInDirection: anda na grade pela direção da seta', () => {
  assert.equal(go('a1', 'right'), 'a2');
  assert.equal(go('a2', 'down'), 'b2');
  assert.equal(go('b3', 'up'), 'a3');
  assert.equal(go('b2', 'left'), 'b1');
});

test('nextInDirection: na borda não há para onde ir', () => {
  assert.equal(go('a1', 'left'), null);
  assert.equal(go('a1', 'up'), null);
  assert.equal(go('b3', 'right'), null);
});

test('nextInDirection: prefere ficar na mesma linha a pular na diagonal', () => {
  const from = rect(0, 0);
  const mesmaLinha = item('linha', 400, 0);
  const diagonal = item('diag', 150, 200);
  const out = nextInDirection(from, 'right', [diagonal, mesmaLinha]) as unknown as { id: string };
  assert.equal(out.id, 'linha');
});
