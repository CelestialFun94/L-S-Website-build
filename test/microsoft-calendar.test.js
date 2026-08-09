const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { clean, parseJwt, safeEqual, seal, unseal } = require('../api/microsoft-calendar')._test;

test('Microsoft OAuth values are authenticated and encrypted at rest', () => {
  const key = randomBytes(32);
  const value = 'synthetic-refresh-token';
  const encrypted = seal(value, key);
  assert.notEqual(encrypted, value);
  assert.equal(unseal(encrypted, key), value);
  assert.throws(() => unseal(encrypted, randomBytes(32)));
});

test('Microsoft state comparison and token claim parsing fail safely', () => {
  assert.equal(safeEqual('expected', 'expected'), true);
  assert.equal(safeEqual('expected', 'different'), false);
  const payload = Buffer.from(JSON.stringify({ tid: 'tenant-example' })).toString('base64url');
  assert.equal(parseJwt(`header.${payload}.signature`).tid, 'tenant-example');
  assert.deepEqual(parseJwt('invalid'), {});
  assert.equal(clean('  Calendar   event  ', 100), 'Calendar event');
});
