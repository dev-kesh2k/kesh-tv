import { test } from 'node:test';
import assert from 'node:assert/strict';

// O módulo lê location/localStorage ao carregar: ambiente mínimo de navegador antes do import.
const g = globalThis as Record<string, unknown>;
g.location ??= { search: '' };
g.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const { detectPlatform } = await import('../src/platform.ts');

const CHROME_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const ANDROID_TV = 'Mozilla/5.0 (Linux; Android 11; BRAVIA 4K) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const SAMSUNG = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0) AppleWebKit/537.36 SamsungBrowser/4.0 TV Safari/537.36';

test('detectPlatform: navegador comum não é TV', () => {
  assert.deepEqual(detectPlatform(CHROME_PC), { tv: false, app: false, ios: false, android: false });
});

test('detectPlatform: iPhone e iPad (iPadOS se diz Macintosh + Mobile)', () => {
  assert.equal(detectPlatform(IPHONE).ios, true);
  assert.equal(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Mobile/15E148').ios, true);
});

test('detectPlatform: TVs pelo user agent', () => {
  assert.equal(detectPlatform(ANDROID_TV).tv, true);
  assert.equal(detectPlatform(ANDROID_TV).android, true);
  assert.equal(detectPlatform(SAMSUNG).tv, true);
});

test('detectPlatform: app Android nativo manda no modo TV', () => {
  const p = detectPlatform('Mozilla/5.0 (Linux; Android 13) KeshTV-Android/1.2', false);
  assert.equal(p.app, true);
  assert.equal(p.tv, false);
  assert.equal(detectPlatform(CHROME_PC, true).tv, true);
});

test('detectPlatform: escolha manual vence a detecção', () => {
  assert.equal(detectPlatform(CHROME_PC, undefined, '1').tv, true);
  assert.equal(detectPlatform(ANDROID_TV, undefined, '0').tv, false);
  assert.equal(detectPlatform(ANDROID_TV, undefined, 'x').tv, true);
});
