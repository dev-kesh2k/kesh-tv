// Checagem leve do backend no CI: só pega variável usada sem declarar/importar (ex.: import esquecido),
// erro que o `node --check` não vê e que só estoura quando a função roda.
const node = [
  'process', 'Buffer', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate',
  'clearImmediate', 'URL', 'URLSearchParams', 'fetch', 'Response', 'Request', 'Headers', 'AbortController',
  'AbortSignal', 'TextEncoder', 'TextDecoder', 'structuredClone', 'queueMicrotask', 'globalThis', 'crypto',
  'Intl', 'FormData', 'Blob', 'performance',
];

export default [
  {
    files: ['src/**/*.js', 'prisma/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: Object.fromEntries(node.map((n) => [n, 'readonly'])),
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: { 'no-undef': 'error' },
  },
];
