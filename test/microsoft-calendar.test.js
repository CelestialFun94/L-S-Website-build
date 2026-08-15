const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { clean, cleanBody, hasScope, parseJwt, safeEqual, seal, unseal } = require('../api/microsoft-calendar')._test;

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

test('Outlook mail scope and message bodies are handled safely', () => {
  assert.equal(hasScope({ scopes: ['User.Read', 'https://graph.microsoft.com/Mail.Send'] }, 'Mail.Send'), true);
  assert.equal(hasScope({ scopes: ['Calendars.ReadWrite'] }, 'Mail.Send'), false);
  assert.equal(cleanBody(' First line\r\n\r\nSecond line ', 100), 'First line\n\nSecond line');
});
