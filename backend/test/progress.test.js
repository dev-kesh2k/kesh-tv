import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSeconds, resumePoint, watchedFraction } from '../src/progress.js';

test('retoma só no meio do vídeo', () => {
  assert.equal(resumePoint(10, 3600), 0);
  assert.equal(resumePoint(1420.7, 3600), 1420);
  assert.equal(resumePoint(3570, 3600), 0);
  assert.equal(resumePoint(500, 0), 500);
});

test('fração assistida', () => {
  assert.equal(watchedFraction(0, 100), 0);
  assert.equal(watchedFraction(900, 3600), 0.25);
  assert.equal(watchedFraction(3580, 3600), 1);
  assert.equal(watchedFraction(50, 0), 0);
});

test('segundos válidos', () => {
  assert.equal(cleanSeconds('12.5'), 12.5);
  assert.equal(cleanSeconds(-1), null);
  assert.equal(cleanSeconds(1e9), null);
  assert.equal(cleanSeconds('x'), null);
});
