const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-public-key';
const handler = require('../api/inquiries');

function response() {
  return {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('rejects an invalid public inquiry', async () => {
  const res = response();
  await handler({ method: 'POST', body: { kind: 'starter', name: 'A', email: 'bad' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /valid email/i);
});

test('sends only allowlisted inquiry fields to Supabase', async () => {
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true };
  };
  const res = response();
  await handler({ method: 'POST', body: { kind: 'cowrite', name: 'Ada Artist', email: 'ADA@EXAMPLE.COM', phone: '(615) 555-0123', contact_preference: 'sms', availability: 'August 18 after 2 PM', time_zone: 'CT', consent: true, status: 'closed', role: 'owner' } }, res);
  assert.equal(res.statusCode, 201);
  const sent = JSON.parse(request.options.body);
  assert.deepEqual(Object.keys(sent).sort(), ['availability', 'consent', 'contact_preference', 'email', 'idea', 'kind', 'name', 'path', 'phone', 'source', 'time_zone'].sort());
  assert.equal(sent.email, 'ada@example.com');
  assert.equal(sent.phone, '(615) 555-0123');
  assert.equal(sent.contact_preference, 'sms');
  assert.equal(sent.availability, 'August 18 after 2 PM');
  assert.equal(sent.time_zone, 'CT');
  assert.equal(sent.status, undefined);
  assert.equal(sent.role, undefined);
});

test('requires co-write availability and a supported US time zone', async () => {
  const res = response();
  await handler({ method: 'POST', body: { kind: 'cowrite', name: 'Ada Artist', email: 'ada@example.com', phone: '615-555-0123', contact_preference: 'email', availability: 'Any afternoon', time_zone: 'UTC', consent: true } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /time zone/i);
});

test('requires a phone number and contact preference', async () => {
  const res = response();
  await handler({ method: 'POST', body: { kind: 'starter', name: 'Ada Artist', email: 'ada@example.com', path: 'I need publishing support' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /phone number/i);
});

test('silently accepts honeypot spam without a database request', async () => {
  global.fetch = async () => assert.fail('Spam should not reach Supabase');
  const res = response();
  await handler({ method: 'POST', body: { company: 'Bot LLC' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
});
